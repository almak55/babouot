// functions/affecter-planning.js
//
// POST /.netlify/functions/affecter-planning
// body :
// {
//   gamme_operatoire_id: "uuid",   // l'étape précise à planifier
//   date: "2026-10-06",
//   machine_id: "uuid",
//   personnel_id: "uuid"
// }
//
// Affecte une étape de gamme opératoire à une machine, une personne
// et un jour donnés. Refuse l'affectation (409) si la machine ou la
// personne est déjà prise ce jour-là, ou si la personne est absente.
//
// Réponse : { planning_jour_id } ou { error, conflit: 'machine'|'personnel'|'absence' }

const { getSupabase } = require('./lib/supabaseclient');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    }
    const body = JSON.parse(event.body || '{}');
    const { gamme_operatoire_id, date, machine_id, personnel_id } = body;

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

    const statutOf = gamme.ordres_fabrication ? gamme.ordres_fabrication.statut : null;
    if (statutOf === 'en attente de validation') {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Cet OF est en attente de validation — validez-le avant de l\'affecter au planning.', conflit: 'non_valide' }),
      };
    }

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

    if (personnel_id) {
      // Absence ce jour-là ?
      const { data: absence, error: absError } = await supabase
        .from('personnel_planning_jour')
        .select('statut')
        .eq('personnel_id', personnel_id)
        .eq('date', date)
        .maybeSingle();
      if (absError) throw absError;
      if (absence && (absence.statut === 'absent' || absence.statut === 'congé')) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: 'Cette personne est absente ce jour-là.', conflit: 'absence' }),
        };
      }

      // Déjà affectée ailleurs ce jour-là ?
      const { data: persOccupee, error: persError } = await supabase
        .from('planning_jour')
        .select('id')
        .eq('personnel_id', personnel_id)
        .eq('date', date)
        .neq('statut', 'annulé');
      if (persError) throw persError;
      if (persOccupee.length > 0) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: 'Cette personne est déjà affectée ailleurs ce jour-là.', conflit: 'personnel' }),
        };
      }
    }

    const { data: creneau, error: insertError } = await supabase
      .from('planning_jour')
      .insert({
        date, machine_id, personnel_id: personnel_id || null,
        operation_id: gamme.operation_id,
        gamme_operatoire_id: gamme.id,
        statut: 'planifié',
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    const { error: updateError } = await supabase
      .from('gammes_operatoires')
      .update({ statut: 'planifié', machine_id })
      .eq('id', gamme.id);
    if (updateError) throw updateError;

    return { statusCode: 200, body: JSON.stringify({ planning_jour_id: creneau.id }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
