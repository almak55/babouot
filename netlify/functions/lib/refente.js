// lib/refente.js
//
// Refente au massicot droit : nombre de coups de couteau, de piles et TEMPS de coupe, calculés d'après la
// COMPOSITION EXACTE du livre (celle de la fiche de fabrication).
//
// Un livre est fait de cahiers de paginations différentes (4, 8, 16, 32 pages…). Chaque cahier provient d'une
// feuille imprimée qui porte une ou plusieurs « poses » (2 poses de 16 pages, 16 poses de 4 pages…).
// Avant le pliage, la feuille est refendue au massicot droit pour séparer ses poses.
//
// Quantité par cahier = quantité de la commande + passe (10 % par défaut).
// Pour chaque ligne de la composition { pages, cahiers, feuille, poses?, disposition?, parage? } :
//   feuilles = ⌈ quantité par cahier × cahiers de cette pagination ÷ poses ⌉
//   poses    = saisies, sinon calculées d'après le format de la feuille et le format fini (rogné) du livre :
//              le cahier à plat fait (largeur × 2^⌈p/2⌉ ; hauteur × 2^⌊p/2⌋) + rognage, p = nombre de plis ;
//              on cherche le plus grand nombre de cahiers à plat qui tiennent sur la feuille (hors marge)
//   disposition des poses : colonnes × lignes (celle du calcul de poses, sinon la grille la plus carrée)
//   piles    = ⌈ feuilles ÷ feuilles par pile (500 maximum) ⌉
//   1re passe : chaque pile de feuilles reçoit (colonnes − 1) coups de couteau, qui la découpent en bandes
//   2e passe  : les bandes sont regroupées en piles de 500 au plus, chacune reçoit (lignes − 1) coups
//   (on garde le sens de coupe qui demande le moins de coups) ; le parage (rognage des bords) ajoute des coups.
// Temps = coups ÷ cadence (coups/h) + piles × manutention (s) + mise en route (min).

const DEFAUTS = {
  passe_pct: 10,          // % de passe ajouté à la quantité de la commande
  pile_max: 500,          // feuilles par pile au massicot
  rognage_mm: 5,          // surplus de papier par côté du cahier à plat (avant rognage du livre)
  marge_feuille_mm: 10,   // marge perdue sur chaque bord de la feuille (pinces, repères)
  // Temps : valeurs de départ prudentes, à régler au chronomètre sur vos propres livres.
  cadence_h: 200,         // coups de couteau par heure : cycle d'une coupe (butée, serrage, coupe, évacuation) ; production réelle 120 à 300
  manutention_s: 60,      // secondes par pile passée : prise sur palette, taquage, mise en place, évacuation des bandes
  reglage_ligne_min: 5,   // minutes à chaque nouvelle pagination / nouveau format de feuille : butées, programme de coupe
  mise_en_route_min: 10,  // minutes une fois par session de coupe : couteau, préparation de la machine
};
const PILE_MAX_LIMITE = 5000;

// Opérations pour lesquelles le calcul d'après la composition du livre est proposé.
const CODES_OPERATIONS = ['REFENTE', 'REFENTE_MAGASIN'];

// Variables que le moteur de formules peut lire sans qu'on les saisisse : elles sont calculées d'après la composition.
const CLES_DERIVEES = ['refente_coups', 'refente_piles', 'refente_feuilles', 'refente_morceaux'];
const CLE_COMPOSITION = 'composition_cahiers';
const CLE_PILE_MAX = 'feuilles_par_pile';
// Autres caractéristiques du produit lues par le calcul (toutes facultatives).
const CLES_REGLAGES = {
  passe_pct: 'passe_pct', pile_max: 'feuilles_par_pile', rognage_mm: 'rognage_cahier_mm', marge_feuille_mm: 'marge_feuille_mm',
  fini_l: 'format_fini_l_mm', fini_h: 'format_fini_h_mm',
};
// Paramètres propres à l'étape (temps) : numériques.
const CLES_TEMPS = { cadence_h: 'refente_cadence_h', manutention_s: 'refente_manutention_s', reglage_ligne_min: 'refente_reglage_ligne_min', mise_en_route_min: 'refente_mise_en_route_min' };

