// lib/debut-etape.js
//
// Jour de début le plus tôt d'une étape de gamme, déduit de ses dépendances.
//   - Chaque prédécesseur (colonne predecesseurs ; à défaut l'étape saisie juste
//     avant) doit être planifié, sinon l'étape est « bloquée » par lui.
//   - Type de lien (cumulables, voir contraintesLien) :
//       fin        : après la FIN du prédécesseur ;
//       debut      : dès que le prédécesseur a DÉMARRÉ ;
//       progressif : dès seuil_pct % du prédécesseur réalisé.
//   - Sans dépendance : aujourd'hui (ou le prochain jour ouvré).
// Un jour se termine à l'heure de fin du calendrier : un prédécesseur qui finit
// à 16:30 fait démarrer la suite le lendemain ; s'il finit à 11:00, elle peut
// démarrer le jour même. Week-ends et jours fériés sont sautés.

const PL = require('./planification');

const DEBUT = '08:00';
const FIN = '16:30';
const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

const libelleJour = (dateStr) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${JOURS[d.getUTCDay()]} ${dateStr.slice(8)}/${dateStr.slice(5, 7)}`;
};

function prochainJourOuvre(jourMin) {
  let j = PL.debutDeJour(jourMin);
  for (let i = 0; i < 400 && !PL.estOuvre(j); i++) j += PL.MIN_JOUR;
  return j;
}

// Intervalles [début, fin] (minutes) des lignes de planning d'une étape.
function intervalles(lignes) {
  return (lignes || []).map((l) => {
    const d = PL.enMinutes(l.date, l.heure_debut ? String(l.heure_debut).slice(0, 5) : DEBUT);
    const f = PL.enMinutes(l.date, l.heure_fin ? String(l.heure_fin).slice(0, 5) : FIN);
    return [d, Math.max(d, f)];
  }).sort((a, b) => a[0] - b[0]);
}

function instantProgressif(iv, pct) {
  const total = iv.reduce((t, x) => t + (x[1] - x[0]), 0);
  const cible = total * Math.max(0, Math.min(100, pct)) / 100;
  if (cible <= 0) return iv[0][0];
  let cumul = 0;
  for (const [d, f] of iv) {
    if (cumul + (f - d) >= cible) return d + (cible - cumul);
    cumul += f - d;
  }
  return iv[iv.length - 1][1];
}

async function jourDebutSuggere(supabase, gammeId, aujourdhui) {
  const { data: g, error } = await supabase
    .from('gammes_operatoires').select('id, of_id, sequence, predecesseurs, dependances').eq('id', gammeId).single();
  if (error) throw error;
  const { data: toutes, error: e2 } = await supabase
    .from('gammes_operatoires')
    .select('sequence, statut, operations(nom), planning_jour(date, heure_debut, heure_fin)')
    .eq('of_id', g.of_id);
  if (e2) throw e2;
  const triees = toutes.slice().sort((a, b) => a.sequence - b.sequence);
  const idx = triees.findIndex((e) => e.sequence === g.sequence);
  const requises = Array.isArray(g.predecesseurs) ? g.predecesseurs : (idx > 0 ? [triees[idx - 1].sequence] : []);

  const bloques = []; const raisons = []; let instant = null;
  const nom = (e) => (e.operations && e.operations.nom) || `opération ${e.sequence}`;
  for (const seq of requises) {
    const p = triees.find((e) => e.sequence === seq);
    if (!p || p.sequence === g.sequence) continue;
    const iv = intervalles(p.planning_jour);
    if (!iv.length) {
      if (p.statut === 'à planifier') bloques.push(nom(p));
      continue;                       // déjà faite sans créneau : aucune contrainte
    }
    const c = PL.contraintesLien((g.dependances || {})[seq]);
    const debut = iv[0][0]; const fin = iv[iv.length - 1][1];
    const pct = c.seuil_pct;
    const cands = [];
    if (c.fin) cands.push([fin, `après la fin de « ${nom(p)} »`]);
    if (c.debut) cands.push([debut, `dès le démarrage de « ${nom(p)} »`]);
    if (c.progressif) cands.push([instantProgressif(iv, pct), `dès ${pct} % de « ${nom(p)} »`]);
    cands.forEach(([t, r]) => { raisons.push([t, r]); if (instant === null || t > instant) instant = t; });
  }

  const jourAuj = PL.enMinutes(aujourdhui, '00:00');
  let jour; let raison;
  if (instant === null) {
    jour = prochainJourOuvre(jourAuj);
    raison = bloques.length ? '' : 'aucune dépendance : premier jour ouvré disponible';
  } else {
    const tJour = PL.debutDeJour(instant);
    const apresFermeture = instant - tJour >= PL.hhmm(FIN);
    jour = prochainJourOuvre(Math.max(jourAuj, apresFermeture ? tJour + PL.MIN_JOUR : tJour));
    const dominante = raisons.filter((r) => r[0] === instant).map((r) => r[1]);
    raison = dominante.join(' et ');
  }
  const date = PL.dateDe(jour);
  return { date, libelle: libelleJour(date), raison, bloques };
}

const aujourdhuiParis = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

module.exports = { jourDebutSuggere, aujourdhuiParis, libelleJour };
