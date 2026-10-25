// functions/affecter-planning.js
//
// POST /.netlify/functions/affecter-planning
// body :
// {
//   gamme_operatoire_id: "uuid",   // l'étape précise à planifier
//   date: "2026-10-06",
//   machine_id: "uuid",
//   personnel_ids: ["uuid", ...]   // une ou plusieurs personnes (optionnel)
//   personnel_id: "uuid"           // ancien format, toujours accepté
//   heure_debut?: "HH:MM"          // démarrer le 1er jour à cette heure (étape chiffrée)
// }
//
// Affecte une étape de gamme opératoire à une machine, à UNE ou
// PLUSIEURS personnes, et à un jour donné. Refuse l'affectation (409)
// si la machine est déjà prise ce jour-là, ou si l'une des personnes
// est déjà prise ce jour-là ou absente (le message nomme la personne).
//
// Réponse : { planning_jour_id, personnel_ids } ou
//           { error, conflit: 'machine'|'personnel'|'absence' }

const { getSupabase } = require('./lib/supabaseclient');
const { jourDebutSuggere, aujourdhuiParis } = require('./lib/debut-etape');
const PL = require('./lib/planification');
const { calculerEtapes } = require('./lib/durees');
const { decouper: decouperCommun } = require('./lib/decoupe');

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    }
    const body = JSON.parse(event.body || '{}');
    const { gamme_operatoire_id, machine_id } = body;
    let { date } = body;
    const personnelIds = Array.from(new Set([
      ...(Array.isArray(body.personnel_ids) ? body.personnel_ids : []),
      ...(body.personnel_id ? [body.personnel_id] : []),
    ].filter(Boolean)));

    if (!gamme_operatoire_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'gamme_operatoire_id requis (date facultative : déduite des dépendances ; machine facultative : opération manuelle).' }),
      };
    }
    const machineId = machine_id || null;

    const supabase = getSupabase();

    const { data: gamme, error: gammeError } = await supabase
      .from('gammes_operatoires')
      .select('id, of_id, operation_id, sequence, ordres_fabrication(statut)')
      .eq('id', gamme_operatoire_id)
      .single();
    if (gammeError) throw gammeError;

    // Contrôle du statut de validation de l'OF désactivé pour
    // l'instant (mise en pause demandée) — affectation possible même
    // si l'OF est encore "en attente de validation". `valider-of`
    // reste disponible et fonctionnel, simplement plus bloquant ici.
    // Pour réactiver : décommenter le bloc ci-dessous.
    //
    // const statutOf = gamme.ordres_fabrication ? gamme.ordres_fabrication.statut : null;
    // if (statutOf === 'en attente de validation') {
    //   return {
    //     statusCode: 409,
    //     body: JSON.stringify({ error: 'Cet OF est en attente de validation — validez-le avant de l\'affecter au planning.', conflit: 'non_valide' }),
    //   };
    // }

    await require('./lib/ordre-gamme').normaliserGamme(supabase, gamme.of_id);

    // Respect de l'enchaînement : les opérations dont celle-ci dépend (colonne
    // predecesseurs ; à défaut, l'étape saisie juste avant) doivent déjà être planifiées.
    const { data: toutes, error: precError } = await supabase
      .from('gammes_operatoires')
      .select('sequence, statut, predecesseurs, operations(nom)')
      .eq('of_id', gamme.of_id);
    if (precError) throw precError;
    const triees = toutes.slice().sort((x, y) => x.sequence - y.sequence);
    const moi = triees.find((e) => e.sequence === gamme.sequence);
    const idx = triees.indexOf(moi);
    const requises = (moi && Array.isArray(moi.predecesseurs)) ? moi.predecesseurs : (idx > 0 ? [triees[idx - 1].sequence] : []);
    const precedenteNonPlanifiee = triees.find((e) => requises.includes(e.sequence) && e.statut === 'à planifier');
    if (precedenteNonPlanifiee) {
      const nom = precedenteNonPlanifiee.operations ? precedenteNonPlanifiee.operations.nom : `opération ${precedenteNonPlanifiee.sequence}`;
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: `« ${nom} » doit être planifiée avant cette opération.`,
          conflit: 'sequencement',
        }),
      };
    }

    // Jour de début : automatique (déduit des dépendances) si non précisé ;
    // si précisé trop tôt par rapport aux dépendances, refus sauf `forcer`.
    const suggestion = await jourDebutSuggere(supabase, gamme.id, aujourdhuiParis());
    const dateAuto = !date;
    if (dateAuto) date = suggestion.date;
    else if (date < suggestion.date && !body.forcer && suggestion.raison) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: `Trop tôt : cette opération démarre au plus tôt le ${suggestion.libelle} (${suggestion.raison}).`,
          conflit: 'dependance', date_suggeree: suggestion.date,
        }),
      };
    }

    // Durée réelle de l'étape (chiffrage ou durée manuelle) : le créneau n'occupe que le temps nécessaire,
    // pas une journée entière. Étape non chiffrée : une journée entière, comme avant.
    const calcul = await calculerEtapes(supabase, gamme.of_id);
    const etapeCalc = calcul ? calcul.etapes.find((e) => e.gamme_id === gamme.id) : null;
    const calLigne = calcul ? calcul.calendrier.find((c) => c.code === 'normal') : null;
    const cal = calLigne || { heure_debut: '08:00', heure_fin: '16:30', pause_debut: '12:00', pause_minutes: 30 };
    const phasesEtape = !etapeCalc ? [] : (etapeCalc.duree_manuelle_h !== null && etapeCalc.duree_manuelle_h !== undefined
      ? [{ nom: 'Étape (durée manuelle)', duree_h: Number(etapeCalc.duree_manuelle_h) }]
      : (etapeCalc.phases || []).map((p) => ({ nom: p.nom, duree_h: Number(p.duree_h) })));
    const avecDuree = phasesEtape.some((p) => p.duree_h > 0);

    // Découpe la durée en créneaux horaires à partir de `jourDebut` (pause et jours non ouvrés sautés).
    // heure_debut (facultatif, « HH:MM ») : le 1er jour, on commence à cette heure (ex. dès la fin de la tâche précédente du conducteur).
    let dateDemandee = date;
    let heureDebutMin = /^\d{1,2}:\d{2}/.test(String(body.heure_debut || '')) ? PL.hhmm(String(body.heure_debut).slice(0, 5)) : undefined;
    const decouper = (jourDebut) => decouperCommun(jourDebut, phasesEtape, cal, jourDebut === dateDemandee ? heureDebutMin : undefined);
    const chevauche = (m, ligne) => !ligne.heure_debut || !ligne.heure_fin
      || (PL.hhmm(String(ligne.heure_debut).slice(0, 5)) < PL.hhmm(m.heure_fin) && PL.hhmm(m.heure_debut) < PL.hhmm(String(ligne.heure_fin).slice(0, 5)));

    // Machine déjà prise sur l'un des créneaux ? (heures prises en compte ; une ligne sans heures bloque toute la journée)
    const machineBloquee = async (morceaux) => {
      if (!machineId) return null;
      const dates = Array.from(new Set(morceaux.map((m) => m.date)));
      const { data: prises, error: e1 } = await supabase.from('planning_jour')
        .select('id, date, heure_debut, heure_fin').eq('machine_id', machineId).in('date', dates).neq('statut', 'annulé');
      if (e1) throw e1;
      return morceaux.find((m) => prises.some((p) => p.date === m.date && chevauche(m, p))) || null;
    };

    let morceaux = avecDuree ? decouper(date) : [{ date, heure_debut: null, heure_fin: null, phase: null }];
    if (dateAuto) {
      // Date automatique : si la machine est déjà prise, on avance jusqu'au prochain jour ouvré où elle est libre.
      for (let essai = 0; essai < 60; essai++) {
        const bloc = avecDuree ? await machineBloquee(morceaux) : (machineId ? (await machineBloquee(morceaux)) : null);
        if (!bloc) break;
        let j = PL.enMinutes(date, '00:00') + PL.MIN_JOUR;
        while (!PL.estOuvre(j)) j += PL.MIN_JOUR;
        date = PL.dateDe(j);
        morceaux = avecDuree ? decouper(date) : [{ date, heure_debut: null, heure_fin: null, phase: null }];
      }
    }
    const bloc = await machineBloquee(morceaux);
    if (bloc) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Cette machine est déjà affectée sur ce créneau horaire.', conflit: 'machine' }),
      };
    }

    if (personnelIds.length > 0) {
      const { data: personnes, error: persNomError } = await supabase
        .from('personnel').select('id, nom').in('id', personnelIds);
      if (persNomError) throw persNomError;
      const nomDe = (id) => (personnes.find((p) => p.id === id) || {}).nom || 'Une personne';
      const dates = Array.from(new Set(morceaux.map((m) => m.date)));

      // Absences sur les jours concernés
      const { data: absences, error: absError } = await supabase
        .from('personnel_planning_jour').select('personnel_id, statut, date').in('personnel_id', personnelIds).in('date', dates);
      if (absError) throw absError;
      const absent = absences.find((a) => a.statut === 'absent' || a.statut === 'en arrêt');
      if (absent) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: `${nomDe(absent.personnel_id)} est absent(e) ou en arrêt le ${absent.date.split('-').reverse().slice(0, 2).join('/')}.`, conflit: 'absence' }),
        };
      }

      // Déjà affectées ailleurs sur ces créneaux ? Si c'est le même jour, on enchaîne : l'étape démarre
      // quand la personne a fini sa tâche précédente (si la machine est libre à ce moment-là).
      const fmtJour = (d) => d.split('-').reverse().slice(0, 2).join('/');
      const hhmmDe = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
      for (let essai = 0; essai < 12; essai++) {
        const dates = Array.from(new Set(morceaux.map((m) => m.date)));
        const { data: occupees, error: persError } = await supabase
          .from('planning_jour_personnel')
          .select('personnel_id, planning_jour!inner(id, date, statut, heure_debut, heure_fin, phase, of_id, gamme_operatoire_id)')
          .in('personnel_id', personnelIds)
          .in('planning_jour.date', dates)
          .neq('planning_jour.statut', 'annulé');
        if (persError) throw persError;
        const prise = occupees.find((o) => morceaux.some((m) => o.planning_jour.date === m.date && chevauche(m, o.planning_jour)));
        if (!prise) break;
        const refus = async (motif) => {
          // Détail de la tâche qui gêne, pour comprendre le blocage.
          let detail = '';
          try {
            const pj = prise.planning_jour;
            const { data: ofp } = pj.of_id ? await supabase.from('ordres_fabrication').select('numero').eq('id', pj.of_id).maybeSingle() : { data: null };
            const h = pj.heure_debut ? ` ${String(pj.heure_debut).slice(0, 5)}–${String(pj.heure_fin).slice(0, 5)}` : ' (journée entière)';
            detail = ` [tâche gênante : ${ofp ? ofp.numero : 'OF ?'}${pj.phase ? ' · ' + pj.phase : ''}${h}]`;
          } catch (e) { /* détail facultatif */ }
          return { statusCode: 409, body: JSON.stringify({ error: `${nomDe(prise.personnel_id)} est déjà affecté(e) ailleurs sur ce créneau (${fmtJour(prise.planning_jour.date)})${motif ? ' — ' + motif : ''}${detail}.`, conflit: 'personnel' }) };
        };
        const jour1 = morceaux[0].date;
        if (prise.planning_jour.date !== jour1 || !avecDuree) return await refus('');
        // fin de la dernière tâche qui chevauche, ce jour-là, pour les personnes concernées
        const gênantes = occupees.filter((o) => o.planning_jour.date === jour1 && morceaux.some((m) => m.date === jour1 && chevauche(m, o.planning_jour)));
        if (gênantes.some((o) => !o.planning_jour.heure_fin)) return await refus('sa journée est entièrement réservée');
        const finMin = Math.max(...gênantes.map((o) => PL.hhmm(String(o.planning_jour.heure_fin).slice(0, 5))));
        if (finMin >= PL.hhmm(cal.heure_fin)) return await refus('plus de place ce jour-là');
        dateDemandee = jour1; heureDebutMin = finMin;
        morceaux = decouper(jour1);
        const blocM = await machineBloquee(morceaux);
        if (blocM) return { statusCode: 409, body: JSON.stringify({ error: `${nomDe(prise.personnel_id)} n'est libre qu'à ${hhmmDe(finMin)}, mais la machine est alors déjà occupée.`, conflit: 'machine' }) };
        if (essai === 11) return await refus('');
      }
    }

    const ids = [];
    for (const m of morceaux) {
      const { data: creneau, error: insertError } = await supabase
        .from('planning_jour')
        .insert({
          date: m.date, heure_debut: m.heure_debut, heure_fin: m.heure_fin, phase: m.phase,
          machine_id: machineId, personnel_id: personnelIds[0] || null, // 1re personne = référente (compatibilité)
          of_id: gamme.of_id,
          operation_id: gamme.operation_id,
          gamme_operatoire_id: gamme.id,
          statut: 'planifié',
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      ids.push(creneau.id);
      if (personnelIds.length > 0) {
        const { error: linkError } = await supabase
          .from('planning_jour_personnel')
          .insert(personnelIds.map((pid) => ({ planning_jour_id: creneau.id, personnel_id: pid })));
        if (linkError) throw linkError;
      }
    }

    const { error: updateError } = await supabase
      .from('gammes_operatoires')
      .update({ statut: 'planifié', machine_id: machineId })
      .eq('id', gamme.id);
    if (updateError) throw updateError;

    return { statusCode: 200, body: JSON.stringify({ planning_jour_id: ids[0], planning_jour_ids: ids, personnel_ids: personnelIds, date, creneaux: morceaux }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
