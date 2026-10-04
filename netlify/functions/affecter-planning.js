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

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    }
    const body = JSON.parse(event.body || '{}');
    const { gamme_operatoire_id, date, machine_id } = body;
    const personnelIds = Array.from(new Set([
      ...(Array.isArray(body.personnel_ids) ? body.personnel_ids : []),
      ...(body.personnel_id ? [body.personnel_id] : []),
    ].filter(Boolean)));

    if (!gamme_operatoire_id || !date || !machine_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'gamme_operatoire_id, date et machine_id sont requis.' }),
      };
    }

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

    // Respect du séquencement : les étapes précédentes de la même
    // gamme doivent déjà être planifiées à une date <= celle demandée.
    const { data: etapesPrecedentes, error: precError } = await supabase
      .from('gammes_operatoires')
      .select('sequence, statut, planning_jour(date)')
      .eq('of_id', gamme.of_id)
      .lt('sequence', gamme.sequence);
    if (precError) throw precError;

    const precedenteNonPlanifiee = etapesPrecedentes.find((e) => e.statut === 'à planifier');
    if (precedenteNonPlanifiee) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: `L'étape ${precedenteNonPlanifiee.sequence} de cette gamme doit être planifiée avant celle-ci.`,
          conflit: 'sequencement',
        }),
      };
    }

    // Vérifier que la machine est libre ce jour-là.
    const { data: machineOccupee, error: machineError } = await supabase
      .from('planning_jour')
      .select('id')
      .eq('machine_id', machine_id)
      .eq('date', date)
      .neq('statut', 'annulé');
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
        date, machine_id, personnel_id: personnelIds[0] || null, // 1re personne = référente (compatibilité)
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
      .update({ statut: 'planifié', machine_id })
      .eq('id', gamme.id);
    if (updateError) throw updateError;

    return { statusCode: 200, body: JSON.stringify({ planning_jour_id: creneau.id, personnel_ids: personnelIds }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
