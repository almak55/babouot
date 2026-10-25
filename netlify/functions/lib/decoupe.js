// lib/decoupe.js
//
// Découpe la durée d'une étape en créneaux horaires dans les plages de travail du calendrier
// (pause sautée, week-ends et jours fériés sautés). Partagé par affecter-planning et proposer-affectation.
//
// decouper(jourDebut 'AAAA-MM-JJ', phases [{nom, duree_h}], cal {heure_debut, heure_fin, pause_debut, pause_minutes}, debutMin?)
//   debutMin : minute de la journée (ex. 600 = 10:00) à partir de laquelle commencer le premier jour (défaut : ouverture).
// -> [{ date, heure_debut:'HH:MM', heure_fin:'HH:MM', phase }]

const PL = require('./planification');

const hh = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function decouper(jourDebut, phases, cal, debutMin) {
  const dMin = PL.hhmm(cal.heure_debut), fMin = PL.hhmm(cal.heure_fin);
  const pD = PL.hhmm(cal.pause_debut), pF = pD + Number(cal.pause_minutes);
  const fenetres = [[dMin, pD], [pF, fMin]];
  let jour = PL.debutDeJour(PL.enMinutes(jourDebut, '00:00'));
  while (!PL.estOuvre(jour)) jour += PL.MIN_JOUR;
  // Premier jour : on saute les plages déjà écoulées.
  let f = 0, curseur = fenetres[0][0];
  if (Number.isFinite(debutMin) && debutMin > dMin) {
    while (f < fenetres.length && fenetres[f][1] <= debutMin) f++;
    if (f >= fenetres.length) { f = 0; jour += PL.MIN_JOUR; while (!PL.estOuvre(jour)) jour += PL.MIN_JOUR; curseur = fenetres[0][0]; }
    else curseur = Math.max(debutMin, fenetres[f][0]);
  }
  const morceaux = [];
  for (const ph of phases) {
    let reste = Math.round(ph.duree_h * 60), garde = 0;
    while (reste > 0 && garde++ < 2000) {
      if (f >= fenetres.length) { f = 0; jour += PL.MIN_JOUR; while (!PL.estOuvre(jour)) jour += PL.MIN_JOUR; curseur = fenetres[0][0]; }
      const [wd, wf] = fenetres[f];
      if (curseur < wd) curseur = wd;
      if (curseur >= wf) { f++; if (f < fenetres.length) curseur = fenetres[f][0]; continue; }
      const pris = Math.min(reste, wf - curseur);
      morceaux.push({ date: PL.dateDe(jour), heure_debut: hh(curseur), heure_fin: hh(curseur + pris), phase: ph.nom });
      curseur += pris; reste -= pris;
    }
  }
  return morceaux;
}

module.exports = { decouper };
