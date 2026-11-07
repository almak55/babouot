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

module.exports = { CLASSES, CLES_DERIVEES, classeDe, analyser, variables };
