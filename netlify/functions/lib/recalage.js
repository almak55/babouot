// lib/recalage.js
//
// Avancement réel d'un OF et recalage automatique du planning en cas de retard.
//
//  - avancementOf       : % global = moyenne des % d'étapes pondérée par leur durée chiffrée.
//  - recalerSiRetard    : pour une étape en retard (avancement réel < avancement prévu à la fin
//                         de la journée saisie), replanifie la part restante de l'étape et celles
//                         de toutes les étapes qui en dépendent, à partir du jour ouvré suivant.
//                         Les créneaux passés sont conservés ; un retard ne fait jamais « avancer »
//                         le planning (les avances ne décalent rien).

const { calculerEtapes } = require('./durees');
const PL = require('./planification');

const TOLERANCE_PCT = 2;     // écart toléré entre prévu et réalisé avant de parler de retard
const MIN_PAUSE = 30;

const hm = (t) => { const [h, m] = String(t).slice(0, 5).split(':'); return Number(h) * 60 + Number(m); };
const dureeCreneau = (c) => {
  if (!c.heure_debut || !c.heure_fin) return 480;
  const d = hm(c.heure_debut), f = hm(c.heure_fin);
  // pause 12h00-12h30 : seule la part qui chevauche la plage est déduite
  return Math.max(0, f - d - Math.max(0, Math.min(f, 720 + MIN_PAUSE) - Math.max(d, 720)));
};
const jourSuivant = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10);
};

// Étapes qui dépendent (directement ou non) de `sequence`. predecesseurs null = étape précédente.
function descendants(etapes, sequence) {
  const tri = etapes.slice().sort((a, b) => a.sequence - b.sequence);
  const preds = (e, i) => (Array.isArray(e.predecesseurs) ? e.predecesseurs : (i > 0 ? [tri[i - 1].sequence] : []));
  const out = new Set([sequence]);
  let change = true;
  while (change) {
    change = false;
    tri.forEach((e, i) => { if (!out.has(e.sequence) && preds(e, i).some((p) => out.has(p))) { out.add(e.sequence); change = true; } });
  }
  out.delete(sequence);
  return tri.filter((e) => out.has(e.sequence));
}

// Minutes de travail restant sur une étape dont `ratioFait` (0..1) est réalisé.
function minutesRestantes(etape, ratioFait) {
  const reste = Math.max(0, 1 - ratioFait);
  if (etape.duree_manuelle_h !== null && etape.duree_manuelle_h !== undefined) return Math.round(Number(etape.duree_manuelle_h) * 60 * reste);
  return Math.round(etape.phases.reduce((t, p) => {
    const m = p.duree_h * 60;
    if (ratioFait <= 0) return t + m;
    if (p.type_calcul === 'fixe') return t + (/nettoy/i.test(p.nom) ? m : (/mise en route|r[ée]glage|\bMER\b/i.test(p.nom) ? 0 : m));
    return t + m * reste;
  }, 0));
}

async function avancementOf(supabase, ofId) {
  const calcul = await calculerEtapes(supabase, ofId);
  if (!calcul) return null;
  const { data: gammes, error } = await supabase.from('gammes_operatoires').select('id, statut, avancement_pct').eq('of_id', ofId);
  if (error) throw error;
  const parId = Object.fromEntries(gammes.map((g) => [g.id, g]));
  let poids = 0, somme = 0;
  const lignes = calcul.etapes.map((e) => {
    const g = parId[e.gamme_id] || {};
    const pct = g.statut === 'terminé' ? 100 : Number(g.avancement_pct || 0);
    const w = e.total_h > 0 ? e.total_h : 0;
    poids += w; somme += w * pct;
    return { e, pct, w };
  });
  const moyenneSimple = lignes.length ? lignes.reduce((s, l) => s + l.pct, 0) / lignes.length : 0;
  const global = poids > 0 ? somme / poids : moyenneSimple;
  const tousTermines = gammes.length > 0 && gammes.every((g) => g.statut === 'terminé');
  return { global: Math.round(global * 10) / 10, tous_termines: tousTermines, calcul };
}

async function majAvancementOf(supabase, ofId) {
  const av = await avancementOf(supabase, ofId);
  if (!av) return null;
  const { data: of } = await supabase.from('ordres_fabrication').select('statut').eq('id', ofId).single();
  const maj = { avancement_pct: av.tous_termines ? 100 : av.global };
  if (av.tous_termines) maj.statut = 'terminé';
  else if (of && of.statut === 'terminé') maj.statut = 'en cours';   // une correction a rouvert une étape
  else if (av.global > 0 && of && ['planifié', 'validé', 'en attente de validation'].includes(of.statut)) maj.statut = 'en cours';
  const { error } = await supabase.from('ordres_fabrication').update(maj).eq('id', ofId);
  if (error) throw error;
  return { ...maj };
}

