// lib/pliage.js
//
// Pliage (plieuse à margeur, ex. MBO) : quantités qui servent aux temps de réglage et de chargement, d'après la
// COMPOSITION EXACTE du livre (celle de la fiche de fabrication, voir lib/refente.js).
//
// Règles de l'atelier :
//   - chargement du margeur : feuilles à plier ÷ cadence de chargement (ex. 20 000 feuilles/h : 5 000 feuilles = 15 min) ;
//   - mise en place des modules de la machine (empileurs, sorties de poches…) : une fois au début de l'OF
//     (= « mise en route » du profil de la machine) ;
//   - réglage de la plieuse : une fois au début de chaque SÉRIE de cahiers de même pagination, selon la pagination
//     (4 p, 8 p, 16 p, 32 p) — valeurs du profil de la machine ;
//   - cahiers suivants de la même pagination : un simple ajustement du pli (5 min par cahier).
//   Exemple : 10 cahiers de 16 pages = 1 réglage « 16 pages » (45 min) + 9 ajustements (9 × 5 min).
//
// Les valeurs ne sont pas écrites ici : elles viennent du profil de la machine (phases_standard). Ce module ne fait que
// COMPTER (feuilles, séries par pagination, ajustements) pour le moteur de formules.

const CLASSES = [4, 8, 16, 32];                       // paginations qui ont leur propre réglage
// Une pagination intermédiaire (ex. 12 pages) prend le réglage de la pagination supérieure (16) ; au-delà de 32 : celui de 32.
const classeDe = (pages) => CLASSES.find((c) => pages <= c) || CLASSES[CLASSES.length - 1];

const CLES_DERIVEES = ['pliage_feuilles', 'pliage_cahiers', 'pliage_series', 'pliage_ajustements', ...CLASSES.map((c) => `pliage_series_${c}`)];

// lignes : [{ pages, cahiers }] (composition lue) ; quantiteParCahier : quantité de la commande + passe.
function analyser(lignes, quantiteParCahier) {
  const parPages = new Map();
  (lignes || []).forEach((l) => parPages.set(l.pages, (parPages.get(l.pages) || 0) + l.cahiers));
  const series = Array.from(parPages.entries()).sort((a, b) => a[0] - b[0]).map(([pages, cahiers]) => ({
    pages, classe: classeDe(pages), cahiers, ajustements: cahiers - 1,
  }));
  const parClasse = Object.fromEntries(CLASSES.map((c) => [c, series.filter((s) => s.classe === c).length]));
  const cahiers = series.reduce((t, s) => t + s.cahiers, 0);
  return {
    feuilles: quantiteParCahier * cahiers,           // feuilles passées dans le margeur (une par cahier plié, passe comprise)
    cahiers, series, series_par_classe: parClasse,
    ajustements: series.reduce((t, s) => t + s.ajustements, 0),
    hors_classe: series.filter((s) => !CLASSES.includes(s.pages)).map((s) => s.pages),
  };
}

// Variables pour le moteur de formules.
function variables(p) {
  return {
    pliage_feuilles: p.feuilles, pliage_cahiers: p.cahiers, pliage_series: p.series.length, pliage_ajustements: p.ajustements,
    ...Object.fromEntries(CLASSES.map((c) => [`pliage_series_${c}`, p.series_par_classe[c]])),
  };
}

// ---- Temps de la plieuse -------------------------------------------------------------------------------------
// Valeurs de départ = celles de l'atelier (MBO). Une valeur saisie sur l'étape prime ; sinon celle du profil de la machine
// (phases « Réglage de la plieuse… », « Ajustement du pli… », « Chargement du margeur ») ; sinon la valeur de départ.
const DEFAUTS = {
  modules_min: 30,                                  // mise en place des modules (empileurs, sorties de poches…) : une fois au début de l'OF
  margeur_cadence_h: 20000,                         // feuilles chargées par heure dans le margeur
  reglage_min: { 4: 15, 8: 30, 16: 45, 32: 60 },    // réglage au début de chaque série de cahiers de même pagination
  ajustement_min: 5,                                // ajustement du pli pour chaque cahier suivant de la même pagination
};
const CLES_TEMPS = {
  modules_min: 'pliage_modules_min', margeur_cadence_h: 'pliage_margeur_cadence_h', ajustement_min: 'pliage_ajustement_min',
  ...Object.fromEntries(CLASSES.map((c) => [`reglage_${c}_min`, `pliage_reglage_${c}_min`])),
};
// Noms des phases du profil machine (profils-machine.js) et du calcul : à garder identiques.
const NOM_MARGEUR = 'Chargement du margeur';
const NOM_AJUSTEMENT = 'Ajustement du pli (cahiers suivants)';
const nomReglage = (c) => `Réglage de la plieuse — cahiers de ${c} pages`;

const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
// Pliage de cahiers (et non pliage de gardes, qui a sa propre règle).
const estPliage = (code, nom) => (/plia|pliu/.test(norm(nom)) || /^pli/.test(norm(code))) && !/garde/.test(norm(nom)) && !/garde/.test(norm(code));

const positif = (v) => { if (v === null || v === undefined || String(v).trim() === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null; };
// lire(cle) : valeur saisie sur l'étape (ou l'OF) ; profil : valeurs lues dans les phases du profil machine { modules_min?, ... }.
function reglagesDepuis(lire, profil) {
  const p = profil || {};
  const r = { sources: {} };
  Object.keys(CLES_TEMPS).forEach((k) => {
    const saisie = lire ? positif(lire(CLES_TEMPS[k])) : null;
    const dUnProfil = positif(p[k]);
    const defaut = k.startsWith('reglage_') ? DEFAUTS.reglage_min[Number(k.split('_')[1])] : DEFAUTS[k];
    if (saisie !== null && !(k === 'margeur_cadence_h' && saisie === 0)) { r[k] = saisie; r.sources[k] = 'étape'; }
    else if (dUnProfil !== null && !(k === 'margeur_cadence_h' && dUnProfil === 0)) { r[k] = dUnProfil; r.sources[k] = 'profil'; }
    else { r[k] = defaut; r.sources[k] = 'départ'; }
  });
  return r;
}

module.exports = {
  CLASSES, CLES_DERIVEES, classeDe, analyser, variables,
  DEFAUTS, CLES_TEMPS, NOM_MARGEUR, NOM_AJUSTEMENT, nomReglage, estPliage, reglagesDepuis,
};
