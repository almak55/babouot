// lib/lots.js
//
// Règle des « lots minimum » : certaines machines ne se mettent en route que si la journée regroupe un minimum d'exemplaires.
// Règle actuelle (Ateliers Babouot) : montage de couvertures Pléiade (BDM) et pressure en colle des OF Pléiade = au moins
// 3 500 exemplaires par journée de machine, tous titres confondus.
//
//   • un titre qui n'atteint pas ce minimum à lui seul n'est PAS planifié seul : il attend que d'autres titres soient prêts ;
//   • un titre non terminé n'est pas reporté automatiquement au lendemain : sa suite attend elle aussi un lot complet ;
//   • les titres prêts sont regroupés sur une même journée, par ordre de priorité, sans dépasser ce que la machine peut faire
//     en une journée (mise en route + réglages + roulage, nettoyage de fin de journée réservé).
//
// Règles complémentaires (migration 57), réglables par ligne de `regles_lot` :
//   • titres_min          : nombre minimum de titres DIFFÉRENTS lancés ensemble le premier jour du lot (BDM : 2 — on ne démarre pas la
//                           machine pour un seul titre, même s'il dépasse à lui seul le minimum d'exemplaires) ;
//   • limite_demarrage    : heure au-delà de laquelle la machine n'est plus démarrée (BDM : 12:30) ; le travail est reporté au
//                           lendemain à l'ouverture. Une machine déjà démarrée le matin continue normalement l'après-midi.
//
// Les règles viennent de la table `regles_lot` (migration 54) ; sans cette table, les règles ci-dessous s'appliquent.
// Les saisies manuelles (« Affecter un OF ») ne sont jamais bloquées par cette règle.

const PL = require('./planification');

const REGLES_DEFAUT = [
  { operation_code: 'MONTAGE_COUVERTURE_PLEAIDE', type_production: 'pleiade', quantite_min: 3500, titres_min: 2, limite_demarrage: '12:30' },
  { operation_code: 'MONTAGE_COUVERTURE_PLEIADE', type_production: 'pleiade', quantite_min: 3500, titres_min: 2, limite_demarrage: '12:30' },
  { operation_code: 'PRESSURE_COLLE', type_production: 'pleiade', quantite_min: 3500, titres_min: 1, limite_demarrage: null },
];

// 'HH:MM' -> minutes depuis minuit (null si absent ou invalide).
function minutesDuJour(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v <= 24 * 60 ? v : null;
}

// Table facultative : absente -> règles par défaut ; présente -> uniquement les lignes actives (table vide = règle désactivée).
async function chargerRegles(supabase) {
  try {
    const { data, error } = await supabase.from('regles_lot').select('*');   // « * » : fonctionne aussi avant la migration 57 (colonnes titres_min / limite_demarrage absentes)
    if (error || !Array.isArray(data)) return REGLES_DEFAUT.slice();
    return data
      .map((r) => ({
        actif: r.actif, operation_code: r.operation_code ? String(r.operation_code) : '', type_production: r.type_production || null,
        quantite_min: Math.max(0, Number(r.quantite_min) || 0),
        titres_min: Math.max(1, parseInt(r.titres_min, 10) || 1),
        limite_demarrage: minutesDuJour(r.limite_demarrage) !== null ? String(r.limite_demarrage).slice(0, 5) : null,
      }))
      .filter((r) => r.actif !== false && r.operation_code && (r.quantite_min > 0 || r.titres_min > 1 || r.limite_demarrage))
      .map(({ actif, ...r }) => r);
  } catch (e) {
    return REGLES_DEFAUT.slice();
  }
}

// Règle applicable à une opération d'un OF (null = aucune).
function regleDe(regles, operationCode, typeProduction) {
  const candidates = (regles || []).filter((r) => r.operation_code === operationCode && (!r.type_production || r.type_production === typeProduction));
  return candidates.find((r) => r.type_production) || candidates[0] || null;   // la règle propre au type de production l'emporte sur la règle générale
}

// Fenêtres de travail d'un jour : ouverture et minutes de travail disponibles (nettoyage de fin de journée réservé).
function jourMachine(jour, cal) {
  if (!PL.estOuvre(jour, cal)) return null;
  const fen = PL.fenetresDuJour(jour, cal);
  if (!fen.length) return null;
  const minutes = fen.reduce((t, [a, b]) => t + (b - a), 0) - PL.NETTOYAGE_MIN;
  return { ouverture: fen[0][0], capacite_min: Math.max(0, minutes) };
}

// Minutes de travail écoulées entre l'ouverture du jour D et l'instant `pret` (0 si déjà prêt ; journée entière si `pret` est après la fermeture).
function decalage(D, pret, cal) {
  let t = 0;
  for (const [a, b] of PL.fenetresDuJour(D, cal)) {
    if (pret >= b) t += b - a;
    else { if (pret > a) t += pret - a; break; }
  }
  return t;
}