const nombreOuNull = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const entierPositif = (v) => {
  const n = nombreOuNull(v);
  return n !== null && n > 0 && Math.abs(n - Math.round(n)) < 1e-9 ? Math.round(n) : null;
};
const positifOuDefaut = (v, defaut, { zeroOk = true } = {}) => {
  const n = nombreOuNull(v);
  return n !== null && (zeroOk ? n >= 0 : n > 0) ? n : defaut;
};

// « 650x1000 », « 65 × 100 cm », « 650*1000 mm » -> { l, h } en millimètres ; null si illisible.
function lireFormat(texte) {
  if (texte && typeof texte === 'object') {
    const l = nombreOuNull(texte.l ?? texte.largeur); const h = nombreOuNull(texte.h ?? texte.hauteur);
    return l > 0 && h > 0 ? { l, h } : null;
  }
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(?:mm|cm)?\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm)?\s*$/i.exec(String(texte ?? ''));
  if (!m) return null;
  const k = /cm/i.test(m[3] || '') || /cm/i.test(String(texte)) ? 10 : 1;
  const l = Number(m[1].replace(',', '.')) * k; const h = Number(m[2].replace(',', '.')) * k;
  return l > 0 && h > 0 ? { l, h } : null;
}

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

// Cahier à plat d'une pagination : multiples de la largeur et de la hauteur d'une page (4 p. = 2×1, 8 p. = 2×2, 16 p. = 4×2, 32 p. = 4×4…).
function multiplesPlat(pages) {
  const plis = Math.log2(pages / 2);
  if (!Number.isInteger(plis) || plis < 1) return null;
  return { a: 2 ** Math.ceil(plis / 2), b: 2 ** Math.floor(plis / 2) };
}

// Nombre maximal de cahiers à plat sur la feuille : { poses, colonnes, lignes, plat_l, plat_h } ou null.
function posesAuto({ pages, feuille, fini, rognage, marge }) {
  if (!feuille || !fini) return null;
  const m = multiplesPlat(pages);
  if (!m) return null;
  const SL = feuille.l - 2 * marge; const SH = feuille.h - 2 * marge;
  if (SL <= 0 || SH <= 0) return null;
  let meilleur = null;
  [[m.a, m.b], [m.b, m.a]].forEach(([mw, mh]) => {            // sens de pliage
    const fw = mw * fini.l + 2 * rognage; const fh = mh * fini.h + 2 * rognage;
    [[fw, fh], [fh, fw]].forEach(([w, h]) => {                 // cahier posé tel quel ou tourné sur la feuille
      const c = Math.floor((SL + 1e-9) / w); const r = Math.floor((SH + 1e-9) / h);
      if (c * r > 0 && (!meilleur || c * r > meilleur.poses)) meilleur = { poses: c * r, colonnes: c, lignes: r, plat_l: Math.round(fw * 10) / 10, plat_h: Math.round(fh * 10) / 10 };
    });
  });
  return meilleur;
}

// Réglages du calcul : caractéristiques de l'OF (ou de l'étape) + valeurs par défaut.
//   car = fonction cle -> valeur saisie (ou null)
function reglagesDepuis(car) {
  const g = (k) => (car ? car(CLES_REGLAGES[k]) : null);
  const t = (k) => (car ? car(CLES_TEMPS[k]) : null);
  let pileMax = entierPositif(g('pile_max')) || DEFAUTS.pile_max;
  if (pileMax > PILE_MAX_LIMITE) pileMax = PILE_MAX_LIMITE;
  const l = nombreOuNull(g('fini_l')); const h = nombreOuNull(g('fini_h'));
  return {
    passe_pct: Math.min(100, positifOuDefaut(g('passe_pct'), DEFAUTS.passe_pct)),
    pile_max: pileMax,
    rognage_mm: positifOuDefaut(g('rognage_mm'), DEFAUTS.rognage_mm),
    marge_feuille_mm: positifOuDefaut(g('marge_feuille_mm'), DEFAUTS.marge_feuille_mm),
    fini: l > 0 && h > 0 ? { l, h } : null,
    cadence_h: positifOuDefaut(t('cadence_h'), DEFAUTS.cadence_h, { zeroOk: false }),
    manutention_s: positifOuDefaut(t('manutention_s'), DEFAUTS.manutention_s),
    reglage_ligne_min: positifOuDefaut(t('reglage_ligne_min'), DEFAUTS.reglage_ligne_min),
    mise_en_route_min: positifOuDefaut(t('mise_en_route_min'), DEFAUTS.mise_en_route_min),
  };
}

