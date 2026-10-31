// lib/horaires.js
//
// Règle d'atelier, non négociable : QUELS QUE SOIENT LES HORAIRES (normaux 8h-12h / 12h30-16h30, heures supplémentaires
// 7h-12h / 12h30-17h30, samedi…), la pause déjeuner est TOUJOURS de 12h00 à 12h30. Aucune production dans ce créneau.
// Les heures d'ouverture et de fermeture restent lues dans la table calendrier_travail ; la pause, elle, est imposée ici
// pour qu'une valeur erronée en base (ou saisie à la main) ne puisse plus décaler les plannings.

const PAUSE_DEBUT = '12:00';
const PAUSE_MINUTES = 30;

// Renvoie une copie de la ligne de calendrier avec la pause imposée (les autres champs sont conservés tels quels).
function imposerPause(ligne) {
  if (!ligne) return ligne;
  return { ...ligne, pause_debut: PAUSE_DEBUT, pause_minutes: PAUSE_MINUTES };
}

module.exports = { imposerPause, PAUSE_DEBUT, PAUSE_MINUTES };