// Déroulé jour par jour d'une SUITE de titres entiers, enchaînés dans l'ordre à partir du jour `depart` (même modèle que le moteur :
// une mise en route par jour, réglage de chaque titre, roulage, nettoyage de fin de journée réservé ; un titre qui déborde continue
// le lendemain sans nouveau réglage). Renvoie [{ jour, qte }] : exemplaires traités chaque jour.
function derouler(suite, depart, cal) {
  const jours = [];
  let k = 0; let reste = null;   // reste : minutes de roulage restantes du titre en cours
  let D = depart;
  for (let garde = 0; garde < 400 && k < suite.length; garde++, D += PL.MIN_JOUR) {
    const J = jourMachine(D, cal);
    if (!J) continue;
    let utilise = Math.max(...suite.slice(k).map((i) => i.mer_min || 0).concat(0)); let qte = 0;
    const titresDuJour = new Set();   // titres réellement fabriqués ce jour-là
    while (k < suite.length) {
      const it = suite[k];
      if (reste === null) {
        utilise = Math.max(utilise, decalage(D, it.pret || 0, cal));      // la machine attend que le titre soit prêt
        if (utilise + (it.regl_min || 0) + 1 > J.capacite_min) break;   // plus de place pour son réglage : demain
        utilise += it.regl_min || 0; reste = it.roulage_min || 0;
      }
      const dispo = J.capacite_min - utilise;
      if (dispo <= 0) break;
      const pris = Math.min(dispo, reste);
      qte += it.roulage_min > 0 ? it.qte * pris / it.roulage_min : it.qte;
      if (pris > 0) titresDuJour.add(k);
      utilise += pris; reste -= pris;
      if (reste <= 1e-9) { k++; reste = null; }
    }
    if (qte > 0) jours.push({ jour: D, qte: Math.round(qte), nb_titres: titresDuJour.size });
  }
  return jours;
}

// Forme les lots d'UNE opération. Fonction pure.
//   items      : [{ cle, qte, pret (minutes), mer_min, regl_min, roulage_min, rang, ... }] — titres en attente, prêts à partir de `pret`
//   joursPris  : Set de débuts de jour (minutes) où la machine a déjà un lot de cette opération
//   apartir    : premier instant possible (minutes)
//   min        : quantité minimale par journée
// Un lot est une suite de titres entiers (par priorité) lancés ensemble à l'ouverture du jour T, choisie la plus longue possible pour
// que CHAQUE journée de la suite atteigne `min` (un titre qui déborde sur le lendemain compte dans le total du lendemain). Si aucune
// suite ne convient, personne ne démarre : les titres attendent qu'un autre titre devienne prêt.
// Un titre rejoint la journée T s'il est prêt assez tôt pour être traité ce jour-là (la machine l'attend, ce temps compte dans la journée).
// Renvoie { lots: [{ jour, depart, membres: [item…], jours: [{ jour, qte }], total }], attente: [item…] }.
function formerLots({ items, joursPris, apartir, min, cal, titresMin }) {
  const tMin = Math.max(1, Number(titresMin) || 1);   // ne jamais démarrer la machine pour moins de titres que cela (1er jour du lot)
  const pris = new Set(joursPris || []);
  let restants = items.slice().sort((a, b) => (a.rang - b.rang) || (a.pret - b.pret) || String(a.cle).localeCompare(String(b.cle)));
  const lots = [];
  if (!restants.length) return { lots, attente: [] };
  let T = PL.debutDeJour(Math.max(apartir || 0, Math.min(...restants.map((i) => i.pret))));
  for (let garde = 0; garde < 800 && restants.length; garde++) {
    const J = jourMachine(T, cal);
    if (!J || pris.has(T) || J.ouverture < (apartir || 0)) { T += PL.MIN_JOUR; continue; }
    const prets = restants.filter((i) => decalage(T, i.pret, cal) + 1 < J.capacite_min);
    let choix = null;
    for (let n = prets.length; n >= tMin; n--) {
      const suite = prets.slice(0, n);
      const jours = derouler(suite, T, cal);
      if (jours.length && jours[0].nb_titres >= tMin && jours.every((x) => x.qte >= min) && jours.every((x) => !pris.has(x.jour))) { choix = { suite, jours }; break; }
    }
    if (choix) {
      lots.push({ jour: T, depart: J.ouverture, membres: choix.suite, jours: choix.jours, total: choix.jours.reduce((t, x) => t + x.qte, 0) });
      restants = restants.filter((i) => !choix.suite.includes(i));
      choix.jours.forEach((x) => pris.add(x.jour));
      T = choix.jours[choix.jours.length - 1].jour + PL.MIN_JOUR;
      continue;
    }
    // Pas assez de titres prêts : on attend le prochain titre qui devient prêt (jour suivant son arrivée).
    const futurs = restants.filter((i) => !prets.includes(i));
    if (!futurs.length) break;
    const prochain = Math.min(...futurs.map((i) => i.pret));
    T = Math.max(T + PL.MIN_JOUR, PL.debutDeJour(prochain));
  }
  return { lots, attente: restants };
}

module.exports = { REGLES_DEFAUT, minutesDuJour, chargerRegles, regleDe, jourMachine, decalage, derouler, formerLots };
