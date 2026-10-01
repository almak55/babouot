// functions/ordonnancement.js
//
// POST /.netlify/functions/ordonnancement
// body (optionnel) : { date_debut: '2026-09-22', horizon_jours: 14 }
//
// Planifie automatiquement les opérations "à planifier" des gammes
// opératoires, dans l'ordre de priorité des OF (urgente > haute >
// normale), puis par délai le plus proche.
//
// Règles appliquées (simplifiées, à affiner avec l'atelier) :
//   - Une opération d'une gamme ne peut être planifiée qu'après le
//     jour où l'opération précédente de la même gamme a été posée
//     (respect du séquencement).
//   - Une machine ne reçoit qu'un OF par jour (granularité jour,
//     cohérente avec le planning papier actuel).
//   - Une personne compétente sur l'opération (via personnel_competences)
//     OU sur la machine précise (via personnel_machines) est requise,
//     et ne doit pas déjà être affectée ce jour-là, ni absente
//     (personnel_planning_jour.statut = 'absent'/'congé').
//   - Le personnel en 'encadrement' (ex: contremaître) n'est mobilisé
//     comme opérateur qu'en dernier recours, s'il a une compétence
//     machine explicite (cas d'Alain).
//
// Ce que ça ne fait PAS encore : durées d'opération variables,
// plusieurs équipes/postes par jour, capacité multi-OF par machine.
// Pour un atelier de cette taille ça reste une fonction synchrone ;
// si le nombre d'OF grossit et que ça dépasse la limite de 10s de
// Netlify, reprendre le pattern start/background/status déjà utilisé
// sur ScoutLab (analyze-background.js).

const { getSupabase } = require('./lib/supabaseClient');

const PRIORITE_ORDRE = { urgente: 0, haute: 1, normale: 2 };

