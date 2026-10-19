// lib/dependances.js
// Étapes d'un OF qui ne peuvent pas être déclarées terminées : celles qui dépendent « entièrement »
// (lien « attendre la fin ») d'une étape précédente non terminée.
const { contraintesLien } = require('./planification');

// gammes : lignes gammes_operatoires de l'OF { id, sequence, statut, predecesseurs, dependances, operations(nom) }
// Retourne { [gamme_id]: [noms des étapes précédentes non terminées] } (uniquement les étapes bloquées).
function etapesBloquees(gammes) {
  const tri = [...gammes].sort((a, b) => a.sequence - b.sequence);
  const parSeq = new Map(tri.map((g) => [g.sequence, g]));
  const out = {};
  tri.forEach((g, i) => {
    const preds = Array.isArray(g.predecesseurs) ? g.predecesseurs : (i > 0 ? [tri[i - 1].sequence] : []);
    const dep = g.dependances || {};
    const bloquants = [];
    preds.forEach((seq) => {
      const p = parSeq.get(Number(seq));
      if (!p || p.statut === 'terminé') return;
      const c = contraintesLien(dep[seq] ?? dep[String(seq)]);
      if (c.fin) bloquants.push((p.operations && p.operations.nom) || `étape ${seq}`);
    });
    if (bloquants.length) out[g.id] = bloquants;
  });
  return out;
}

module.exports = { etapesBloquees };
