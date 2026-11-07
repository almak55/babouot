// lib/refente.js
//
// Refente au massicot droit : nombre de coups de couteau et de piles à passer,
// calculés d'après la COMPOSITION EXACTE du livre (celle de la fiche de fabrication).
//
// Un livre est fait de cahiers de paginations différentes (4, 8, 16, 32 pages…).
// Chaque cahier provient d'une feuille imprimée qui porte une ou plusieurs « poses »
// (2 poses de 16 pages sur une feuille, 16 poses de 4 pages…). Avant le pliage, la
// feuille est refendue au massicot droit pour séparer ses poses.
//
// Pour chaque ligne de la composition { pages, cahiers, poses, disposition?, parage? } :
//   feuilles = ⌈ exemplaires × cahiers de cette pagination ÷ poses ⌉
//   disposition des poses sur la feuille : colonnes × lignes (par défaut la grille la plus carrée :
//     2 poses = 2×1, 4 = 2×2, 8 = 4×2, 16 = 4×4…), modifiable (ex. « 8x2 »)
//   piles de feuilles = ⌈ feuilles ÷ feuilles par pile (500 maximum) ⌉
//   1re passe : chaque pile de feuilles reçoit (colonnes − 1) coups de couteau, qui la découpent en bandes
//   2e passe  : les bandes sont regroupées en piles de 500 au plus, chacune reçoit (lignes − 1) coups
//   (on choisit le sens de coupe qui demande le moins de coups) ; le parage (rognage des bords) ajoute
//   des coups sur les piles de feuilles entières.
// Un coup de couteau traverse toute la pile : son temps ne dépend donc pas du nombre de feuilles de la pile
// (seule la manutention d'une pile pleine est plus longue, d'où un temps de manutention par pile à part).

const PILE_MAX_DEFAUT = 500;
const PILE_MAX_LIMITE = 5000;

// Variables que le moteur de formules peut lire sans qu'on les saisisse : elles sont calculées d'après la composition.
const CLES_DERIVEES = ['refente_coups', 'refente_piles', 'refente_feuilles', 'refente_morceaux'];
const CLE_COMPOSITION = 'composition_cahiers';
const CLE_PILE_MAX = 'feuilles_par_pile';

const entierPositif = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 && Math.abs(n - Math.round(n)) < 1e-9 ? Math.round(n) : null;
};

// Grille la plus carrée pour n poses : n = colonnes × lignes avec colonnes ≥ lignes.
function dispositionParDefaut(poses) {
  let lignes = 1;
  for (let d = 1; d * d <= poses; d++) if (poses % d === 0) lignes = d;
  return { colonnes: poses / lignes, lignes };
}

// « 4x2 », « 4 × 2 », « 4*2 » -> { colonnes: 4, lignes: 2 } ; null si illisible.
function lireDisposition(texte) {
  const m = /^\s*(\d+)\s*[x×*]\s*(\d+)\s*$/i.exec(String(texte ?? ''));
  if (!m) return null;
  const c = Number(m[1]); const l = Number(m[2]);
  return c >= 1 && l >= 1 ? { colonnes: c, lignes: l } : null;
}