exports.handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const dateDebut = body.date_debut || new Date().toISOString().slice(0, 10);
    const horizonJours = body.horizon_jours || 14;
    const horizon = buildHorizon(dateDebut, horizonJours);

    const supabase = getSupabase();

    // 1. Charger les OF actifs, triés par priorité puis délai.
    const { data: ordres, error: ordresError } = await supabase
      .from('ordres_fabrication')
      .select('id, numero, priorite, delai, statut')
      .in('statut', ['planifié', 'en cours']);
    if (ordresError) throw ordresError;

    ordres.sort((a, b) => {
      const p = (PRIORITE_ORDRE[a.priorite] ?? 2) - (PRIORITE_ORDRE[b.priorite] ?? 2);
      if (p !== 0) return p;
      return new Date(a.delai || '9999-12-31') - new Date(b.delai || '9999-12-31');
    });

    // 2. Charger tout ce qui est nécessaire une seule fois (évite les
    // allers-retours répétés à Supabase dans la boucle).
    const [gammesRes, machinesRes, machinesOpsRes, competencesRes, persMachinesRes,
           personnelRes, absencesRes, planningRes] = await Promise.all([
      supabase.from('gammes_operatoires').select('*').order('sequence'),
      supabase.from('machines').select('id, code, operation_id').eq('actif', true),
      supabase.from('machines_operations').select('machine_id, operation_id'),
      supabase.from('personnel_competences').select('personnel_id, operation_id'),
      supabase.from('personnel_machines').select('personnel_id, machine_id'),
      supabase.from('personnel').select('id, nom, role_type').eq('actif', true),
      supabase.from('personnel_planning_jour').select('personnel_id, date, statut')
        .gte('date', dateDebut).lte('date', horizon[horizon.length - 1]),
      supabase.from('planning_jour').select('machine_id, personnel_id, date')
        .gte('date', dateDebut).lte('date', horizon[horizon.length - 1])
        .neq('statut', 'annulé'),
    ]);
    for (const r of [gammesRes, machinesRes, machinesOpsRes, competencesRes,
                      persMachinesRes, personnelRes, absencesRes, planningRes]) {
      if (r.error) throw r.error;
    }

    const gammes = gammesRes.data;
    const machines = machinesRes.data;
    const machinesOps = machinesOpsRes.data;
    const competences = competencesRes.data;
    const persMachines = persMachinesRes.data;
    const personnel = personnelRes.data;
    const absences = absencesRes.data;

    // Occupation courante (machine, jour) et (personne, jour) —
    // mise à jour au fil des affectations simulées dans cette run.
    const occMachine = new Set(planningRes.data.map((p) => `${p.machine_id}__${p.date}`));
    const occPersonnel = new Set(
      planningRes.data.filter((p) => p.personnel_id).map((p) => `${p.personnel_id}__${p.date}`)
    );
    const absentSet = new Set(
      absences.filter((a) => a.statut === 'absent' || a.statut === 'congé')
        .map((a) => `${a.personnel_id}__${a.date}`)
    );

    const machinesParOp = (operationId) => {
      const direct = machines.filter((m) => m.operation_id === operationId).map((m) => m.id);
      const viaTable = machinesOps
        .filter((mo) => mo.operation_id === operationId)
        .map((mo) => mo.machine_id);
      return Array.from(new Set([...direct, ...viaTable]));
    };

    const personnelPourOpEtMachine = (operationId, machineId) => {
      const parCompetence = competences
        .filter((c) => c.operation_id === operationId)
        .map((c) => c.personnel_id);
      const parMachine = persMachines
        .filter((pm) => pm.machine_id === machineId)
        .map((pm) => pm.personnel_id);
      const candidats = Array.from(new Set([...parCompetence, ...parMachine]));
      // Opérateurs d'abord, encadrement en dernier recours.
      return candidats
        .map((id) => personnel.find((p) => p.id === id))
        .filter(Boolean)
        .sort((a, b) => (a.role_type === 'encadrement' ? 1 : 0) - (b.role_type === 'encadrement' ? 1 : 0));
    };

    const propositions = [];
    const nonPlanifies = [];

    for (const of of ordres) {
      const gammeOf = gammes
        .filter((g) => g.of_id === of.id)
        .sort((a, b) => a.sequence - b.sequence);

      let jourMin = dateDebut; // jour à partir duquel l'opération suivante peut démarrer

      for (const etape of gammeOf) {
        if (etape.statut !== 'à planifier') {
          continue; // déjà planifiée/en cours/terminée : on avance quand même le curseur si possible
        }

        const machinesCompatibles = machinesParOp(etape.operation_id);
        let place = null;

        for (const jour of horizon) {
          if (jour < jourMin) continue;
          for (const machineId of machinesCompatibles) {
            if (occMachine.has(`${machineId}__${jour}`)) continue;
            const candidats = personnelPourOpEtMachine(etape.operation_id, machineId).filter((p) => {
              if (absentSet.has(`${p.id}__${jour}`)) return false;
              if (occPersonnel.has(`${p.id}__${jour}`)) return false;
              return true;
            });
            if (candidats.length > 0) {
              place = { jour, machineId, personnelId: candidats[0].id };
              break;
            }
          }
          if (place) break;
        }

        if (place) {
          occMachine.add(`${place.machineId}__${place.jour}`);
          occPersonnel.add(`${place.personnelId}__${place.jour}`);
          jourMin = place.jour; // l'étape suivante ne peut pas démarrer avant ce jour
          propositions.push({
            of_numero: of.numero,
            gamme_operatoire_id: etape.id,
            operation_id: etape.operation_id,
            date: place.jour,
            machine_id: place.machineId,
            personnel_id: place.personnelId,
          });
        } else {
          nonPlanifies.push({
            of_numero: of.numero,
            gamme_operatoire_id: etape.id,
            operation_id: etape.operation_id,
            raison: 'Aucune combinaison machine/personnel disponible sur l\'horizon demandé',
          });
        }
      }
    }

    // 3. Écrire les propositions retenues dans planning_jour et mettre
    // à jour le statut des étapes de gamme correspondantes.
    if (propositions.length > 0) {
      const { error: insertError } = await supabase.from('planning_jour').insert(
        propositions.map((p) => ({
          date: p.date,
          machine_id: p.machine_id,
          operation_id: p.operation_id,
          gamme_operatoire_id: p.gamme_operatoire_id,
          personnel_id: p.personnel_id,
          statut: 'planifié',
        }))
      );
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('gammes_operatoires')
        .update({ statut: 'planifié' })
        .in('id', propositions.map((p) => p.gamme_operatoire_id));
      if (updateError) throw updateError;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        etapes_planifiees: propositions.length,
        etapes_non_planifiees: nonPlanifies.length,
        details_non_planifies: nonPlanifies,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function buildHorizon(dateDebut, nJours) {
  const jours = [];
  const d = new Date(dateDebut + 'T00:00:00Z');
  while (jours.length < nJours) {
    const jourSemaine = d.getUTCDay();
    if (jourSemaine !== 0 && jourSemaine !== 6) {
      jours.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return jours;
}