// Accepte le JSON enregistré sur l'OF (texte ou tableau) ou une saisie à la main « 10x16p/2 ; 2x8p/4 »
// (cahiers × pagination / poses). Retourne { lignes: [{ index, pages, cahiers, feuille, poses|null, disposition|null, parage }], erreurs: [] }.
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
        return m ? { cahiers: Number(m[1]), pages: Number(m[2]), poses: m[3] ? Number(m[3]) : null } : { __illisible: s };
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
    const vide = l.poses === undefined || l.poses === null || String(l.poses).trim() === '';
    const poses = vide ? null : entierPositif(l.poses);
    if (!pages || !cahiers || (!vide && !poses)) { erreurs.push(`Composition, ${num} : pagination, nombre de cahiers et poses doivent être des nombres entiers positifs.`); return; }
    let feuille = null;
    if (l.feuille !== undefined && l.feuille !== null && String(l.feuille).trim() !== '') {
      feuille = lireFormat(l.feuille);
      if (!feuille) erreurs.push(`Composition, ${num} : format de feuille « ${l.feuille} » illisible (exemple : 650x1000 en mm).`);
    }
    let pile = null;
    if (l.pile !== undefined && l.pile !== null && String(l.pile).trim() !== '') {
      pile = entierPositif(l.pile);
      if (!pile) erreurs.push(`Composition, ${num} : feuilles par pile invalides (nombre entier positif attendu) ; valeur générale retenue.`);
    }
    const parageBrut = l.parage === undefined || l.parage === null || String(l.parage).trim() === '' ? 0 : Number(String(l.parage).replace(',', '.'));
    const parage = Number.isFinite(parageBrut) && parageBrut >= 0 && parageBrut <= 4 && Math.abs(parageBrut - Math.round(parageBrut)) < 1e-9 ? Math.round(parageBrut) : 0;
    if (parage !== parageBrut) erreurs.push(`Composition, ${num} : parage (0 à 4 coups) invalide, 0 retenu.`);
    lignes.push({ index: i, pages, cahiers, feuille, poses, pile, disposition: l.disposition ?? null, parage });
  });
  return { lignes, erreurs };
}

// Coups et piles pour UNE ligne, une fois les poses et la grille connues.
function coupesLigne(c, r, parage, feuilles, pileMax) {
  const pilesFeuilles = feuilles > 0 ? Math.ceil(feuilles / pileMax - 1e-9) : 0;
  // Deux sens de coupe possibles : colonnes d'abord (puis lignes) ou l'inverse.
  const sens = (a, b) => {
    const coups1 = pilesFeuilles * (a - 1);
    const bandes = feuilles * a;                                   // bandes obtenues après la 1re passe
    const piles2 = b > 1 ? Math.ceil(bandes / pileMax - 1e-9) : 0; // regroupées en piles de 500 au plus
    return { coups: coups1 + piles2 * (b - 1), piles: (a > 1 ? pilesFeuilles : 0) + piles2 };
  };
  const s1 = sens(c, r); const s2 = sens(r, c);
  const meilleur = (s1.coups < s2.coups || (s1.coups === s2.coups && s1.piles <= s2.piles)) ? s1 : s2;
  // Le parage se fait pendant le passage de la pile de feuilles entières : des coups en plus, pas de nouvelle pile,
  // sauf si la feuille n'a qu'une pose et ne reçoit que du parage (une pile à passer quand même).
  return {
    piles_feuilles: pilesFeuilles,
    coups: meilleur.coups + pilesFeuilles * parage,
    piles: meilleur.piles === 0 && parage > 0 ? pilesFeuilles : meilleur.piles,
  };
}