// Retard constaté sur les étapes `gammeIds` à la fin de la journée `date`.
async function recalerSiRetard(supabase, ofId, date, gammeIds, planifierHandler) {
  const calcul = await calculerEtapes(supabase, ofId);
  if (!calcul) return null;
  const etapes = calcul.etapes;
  const { data: gammes, error: gErr } = await supabase.from('gammes_operatoires').select('id, statut, avancement_pct').eq('of_id', ofId);
  if (gErr) throw gErr;
  const g = Object.fromEntries(gammes.map((x) => [x.id, x]));
  const ids = etapes.map((e) => e.gamme_id);
  const { data: creneaux, error: cErr } = await supabase.from('planning_jour')
    .select('id, gamme_operatoire_id, date, heure_debut, heure_fin, statut').in('gamme_operatoire_id', ids).neq('statut', 'annulé');
  if (cErr) throw cErr;

  const retards = [];
  gammeIds.forEach((gid) => {
    const e = etapes.find((x) => x.gamme_id === gid);
    if (!e || !g[gid] || g[gid].statut === 'terminé') return;
    const siens = creneaux.filter((c) => c.gamme_operatoire_id === gid);
    const total = siens.reduce((s, c) => s + dureeCreneau(c), 0);
    const fait = siens.filter((c) => c.date <= date).reduce((s, c) => s + dureeCreneau(c), 0);
    const prevuRestant = total - fait;                       // minutes de travail encore planifiées après la journée
    const prevu = total > 0 ? (fait / total) * 100 : 0;
    const reel = Number(g[gid].avancement_pct || 0);
    // Travail restant réellement à faire (mise en route / réglage déjà faits dès qu'il y a eu de la production).
    const besoin = minutesRestantes(e, reel / 100);
    // Retard : il reste plus à faire que ce qui est encore planifié.
    if (besoin > prevuRestant + Math.max(15, 0.02 * (total || besoin))) {
      retards.push({ gamme_id: gid, sequence: e.sequence, operation: e.operation, prevu_pct: Math.round(prevu), reel_pct: Math.round(reel), minutes_manquantes: Math.round(besoin - prevuRestant) });
    }
  });
  if (!retards.length) return { retard: false, retards: [] };

  // Étapes à reprendre : celles en retard + toutes leurs dépendantes non terminées.
  const aReprendre = new Map();
  const restant = {};
  retards.forEach((r) => {
    aReprendre.set(r.gamme_id, true);
    restant[r.gamme_id] = Math.max(0, 1 - r.reel_pct / 100);
    descendants(etapes, r.sequence).forEach((d) => {
      if (g[d.gamme_id] && g[d.gamme_id].statut !== 'terminé') {
        aReprendre.set(d.gamme_id, true);
        const pctD = Number(g[d.gamme_id].avancement_pct || 0);
        if (pctD > 0 && restant[d.gamme_id] === undefined) restant[d.gamme_id] = Math.max(0, 1 - pctD / 100);
      }
    });
  });
  const reprise = Array.from(aReprendre.keys());
  const ancienneFin = creneaux.filter((c) => reprise.includes(c.gamme_operatoire_id))
    .map((c) => `${c.date}T${c.heure_fin ? String(c.heure_fin).slice(0, 5) : '23:59'}`).sort().pop() || null;

  const depuis = `${jourSuivant(date)}T00:00`;
  const rep = await planifierHandler({
    httpMethod: 'POST',
    body: JSON.stringify({
      of_id: ofId, mode: 'avant', appliquer: true,
      etapes_a_replanifier: reprise, restant, depuis, debut_souhaite: depuis, maintenant: depuis,
      lots_report: true,   // la suite d'un titre non terminé (BDM, pressure en colle Pléiade) attend un lot de 3 500 : pas de report automatique au lendemain
    }),
  });
  const data = JSON.parse(rep.body);
  if (rep.statusCode !== 200) {
    return { retard: true, retards, applique: false, raison: data.error || 'Recalage impossible', bloquants: data.bloquants || [], ancienne_fin: ancienneFin };
  }
  return {
    retard: true, retards, applique: true,
    etapes_decalees: data.etapes.filter((x) => !x.fixe).map((x) => ({ operation: x.operation, debut: x.debut, fin: x.fin })),
    ancienne_fin: ancienneFin,
    nouvelle_fin: data.resume.fin,
    delai: data.resume.delai || (calcul.of.delai || null),
    delai_tenu: data.resume.respecte_delai,
    retard_delai_min: data.resume.retard_min,
    alternative_heures_sup: data.alternative_heures_sup,
    attente_lot: data.attente_lot || [],   // suites en attente d'un lot minimum (non reportées au lendemain)
  };
}

module.exports = { descendants, avancementOf, majAvancementOf, recalerSiRetard, dureeCreneau, TOLERANCE_PCT };
