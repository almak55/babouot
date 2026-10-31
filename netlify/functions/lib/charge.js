// lib/charge.js
//
// Calculs de la « vue globale de la charge » (Reporting) : heures d'un créneau, charge d'un jour,
// niveau de progression d'un OF (vert / orange / rouge). Fonctions pures, sans accès à la base.

// Seuils du niveau de progression d'un OF (modifiables ici) :
//   écart = avancement attendu à ce jour (d'après le planning) − avancement réel, en points de pourcentage.
const SEUILS = {
  orange_pts: 10,      // écart > 10 points            -> orange (léger retard)
  rouge_pts: 25,       // écart > 25 points            -> rouge (retard important)
  fin_orange_j: 0,     // fin planifiée après le délai -> orange
  fin_rouge_j: 3,      // fin planifiée > 3 jours après le délai -> rouge
};
const HEURES_JOUR = 8;   // journée de référence (5 j × 8 h = 40 h par semaine), comme la charge du personnel
// Horaires de l'atelier : lun-ven 8h-12h / 12h30-16h30 (8 h) ; heures supplémentaires 7h-12h / 12h30-17h30 (10 h) ;
// samedi exceptionnel 6h-12h (6 h, sans pause). Le dimanche n'est jamais travaillé.

const minutes = (t) => { const [h, m] = String(t).split(':'); return Number(h) * 60 + Number(m || 0); };

// Heures d'un créneau : sans horaire = journée entière ; pause de 12 h 00 à 12 h 30 déduite quand elle est comprise.
function heuresCreneau(c) {
  if (!c || !c.heure_debut || !c.heure_fin) return HEURES_JOUR;
  const d = minutes(c.heure_debut), f = minutes(c.heure_fin);
  const h = (f - d - Math.max(0, Math.min(f, 750) - Math.max(d, 720))) / 60;
  return h > 0 ? h : 0;
}

const jourSemaine = (iso) => new Date(iso + 'T12:00:00Z').getUTCDay();   // 0 = dimanche
const estJourOuvre = (iso) => { const j = jourSemaine(iso); return j >= 1 && j <= 5; };
// Un créneau est « en heures supplémentaires » s'il commence avant 08:00 ou finit après 16:30.
const estHeureSup = (c) => !!c && ((c.heure_debut && String(c.heure_debut).slice(0, 5) < '08:00') || (c.heure_fin && String(c.heure_fin).slice(0, 5) > '16:30'));
// Heures ouvertes un jour d'après ce qui y est planifié (le samedi n'est ouvert que s'il y a du travail planifié).
function heuresOuvertes(iso, creneaux) {
  const j = jourSemaine(iso);
  if (j >= 1 && j <= 5) return (creneaux || []).some(estHeureSup) ? 10 : HEURES_JOUR;
  if (j === 6 && (creneaux || []).length) return 6;
  return 0;
}
const ecartJours = (a, b) => Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000);   // a - b

// Charge d'un jour = le plus élevé de : heures-personnes ÷ capacité de l'équipe, heures-machines ÷ capacité du parc.
function chargeJour({ pers_h, machine_h, cap_pers_h, cap_machine_h }) {
  const a = cap_pers_h > 0 ? pers_h / cap_pers_h : null;
  const b = cap_machine_h > 0 ? machine_h / cap_machine_h : null;
  if (a === null && b === null) return null;
  return Math.max(a === null ? 0 : a, b === null ? 0 : b);
}

// Niveau d'un OF. of = { avancement (0-100), delai (AAAA-MM-JJ|null), creneaux: [{date, heures}], cree_le }
function niveauOf(of, aujourdhui) {
  const avanc = Math.max(0, Math.min(100, Number(of.avancement) || 0));
  const creneaux = of.creneaux || [];
  const total = creneaux.reduce((s, c) => s + c.heures, 0);
  const faitPrevu = creneaux.filter((c) => c.date < aujourdhui).reduce((s, c) => s + c.heures, 0);
  let attendu = null;
  if (total > 0) attendu = Math.round((faitPrevu / total) * 100);
  else if (of.delai && of.cree_le) {
    const debut = String(of.cree_le).slice(0, 10), duree = ecartJours(of.delai, debut);
    attendu = duree > 0 ? Math.max(0, Math.min(100, Math.round((ecartJours(aujourdhui, debut) / duree) * 100))) : (aujourdhui >= of.delai ? 100 : 0);
  }
  const ecart = attendu === null ? 0 : Math.max(0, attendu - avanc);
  const finPrevue = creneaux.length ? creneaux.reduce((m, c) => (c.date > m ? c.date : m), '0000-00-00') : null;
  const delaiDepasse = !!(of.delai && of.delai < aujourdhui && avanc < 100);
  const joursApres = finPrevue && of.delai ? ecartJours(finPrevue, of.delai) : 0;

  let niveau = 'vert', raison = 'Dans les temps';
  if (avanc >= 100) { raison = 'Terminé'; }
  else if (delaiDepasse) { niveau = 'rouge'; raison = `Délai dépassé de ${ecartJours(aujourdhui, of.delai)} j`; }
  else if (ecart > SEUILS.rouge_pts) { niveau = 'rouge'; raison = `Retard important : ${avanc} % réalisé pour ${attendu} % attendu`; }
  else if (joursApres > SEUILS.fin_rouge_j) { niveau = 'rouge'; raison = `Fin planifiée le ${finPrevue.slice(8, 10)}/${finPrevue.slice(5, 7)}, ${joursApres} j après le délai`; }
  else if (ecart > SEUILS.orange_pts) { niveau = 'orange'; raison = `Léger retard : ${avanc} % réalisé pour ${attendu} % attendu`; }
  else if (joursApres > SEUILS.fin_orange_j) { niveau = 'orange'; raison = `Fin planifiée ${joursApres} j après le délai`; }
  return { niveau, raison, attendu, ecart, fin_prevue: finPrevue, heures_planifiees: Math.round(total * 10) / 10 };
}

module.exports = { SEUILS, HEURES_JOUR, heuresCreneau, estJourOuvre, estHeureSup, heuresOuvertes, ecartJours, chargeJour, niveauOf };
