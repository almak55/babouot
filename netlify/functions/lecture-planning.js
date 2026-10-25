// functions/lecture-planning.js
//
// GET /.netlify/functions/lecture-planning?date_debut=2026-09-21&date_fin=2026-09-27
//
// Un seul appel consolidé plutôt que 6 appels séparés (machines,
// personnel, compétences, ordres, stocks, planning) : le front n'a
// besoin que d'une requête pour construire l'écran de planification.
//
// Réponse :
// {
//   machines: [...],
//   personnel: [...],   // chaque personne inclut `competences: [nom d'opération, ...]`
//   ordres: [...],
//   stocks: [...],
//   planning: [...]   // créneaux planning_jour de la période demandée, chacun avec `personnel_ids` (toutes les personnes affectées)
// }

const { getSupabase } = require('./lib/supabaseclient');
const { purgerObsoletes } = require('./lib/obsoletes');

const handlerProtege = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const dateDebut = params.date_debut;
    const dateFin = params.date_fin;
    if (!dateDebut || !dateFin) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Paramètres date_debut et date_fin requis.' }),
      };
    }

    const supabase = getSupabase();
    await purgerObsoletes(supabase);   // créneaux restants d'étapes déjà terminées

    const [machinesRes, personnelRes, competencesRes, machinesPersRes, ordresRes, stocksRes, planningRes, dispoRes] = await Promise.all([
      supabase.from('machines').select('id, code, nom').eq('actif', true).order('code'),
      supabase.from('personnel').select('id, nom, poste, role_type').eq('actif', true).order('nom'),
      supabase.from('personnel_competences').select('personnel_id, operations(nom)'),
      supabase.from('personnel_machines').select('personnel_id, machines(code, nom)'),
      supabase.from('ordres_fabrication')
        .select('*, titres(nom, client)')
        .in('statut', ['en attente de validation', 'validé', 'en cours', 'en pause']),
      supabase.from('stocks').select('id, nom, unite, quantite, seuil_alerte'),
      supabase.from('planning_jour')
        .select('id, date, heure_debut, heure_fin, phase, machine_id, personnel_id, of_id, operation_id, gamme_operatoire_id, statut, planning_jour_personnel(personnel_id)')
        .gte('date', dateDebut).lte('date', dateFin)
        .order('date').order('heure_debut', { nullsFirst: true }),
      supabase.from('personnel_planning_jour')
        .select('personnel_id, date, statut, heure_debut, heure_fin')
        .gte('date', dateDebut).lte('date', dateFin),
    ]);

    for (const r of [machinesRes, personnelRes, competencesRes, machinesPersRes, ordresRes, stocksRes, planningRes, dispoRes]) {
      if (r.error) throw r.error;
    }

    // Avancement d'un OF = part de ses étapes de gamme marquées
    // 'terminé'. Calculé à la volée plutôt que stocké : toujours
    // cohérent avec gammes_operatoires, pas de champ à resynchroniser.
    const ofIds = ordresRes.data.map((o) => o.id);
    let avancementParOf = {};
    if (ofIds.length > 0) {
      const { data: gammes, error: gammesError } = await supabase
        .from('gammes_operatoires')
        .select('of_id, statut')
        .in('of_id', ofIds);
      if (gammesError) throw gammesError;

      const totauxParOf = {};
      gammes.forEach((g) => {
        (totauxParOf[g.of_id] ??= { total: 0, termine: 0 });
        totauxParOf[g.of_id].total += 1;
        if (g.statut === 'terminé') totauxParOf[g.of_id].termine += 1;
      });
      Object.entries(totauxParOf).forEach(([ofId, t]) => {
        avancementParOf[ofId] = t.total > 0 ? Math.round((t.termine / t.total) * 100) : 0;
      });
    }

    const ordresAvecAvancement = ordresRes.data.map((o) => ({
      ...o,
      // Avancement réel (saisies de production, pondéré par les durées) ; à défaut, part d'étapes terminées.
      avancement: Number(o.avancement_pct) > 0 ? Math.round(Number(o.avancement_pct)) : (avancementParOf[o.id] ?? 0),
    }));

    // Regroupe compétences (par opération) et machines précises par personne.
    const competencesParPersonne = {};
    competencesRes.data.forEach((c) => {
      if (!c.operations) return;
      (competencesParPersonne[c.personnel_id] ??= []).push(c.operations.nom);
    });
    const machinesParPersonne = {};
    machinesPersRes.data.forEach((m) => {
      if (!m.machines) return;
      (machinesParPersonne[m.personnel_id] ??= []).push(m.machines.nom);
    });

    const personnelAvecCompetences = personnelRes.data.map((p) => ({
      ...p,
      competences: competencesParPersonne[p.id] || [],
      machines_specifiques: machinesParPersonne[p.id] || [],
    }));

    // Toutes les personnes affectées à chaque créneau (table de liaison,
    // récupérée en même temps que le créneau : pas de longue liste d'identifiants
    // dans l'URL de la requête).
    const planningAvecPersonnel = planningRes.data.map(({ planning_jour_personnel: liens, ...p }) => {
      const ids = (liens || []).map((l) => l.personnel_id);
      return { ...p, personnel_ids: ids.length ? ids : (p.personnel_id ? [p.personnel_id] : []) };
    });

    // Interventions machines non terminées (panne, maintenance, retour constructeur...) et état courant de chaque machine.
    let interventions = [], etatsMachines = {};
    try {
      const INT = require('./lib/interventions');
      const aj = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
      const { data: iv, error: ivE } = await supabase.from('maintenance_machine').select('*').neq('statut', 'terminé');
      if (!ivE) {
        interventions = (iv || []).map((m) => ({ id: m.id, machine_id: m.machine_id, type: m.type, type_libelle: INT.TYPES[m.type] || m.type, date_debut: m.date_debut, date_fin: m.date_fin,
          heure_debut: INT.hh(m.heure_debut), heure_fin: INT.hh(m.heure_fin), bloquant: m.bloquant !== false, description: m.description || '', texte: INT.decrire(m) }));
        etatsMachines = await INT.etatsMachines(supabase, aj);
      }
    } catch (e) { console.warn('interventions machines ignorées :', e.message); }

    return {
      statusCode: 200,
      body: JSON.stringify({
        interventions, etats_machines: etatsMachines,
        machines: machinesRes.data,
        personnel: personnelAvecCompetences,
        ordres: ordresAvecAvancement,
        stocks: stocksRes.data,
        planning: planningAvecPersonnel,
        disponibilites: dispoRes.data, // { personnel_id, date, statut, heure_debut, heure_fin }[]
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
