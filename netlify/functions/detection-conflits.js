// functions/detection-conflits.js
//
// GET /.netlify/functions/detection-conflits?date=2026-09-21
// (date optionnelle — sans paramètre, vérifie les 14 prochains jours)
//
// Détecte deux types de conflit dans planning_jour :
//   1. Une même machine affectée à deux OF différents le même jour
//   2. Une même personne affectée à deux créneaux différents le même jour
// (sur une granularité "jour" ; à affiner si le planning passe un
// jour à une granularité horaire).
//
// Réponse :
// { conflits_machine: [...], conflits_personnel: [...] }

const { getSupabase } = require('./lib/supabaseClient');

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const dateDebut = params.date || new Date().toISOString().slice(0, 10);
    const dateFin = params.date
      ? params.date
      : addDays(dateDebut, 14);

    const supabase = getSupabase();

    const { data: creneaux, error } = await supabase
      .from('planning_jour')
      .select('id, date, machine_id, personnel_id, of_id, statut')
      .gte('date', dateDebut)
      .lte('date', dateFin)
      .neq('statut', 'annulé');
    if (error) throw error;

    const conflitsMachine = groupAndFindConflicts(creneaux, 'machine_id');
    const conflitsPersonnel = groupAndFindConflicts(creneaux, 'personnel_id');

    return {
      statusCode: 200,
      body: JSON.stringify({
        conflits_machine: conflitsMachine,
        conflits_personnel: conflitsPersonnel,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Regroupe les créneaux par (date, clé) et remonte les groupes qui
// contiennent plus d'un OF distinct — c'est-à-dire une vraie
// double affectation, pas juste deux opérations liées au même OF.
function groupAndFindConflicts(creneaux, cle) {
  const groupes = {};
  creneaux.forEach((c) => {
    if (!c[cle]) return;
    const key = `${c.date}__${c[cle]}`;
    if (!groupes[key]) groupes[key] = [];
    groupes[key].push(c);
  });

  const conflits = [];
  Object.entries(groupes).forEach(([key, items]) => {
    const ofDistincts = new Set(items.map((i) => i.of_id));
    if (ofDistincts.size > 1) {
      const [date, id] = key.split('__');
      conflits.push({
        date,
        [cle]: id,
        ofs_en_conflit: Array.from(ofDistincts),
        creneaux_ids: items.map((i) => i.id),
      });
    }
  });
  return conflits;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