// Accepte le JSON enregistré sur l'OF (texte ou tableau) ou une saisie à la main « 10x16p/2 ; 2x8p/4 »
// (cahiers × pagination / poses). Retourne { lignes: [{ pages, cahiers, poses, disposition, parage }], erreurs: [] }.
function lireComposition(brut) {
  const erreurs = [];
  let source = brut;
  if (source === null || source === undefined || (typeof source === 'string' && !source.trim())) return { lignes: [], erreurs };
  if (typeof source === 'string') {
    const t = source.trim();
    if (t.startsWith('[') || t.startsWith('{')) {
      try { source = JSON.parse(t); } catch (e) { return { lignes: [], erreurs: ['Composition du livre illisible.'] }; }
    } else {
      source = t.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean).map((s) => {
        const m = /^(\d+)\s*[x×*]\s*(\d+)\s*p?\s*(?:[/@]\s*(\d+))?$/i.exec(s);
        return m ? { cahiers: Number(m[1]), pages: Number(m[2]), poses: m[3] ? Number(m[3]) : 1 } : { __illisible: s };
      });
    }
  }
  if (source && !Array.isArray(source) && Array.isArray(source.lignes)) source = source.lignes;
  if (!Array.isArray(source)) return { lignes: [], erreurs: ['Composition du livre illisible.'] };

  const lignes = [];
  source.forEach((l, i) => {
    const num = `ligne ${i + 1}`;
    if (!l || typeof l !== 'object' || l.__illisible) { erreurs.push(`Composition, ${num} : « ${l && l.__illisible ? l.__illisible : '?'} » illisible.`); return; }
    const pages = entierPositif(l.pages);
    const cahiers = entierPositif(l.cahiers ?? l.nb_cahiers);
    const poses = l.poses === undefined || l.poses === null || String(l.poses).trim() === '' ? 1 : entierPositif(l.poses);
    if (!pages || !cahiers || !poses) { erreurs.push(`Composition, ${num} : pagination, nombre de cahiers et poses doivent être des nombres entiers positifs.`); return; }
    let dispo = dispositionParDefaut(poses);
    if (l.disposition !== undefined && l.disposition !== null && String(l.disposition).trim() !== '') {
      const d = lireDisposition(l.disposition);
      if (d && d.colonnes * d.lignes === poses) dispo = d;
      else erreurs.push(`Composition, ${num} : la disposition « ${l.disposition} » ne correspond pas à ${poses} pose${poses > 1 ? 's' : ''} ; disposition ${dispo.colonnes}×${dispo.lignes} retenue.`);
    }
    const parageBrut = l.parage === undefined || l.parage === null || String(l.parage).trim() === '' ? 0 : Number(String(l.parage).replace(',', '.'));
    const parage = Number.isFinite(parageBrut) && parageBrut >= 0 && parageBrut <= 4 && Math.abs(parageBrut - Math.round(parageBrut)) < 1e-9 ? Math.round(parageBrut) : 0;
    if (parage !== parageBrut) erreurs.push(`Composition, ${num} : parage (0 à 4 coups) invalide, 0 retenu.`);
    lignes.push({ index: i, pages, cahiers, poses, disposition: `${dispo.colonnes}x${dispo.lignes}`, colonnes: dispo.colonnes, lignes_grille: dispo.lignes, parage });
  });
  return { lignes, erreurs };
}

// Nombre de coups et de piles pour UNE ligne de la composition.
function calculerLigne(ligne, exemplaires, pileMax) {
  const { poses, colonnes: c, lignes_grille: r, parage } = ligne;
  const feuilles = Math.ceil((exemplaires * ligne.cahiers) / poses - 1e-9);
  const pilesFeuilles = feuilles > 0 ? Math.ceil(feuilles / pileMax - 1e-9) : 0;

  // Deux sens de coupe possibles : colonnes d'abord (puis lignes) ou l'inverse.
  const sens = (a, b) => {
    const coups1 = pilesFeuilles * (a - 1);
    const bandes = feuilles * a;                                   // bandes obtenues après la 1re passe
    const piles2 = b > 1 ? Math.ceil(bandes / pileMax - 1e-9) : 0; // regroupées en piles de 500 au plus
    const coups2 = piles2 * (b - 1);
    return { coups: coups1 + coups2, piles: (a > 1 ? pilesFeuilles : 0) + piles2 };
  };
  const s1 = sens(c, r); const s2 = sens(r, c);
  const meilleur = (s1.coups < s2.coups || (s1.coups === s2.coups && s1.piles <= s2.piles)) ? s1 : s2;

  // Le parage (rognage des bords) se fait pendant le passage de la pile de feuilles entières : il ajoute des coups, pas de nouvelle pile,
  // sauf si la feuille n'a qu'une pose et ne reçoit que du parage (une pile à passer quand même).
  const coups = meilleur.coups + pilesFeuilles * parage;
  const piles = meilleur.piles === 0 && parage > 0 ? pilesFeuilles : meilleur.piles;
  return {
    index: ligne.index, pages: ligne.pages, cahiers: ligne.cahiers, poses, disposition: ligne.disposition, parage,
    feuilles, piles_feuilles: pilesFeuilles,
    coups, piles,
    morceaux: feuilles * poses,   // cahiers à plat obtenus
  };
}

