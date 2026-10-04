// functions/detection-conflits.js
//
// GET /.netlify/functions/detection-conflits?date=2026-09-21
// (date optionnelle — sans paramètre, vérifie les 14 prochains jours)
//
// Détecte deux types de conflit dans planning_jour :
//   1. Une même machine occupée par deux OF différents aux MÊMES HEURES
//   2. Une même personne affectée à deux OF différents aux MÊMES HEURES
// Une ligne sans heures (affectation "journée entière") occupe toute la
// journée : elle est en conflit avec toute autre ligne ce jour-là.
// Deux tâches successives sur la même machine le même jour (ex: 08:00-10:00
// puis 10:00-14:00) ne sont PAS un conflit.
//
// Réponse :
// { conflits_machine: [...], conflits_personnel: [...] }

const { getSupabase } = require('./lib/supabaseclient');

const minutes = (t) => { const [h, m] = String(t).split(':'); return Number(h) * 60 + Number(m); };
// Intervalle d'une ligne en minutes dans la journée ; sans heures = journée entière.
const plage = (c) => (c.heure_debut && c.heure_fin
  ? { d: minutes(c.heure_debut), f: minutes(c.heure_fin) }
  : { d: 0, f: 1440 });
const seChevauchent = (a, b) => a.d < b.f && b.d < a.f;

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const dateDebut = params.date || new Date().toISOString().slice(0, 10);
    const dateFin = params.date ? params.date : addDays(dateDebut, 14);

    const supabase = getSupabase();

    const { data: creneaux, error } = await supabase
      .from('planning_jour')
      .select('id, date, heure_debut, heure_fin, machine_id, personnel_id, of_id, statut, planning_jour_personnel(personnel_id)')
      .gte('date', dateDebut)
      .lte('date', dateFin)
      .neq('statut', 'annulé');
    if (error) throw error;

    // Une entrée par (créneau, personne) : une tâche peut avoir plusieurs personnes.
    const parPersonne = [];
    creneaux.forEach((c) => {
      const ids = new Set((c.planning_jour_personnel || []).map((l) => l.personnel_id));
      if (c.personnel_id) ids.add(c.personnel_id);
      ids.forEach((pid) => parPersonne.push({ ...c, personnel_id: pid }));
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        conflits_machine: trouverConflits(creneaux, 'machine_id'),
        conflits_personnel: trouverConflits(parPersonne, 'personnel_id'),
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Regroupe par (date, ressource) et remonte les paires de lignes d'OF
// DIFFÉRENTS dont les heures se chevauchent.
function trouverConflits(creneaux, cle) {
  const groupes = {};
  creneaux.forEach((c) => {
    if (!c[cle]) return;
    (groupes[`${c.date}__${c[cle]}`] ??= []).push(c);
  });

  const conflits = [];
  Object.entries(groupes).forEach(([key, items]) => {
    const ofs = new Set();
    const ids = new Set();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]; const b = items[j];
        if (a.of_id === b.of_id) continue;
        if (seChevauchent(plage(a), plage(b))) {
          ofs.add(a.of_id); ofs.add(b.of_id); ids.add(a.id); ids.add(b.id);
        }
      }
    }
    if (ofs.size > 0) {
      const [date, id] = key.split('__');
      conflits.push({ date, [cle]: id, ofs_en_conflit: Array.from(ofs), creneaux_ids: Array.from(ids) });
    }
  });
  return conflits;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
