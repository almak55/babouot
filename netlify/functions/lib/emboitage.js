// lib/emboitage.js
//
// Règle « emboîtage par défaut » appliquée à la lecture d'une fiche de fabrication.
// L'emboîtage figure souvent absent de la fiche alors qu'il est nécessaire dès qu'il y a une pose de tranchefile et/ou
// de signet ET des opérations de finition (pose de jaquettes, mise en étuis, mise en caisses et palettes…) :
//   - OF cartonnés : l'opération « Emboîtage cartonnés » est ajoutée à la gamme ;
//   - OF Pléiade (ou coffret) : l'opération « Emboîtage Pléiade » est toujours ajoutée.
// Rien n'est ajouté si la gamme contient déjà une opération d'emboîtage. Les opérations sont reconnues par leur NOM
// (catalogue des opérations), la proposition reste modifiable à l'écran avant la création de l'OF.

const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const estEmboitage = (o) => /emboitage/.test(norm(o.nom)) && !/repar|control/.test(norm(o.nom));
const estSigneTranchefile = (o) => /signet|tranchefil/.test(norm(o.nom));
const estFinition = (o) => /jaquette|caisse|palette|etui|conditionnement|finition|rhodoid|sous film/.test(norm(o.nom)) && !/rainage/.test(norm(o.nom));

// Opération d'emboîtage à ajouter (ou null si le catalogue n'en a pas de convenable).
function emboitageDe(operations, pleiade) {
  const embs = operations.filter(estEmboitage);
  const est = (o, mot) => norm(o.nom).includes(mot) || norm(o.code).includes(mot);
  if (pleiade) return embs.find((o) => est(o, 'pleiade')) || null;
  return embs.find((o) => est(o, 'cartonn')) || embs.filter((o) => !est(o, 'pleiade'))[0] || null;
}

// codes : codes d'opérations lus sur la fiche ; retourne { codes, ajoute: { code, nom, raison } | null, signes }.
//   signes : { ts, fin, emb } = tranchefile/signet présent, finition présente, emboîtage présent (sert à fusionner les pages d'une même fiche).
function completer(codes, operations, opts) {
  const ops = operations || [];
  const parCode = new Map(ops.map((o) => [o.code, o]));
  const lues = (codes || []).map((c) => parCode.get(c)).filter(Boolean);
  const signes = { ts: lues.some(estSigneTranchefile), fin: lues.some(estFinition), emb: lues.some(estEmboitage) };
  const type = opts && opts.type_production;
  const pleiade = type === 'pleiade' || type === 'coffret';
  const res = { codes: (codes || []).slice(), ajoute: null, signes, emboitage_code: null };
  const cible = emboitageDe(ops, pleiade);
  res.emboitage_code = cible ? cible.code : null;
  if (!cible || signes.emb) return res;
  const declenche = pleiade || (signes.ts && signes.fin);
  if (!declenche) return res;
  // Position : avant la première finition, mais après la pose de tranchefile / signets.
  const liste = res.codes.map((c) => parCode.get(c));
  let pos = liste.findIndex((o) => o && estFinition(o)); if (pos < 0) pos = liste.length;
  let dernierSigne = -1; liste.forEach((o, i) => { if (o && estSigneTranchefile(o)) dernierSigne = i; });
  if (dernierSigne >= pos) pos = dernierSigne + 1;
  res.codes.splice(pos, 0, cible.code);
  res.ajoute = { code: cible.code, nom: cible.nom, raison: pleiade ? 'OF Pléiade : l\'emboîtage fait toujours partie de la gamme' : 'tranchefile / signet et opérations de finition sur la fiche' };
  res.signes.emb = true;
  return res;
}

module.exports = { completer, emboitageDe, estEmboitage, estSigneTranchefile, estFinition };