// brut = valeur de `composition_cahiers` ; exemplaires = quantité de l'étape ; pileMax = feuilles par pile (500 par défaut).
function calculer(brut, exemplaires, pileMax) {
  const lecture = lireComposition(brut);
  let max = entierPositif(pileMax) || PILE_MAX_DEFAUT;
  if (max > PILE_MAX_LIMITE) max = PILE_MAX_LIMITE;
  const q = Number(exemplaires);
  const exemplairesOk = Number.isFinite(q) && q > 0;
  if (!lecture.lignes.length || !exemplairesOk) {
    return { ok: false, erreurs: lecture.erreurs, lignes: [], pile_max: max, total: null, cahiers_par_exemplaire: null };
  }
  const lignes = lecture.lignes.map((l) => calculerLigne(l, q, max));
  const total = lignes.reduce((t, l) => ({
    feuilles: t.feuilles + l.feuilles, piles: t.piles + l.piles, coups: t.coups + l.coups, morceaux: t.morceaux + l.morceaux,
  }), { feuilles: 0, piles: 0, coups: 0, morceaux: 0 });
  return {
    ok: true, erreurs: lecture.erreurs, lignes, pile_max: max, total,
    cahiers_par_exemplaire: lecture.lignes.reduce((s, l) => s + l.cahiers, 0),
    pages_par_exemplaire: lecture.lignes.reduce((s, l) => s + l.cahiers * l.pages, 0),
  };
}

// Valeurs des variables dérivées pour le moteur de formules (null si la composition manque).
function variablesDerivees(brutComposition, exemplaires, pileMax) {
  const r = calculer(brutComposition, exemplaires, pileMax);
  if (!r.ok) return null;
  return {
    refente_coups: r.total.coups, refente_piles: r.total.piles,
    refente_feuilles: r.total.feuilles, refente_morceaux: r.total.morceaux,
    nb_cahiers: r.cahiers_par_exemplaire,
  };
}

// Composition lue par l'IA sur la fiche de fabrication -> caractéristiques de l'OF (composition_cahiers, nb_cahiers).
// `propres` est l'objet des caractéristiques déjà filtrées ; retourne une note à ajouter aux remarques de la fiche (ou '').
function integrerCompositionFiche(composition, propres) {
  if (!Array.isArray(composition) || !composition.length) return '';
  const lecture = lireComposition(composition.map((l) => ({
    pages: l && l.pages, cahiers: l && (l.cahiers ?? l.nb_cahiers), poses: l && l.poses, disposition: l && l.disposition,
  })));
  if (!lecture.lignes.length) return '';
  const lignes = lecture.lignes.map((l) => ({ pages: l.pages, cahiers: l.cahiers, poses: l.poses, ...(l.disposition !== `${dispositionParDefaut(l.poses).colonnes}x${dispositionParDefaut(l.poses).lignes}` ? { disposition: l.disposition } : {}) }));
  propres[CLE_COMPOSITION] = JSON.stringify(lignes);
  const total = lecture.lignes.reduce((t, l) => t + l.cahiers, 0);
  if (propres.nb_cahiers === undefined) propres.nb_cahiers = total;
  const sansPoses = composition.some((l) => !l || l.poses === null || l.poses === undefined || String(l.poses).trim() === '');
  return `Composition lue sur la fiche : ${lecture.lignes.map((l) => `${l.cahiers} cahier${l.cahiers > 1 ? 's' : ''} de ${l.pages} pages`).join(', ')}.${sansPoses ? ' Poses par feuille non indiquées : à vérifier dans le chiffrage (1 pose par défaut).' : ''}`;
}

module.exports = {
  integrerCompositionFiche,
  PILE_MAX_DEFAUT, CLES_DERIVEES, CLE_COMPOSITION, CLE_PILE_MAX,
  dispositionParDefaut, lireDisposition, lireComposition, calculerLigne, calculer, variablesDerivees,
};
