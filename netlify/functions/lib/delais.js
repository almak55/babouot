// lib/delais.js
//
// Délais d'attente entre opérations (séchage de la colle…) et quantités de réparation calculées par ratio.
// Les deux sont portés par le modèle de gamme (table pleiade_gamme_modele, migration 51) :
//   delais : { "<code de l'étape attendue>": { min_h: 24 } }   -> cette étape ne peut pas démarrer avant
//            (fin de l'étape attendue + min_h heures, en heures réelles, week-end compris)
//   ratio  : { seuil, taux_sous, taux_au_dela }                 -> quantité de l'étape = % de la quantité de l'OF
//            (taux_sous si quantité < seuil, sinon taux_au_dela)
// Le modèle est rapproché des opérations de l'OF par code/nom (mêmes clés que les liens « en ligne »).
// Si la migration 51 n'est pas faite, rien ne change (aucun délai, aucun ratio).

async function charger(supabase) {
  try {
    const { data, error } = await supabase.from('pleiade_gamme_modele').select('code, operation_code, delais, ratio');
    if (error || !data) return [];
    return data;
  } catch (_) { return []; }
}

const nombre = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

// La ligne du modèle qui correspond à une opération de l'OF (ou null).
function ligneDe(modele, regles, opCode, opNom) {
  const EL = require('./en-ligne');
  const cles = regles.cles ? regles.cles(opCode) : [EL.baseCode(opCode)];
  if (opNom && EL.cleNom(opNom) && !cles.includes('N:' + EL.cleNom(opNom))) cles.push('N:' + EL.cleNom(opNom));
  return modele.find((r) => (regles.cles ? regles.cles(r.operation_code) : [EL.baseCode(r.operation_code)]).some((k) => cles.includes(k))) || null;
}

// Quantité à traiter d'après le ratio de la ligne du modèle : { quantite, taux, detail } ou null.
// Règle intégrée : le pliage de gardes traite 2 gardes par ouvrage (une de chaque côté) → quantité = 2 × celle de l'OF.
// Exprimée comme un ratio de 200 % sans seuil, pour suivre exactement le même circuit que les réparations (affichage, valeur
// corrigeable à la main, retour à l'automatique). Un ratio saisi dans le modèle pour cette opération reste prioritaire.
const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const estPliageGardes = (code, nom) => /plia|pliu/.test(norm(nom)) && /garde/.test(norm(nom)) || /^pliage_gardes/.test(norm(code));
const RATIO_PLIAGE_GARDES = { seuil: 0, taux_sous: 200, taux_au_dela: 200 };

// Ratio applicable à l'opération : celui du modèle, sinon la règle intégrée (ou null).
function ratioDe(modele, regles, opCode, opNom) {
  const ligne = ligneDe(modele, regles, opCode, opNom);
  if (ligne && ligne.ratio) return ligne.ratio;
  return estPliageGardes(opCode, opNom) ? RATIO_PLIAGE_GARDES : null;
}

function quantiteParRatio(modele, regles, opCode, opNom, quantiteOf) {
  const r = ratioDe(modele, regles, opCode, opNom);
  const q = nombre(quantiteOf);
  if (!r || q === null || q <= 0) return null;
  const seuil = nombre(r.seuil); const sous = nombre(r.taux_sous); const au = nombre(r.taux_au_dela);
  if (seuil === null || sous === null || au === null) return null;
  const taux = q < seuil ? sous : au;
  const quantite = Math.max(1, Math.ceil(q * taux / 100 - 1e-9));
  const detail = r === RATIO_PLIAGE_GARDES
    ? `2 × ${q} ex. (une garde de chaque côté de l'ouvrage) = ${quantite} ex. à plier`
    : `${taux} % de ${q} ex. (${q < seuil ? 'moins' : 'au moins'} de ${seuil}) = ${quantite} ex. à réparer`;
  return { quantite, taux, regle: { seuil, taux_sous: sous, taux_au_dela: au }, detail };
}

// Délais minimaux par étape : { [sequence]: { [sequence de l'étape attendue]: minutes } }.
// gammes : [{ sequence, predecesseurs (null = étape précédente), operation_code, operation }].
// Seules les étapes attendues qui sont des ANCÊTRES de l'étape comptent (sinon l'ordre de traitement n'est pas garanti).
function delaisMinimaux(modele, regles, gammes) {
  const tri = gammes.slice().sort((a, b) => a.sequence - b.sequence);
  const predsDe = new Map(tri.map((g, i) => [g.sequence, Array.isArray(g.predecesseurs) ? g.predecesseurs : (i > 0 ? [tri[i - 1].sequence] : [])]));
  const ancetres = (s) => { const out = new Set(); const pile = [...(predsDe.get(s) || [])]; while (pile.length) { const p = pile.pop(); if (out.has(p)) continue; out.add(p); (predsDe.get(p) || []).forEach((x) => pile.push(x)); } return out; };
  const EL = require('./en-ligne');
  const clesDe = (code, nom) => { const ks = regles.cles ? regles.cles(code) : [EL.baseCode(code)]; if (nom && EL.cleNom(nom) && !ks.includes('N:' + EL.cleNom(nom))) ks.push('N:' + EL.cleNom(nom)); return ks; };
  const out = {};
  tri.forEach((g) => {
    const ligne = ligneDe(modele, regles, g.operation_code, g.operation);
    if (!ligne || !ligne.delais || typeof ligne.delais !== 'object') return;
    const anc = ancetres(g.sequence);
    Object.entries(ligne.delais).forEach(([codeAttendu, d]) => {
      const h = nombre(d && d.min_h);
      const attendue = modele.find((r) => r.code === codeAttendu);
      if (!attendue || h === null || h <= 0) return;
      const ks = clesDe(attendue.operation_code);
      tri.forEach((x) => {
        if (x.sequence === g.sequence || !anc.has(x.sequence)) return;
        if (!clesDe(x.operation_code, x.operation).some((k) => ks.includes(k))) return;
        out[g.sequence] = out[g.sequence] || {};
        out[g.sequence][x.sequence] = Math.max(out[g.sequence][x.sequence] || 0, Math.round(h * 60));
      });
    });
  });
  return out;
}

module.exports = { charger, ligneDe, ratioDe, quantiteParRatio, delaisMinimaux };