// brut = valeur de `composition_cahiers` ; exemplaires = quantité de la commande ; reglages = reglagesDepuis(...) (ou { pile_max }) ;
// un nombre en 3e argument est pris pour « feuilles par pile » (ancien appel).
function calculer(brut, exemplaires, reglagesOuPile) {
  const reg = reglagesOuPile && typeof reglagesOuPile === 'object' ? { ...reglagesDepuis(null), ...reglagesOuPile }
    : { ...reglagesDepuis(null), ...(entierPositif(reglagesOuPile) ? { pile_max: Math.min(entierPositif(reglagesOuPile), PILE_MAX_LIMITE) } : {}) };
  const lecture = lireComposition(brut);
  const q = Number(exemplaires);
  const quantiteOk = Number.isFinite(q) && q > 0;
  const base = { reglages: reg, defauts: DEFAUTS, pile_max: reg.pile_max, quantite_commande: quantiteOk ? q : null };
  if (!lecture.lignes.length || !quantiteOk) {
    return { ok: false, erreurs: lecture.erreurs, lignes: [], total: null, cahiers_par_exemplaire: null, quantite_par_cahier: null, ...base };
  }
  const quantiteParCahier = Math.ceil(q * (1 + reg.passe_pct / 100) - 1e-9);
  const erreurs = lecture.erreurs.slice();

  const lignes = lecture.lignes.map((l) => {
    const num = `ligne ${l.index + 1}`;
    const auto = reg.fini && l.feuille ? posesAuto({ pages: l.pages, feuille: l.feuille, fini: reg.fini, rognage: reg.rognage_mm, marge: reg.marge_feuille_mm }) : null;
    let poses; let source;
    if (l.poses) { poses = l.poses; source = 'saisies'; }
    else if (auto) { poses = auto.poses; source = 'calculees'; }
    else {
      poses = 1; source = 'manquantes';
      erreurs.push(`Composition, ${num} (${l.pages} pages) : nombre de poses inconnu — indiquez le format de la feuille et le format fini du livre, ou saisissez les poses (1 pose retenue).`);
    }
    let dispo = dispositionParDefaut(poses);
    if (l.disposition !== null && String(l.disposition).trim() !== '') {
      const d = lireDisposition(l.disposition);
      if (d && d.colonnes * d.lignes === poses) dispo = d;
      else erreurs.push(`Composition, ${num} : la disposition « ${l.disposition} » ne correspond pas à ${poses} pose${poses > 1 ? 's' : ''} ; disposition ${dispo.colonnes}×${dispo.lignes} retenue.`);
    } else if (source === 'calculees' && auto) dispo = { colonnes: auto.colonnes, lignes: auto.lignes };

    const feuilles = Math.ceil((quantiteParCahier * l.cahiers) / poses - 1e-9);
    const pileLigne = l.pile ? Math.min(l.pile, PILE_MAX_LIMITE) : reg.pile_max;
    const c = coupesLigne(dispo.colonnes, dispo.lignes, l.parage, feuilles, pileLigne);
    const tempsH = c.coups / reg.cadence_h + (c.piles * reg.manutention_s) / 3600 + reg.reglage_ligne_min / 60;
    return {
      index: l.index, pages: l.pages, cahiers: l.cahiers, feuille: l.feuille ? `${l.feuille.l}x${l.feuille.h}` : null,
      poses, poses_source: source, poses_auto: auto ? auto.poses : null, pile_max: pileLigne, pile_saisie: !!l.pile,
      plat: auto ? `${auto.plat_l}x${auto.plat_h}` : null,
      disposition: `${dispo.colonnes}x${dispo.lignes}`, parage: l.parage,
      feuilles, piles_feuilles: c.piles_feuilles, coups: c.coups, piles: c.piles, morceaux: feuilles * poses,
      temps_h: tempsH,
    };
  });
  const total = lignes.reduce((t, l) => ({
    feuilles: t.feuilles + l.feuilles, piles: t.piles + l.piles, coups: t.coups + l.coups, morceaux: t.morceaux + l.morceaux,
  }), { feuilles: 0, piles: 0, coups: 0, morceaux: 0 });
  const coupeH = total.coups / reg.cadence_h;
  const manutentionH = (total.piles * reg.manutention_s) / 3600;
  const reglageH = (lignes.length * reg.reglage_ligne_min) / 60;
  const miseEnRouteH = reg.mise_en_route_min / 60;
  return {
    ok: true, erreurs, lignes, total, ...base,
    quantite_par_cahier: quantiteParCahier,
    cahiers_par_exemplaire: lecture.lignes.reduce((s, l) => s + l.cahiers, 0),
    pages_par_exemplaire: lecture.lignes.reduce((s, l) => s + l.cahiers * l.pages, 0),
    temps: { coupe_h: coupeH, manutention_h: manutentionH, reglage_h: reglageH, mise_en_route_h: miseEnRouteH, total_h: coupeH + manutentionH + reglageH + miseEnRouteH },
  };
}

