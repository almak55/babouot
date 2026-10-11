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

exports.handler = async (event) => {
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

    // Date automatique : si la machine est déjà prise ce jour-là, on prend le prochain jour ouvré libre.
    if (dateAuto && machineId) {
      for (let essai = 0; essai < 60; essai++) {
        const { data: prise, error: priseErr } = await supabase
          .from('planning_jour').select('id').eq('machine_id', machineId).eq('date', date).neq('statut', 'annulé');
        if (priseErr) throw priseErr;
        if (!prise.length) break;
        let j = PL.enMinutes(date, '00:00') + PL.MIN_JOUR;
        while (!PL.estOuvre(j)) j += PL.MIN_JOUR;
        date = PL.dateDe(j);
      }
    }

    // Vérifier que la machine est libre ce jour-là.
    const { data: machineOccupee, error: machineError } = machineId ? await supabase
      .from('planning_jour')
      .select('id')
      .eq('machine_id', machineId)
      .eq('date', date)
      .neq('statut', 'annulé') : { data: [], error: null };
    if (machineError) throw machineError;
    if (machineOccupee.length > 0) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Cette machine est déjà affectée ce jour-là.', conflit: 'machine' }),
      };
    }

    if (personnelIds.length > 0) {
      const { data: personnes, error: persNomError } = await supabase
        .from('personnel').select('id, nom').in('id', personnelIds);
      if (persNomError) throw persNomError;
      const nomDe = (id) => (personnes.find((p) => p.id === id) || {}).nom || 'Une personne';

      // Absences ce jour-là
      const { data: absences, error: absError } = await supabase
        .from('personnel_planning_jour')
        .select('personnel_id, statut')
        .in('personnel_id', personnelIds)
        .eq('date', date);
      if (absError) throw absError;
      const absent = absences.find((a) => a.statut === 'absent' || a.statut === 'en arrêt');
      if (absent) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: `${nomDe(absent.personnel_id)} est absent(e) ou en arrêt ce jour-là.`, conflit: 'absence' }),
        };
      }

      // Déjà affectées ailleurs ce jour-là ? (via la table de liaison)
      const { data: occupees, error: persError } = await supabase
        .from('planning_jour_personnel')
        .select('personnel_id, planning_jour!inner(date, statut)')
        .in('personnel_id', personnelIds)
        .eq('planning_jour.date', date)
        .neq('planning_jour.statut', 'annulé');
      if (persError) throw persError;
      if (occupees.length > 0) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: `${nomDe(occupees[0].personnel_id)} est déjà affecté(e) ailleurs ce jour-là.`, conflit: 'personnel' }),
        };
      }
    }

    const { data: creneau, error: insertError } = await supabase
      .from('planning_jour')
      .insert({
        date, machine_id: machineId, personnel_id: personnelIds[0] || null, // 1re personne = référente (compatibilité)
        of_id: gamme.of_id,
        operation_id: gamme.operation_id,
        gamme_operatoire_id: gamme.id,
        statut: 'planifié',
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    if (personnelIds.length > 0) {
      const { error: linkError } = await supabase
        .from('planning_jour_personnel')
        .insert(personnelIds.map((pid) => ({ planning_jour_id: creneau.id, personnel_id: pid })));
      if (linkError) throw linkError;
    }

    const { error: updateError } = await supabase
      .from('gammes_operatoires')
      .update({ statut: 'planifié', machine_id: machineId })
      .eq('id', gamme.id);
    if (updateError) throw updateError;

    return { statusCode: 200, body: JSON.stringify({ planning_jour_id: creneau.id, personnel_ids: personnelIds, date }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
