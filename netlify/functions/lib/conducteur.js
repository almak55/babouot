// lib/conducteur.js — UN SEUL CONDUCTEUR par machine et par jour.
//
// Règle d'atelier : une machine n'a pas deux conducteurs différents le même jour. Le conducteur prévu le matin conduit aussi
// tous les autres travaux affectés à cette machine ce jour-là (les aides, elles, peuvent varier).
//
// Le conducteur d'une machine un jour = la personne « référente » (personnel_id) du PREMIER créneau de la journée sur cette
// machine (la mise en route compte, le nettoyage non).

const NET = /nettoy/i;
const mn = (t) => { if (!t) return 0; const [h, m] = String(t).slice(0, 5).split(':').map(Number); return h * 60 + (m || 0); };

// Personne référente d'une ligne : personnel_id, sinon la première de planning_jour_personnel (jointure ou liste `liens`).
function referent(l, liens) {
  if (l.personnel_id) return l.personnel_id;
  const j = (l.planning_jour_personnel || []).map((x) => x.personnel_id).filter(Boolean);
  if (j.length) return j[0];
  const k = (liens || []).filter((x) => x.planning_jour_id === l.id).map((x) => x.personnel_id).filter(Boolean);
  return k.length ? k[0] : null;
}

// lignes : créneaux (avec machine_id, date, heure_debut, phase, personnel_id…). Retourne Map « machine|date » -> { personnel_id, ligne }.
function conducteursDuJour(lignes, liens) {
  const out = new Map();
  (lignes || []).filter((l) => l.machine_id && l.date && !NET.test(l.phase || '') && (l.statut || 'planifié') !== 'annulé')
    .slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : mn(a.heure_debut) - mn(b.heure_debut)))
    .forEach((l) => {
      const cle = `${l.machine_id}|${l.date}`;
      if (out.has(cle)) return;
      const p = referent(l, liens);
      if (p) out.set(cle, { personnel_id: p, ligne: l });
    });
  return out;
}

module.exports = { conducteursDuJour, referent };