// Valeurs des variables dérivées pour le moteur de formules (null si la composition manque).
function variablesDerivees(brutComposition, exemplaires, reglages) {
  const r = calculer(brutComposition, exemplaires, reglages);
  if (!r.ok) return null;
  return {
    refente_coups: r.total.coups, refente_piles: r.total.piles,
    refente_feuilles: r.total.feuilles, refente_morceaux: r.total.morceaux,
    refente_lignes: r.lignes.length,
    nb_cahiers: r.cahiers_par_exemplaire,
  };
}

// Composition lue par l'IA sur la fiche de fabrication -> caractéristiques de l'OF (composition_cahiers, nb_cahiers, format fini).
// `propres` est l'objet des caractéristiques déjà filtrées ; retourne une note à ajouter aux remarques de la fiche (ou '').
function integrerCompositionFiche(composition, propres, formatFini) {
  const notes = [];
  const fini = lireFormat(formatFini ? { l: formatFini.largeur_mm ?? formatFini.l, h: formatFini.hauteur_mm ?? formatFini.h } : null);
  if (fini) {
    propres[CLES_REGLAGES.fini_l] = fini.l; propres[CLES_REGLAGES.fini_h] = fini.h;
    notes.push(`Format fini lu sur la fiche : ${fini.l} × ${fini.h} mm.`);
  }
  if (Array.isArray(composition) && composition.length) {
    const lecture = lireComposition(composition.map((l) => ({
      pages: l && l.pages, cahiers: l && (l.cahiers ?? l.nb_cahiers), poses: l && l.poses, feuille: l && (l.feuille ?? l.format_feuille), disposition: l && l.disposition,
    })));
    if (lecture.lignes.length) {
      const lignes = lecture.lignes.map((l) => ({
        pages: l.pages, cahiers: l.cahiers,
        ...(l.poses ? { poses: l.poses } : {}), ...(l.feuille ? { feuille: `${l.feuille.l}x${l.feuille.h}` } : {}),
        ...(l.disposition ? { disposition: l.disposition } : {}),
      }));
      propres[CLE_COMPOSITION] = JSON.stringify(lignes);
      const total = lecture.lignes.reduce((t, l) => t + l.cahiers, 0);
      if (propres.nb_cahiers === undefined) propres.nb_cahiers = total;
      notes.push(`Composition lue sur la fiche : ${lecture.lignes.map((l) => `${l.cahiers} cahier${l.cahiers > 1 ? 's' : ''} de ${l.pages} pages`).join(', ')}.`);
      if (lecture.lignes.some((l) => !l.poses)) notes.push('Poses par feuille à déterminer dans le chiffrage (format de la feuille à saisir).');
    }
  }
  return notes.join(' ');
}

module.exports = {
  DEFAUTS, CODES_OPERATIONS, CLES_DERIVEES, CLE_COMPOSITION, CLE_PILE_MAX, CLES_REGLAGES, CLES_TEMPS,
  lireFormat, dispositionParDefaut, lireDisposition, multiplesPlat, posesAuto, reglagesDepuis, lireComposition, calculer, variablesDerivees,
  integrerCompositionFiche,
};
