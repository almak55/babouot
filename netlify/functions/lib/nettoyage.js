// lib/nettoyage.js — nettoyage de fin de journée d'une machine.
//
// Règle (voir « Journée de machine » dans planification.js) : une machine qui travaille un jour a UNE mise en route à l'ouverture
// et UN nettoyage de NETTOYAGE_MIN minutes en fin de journée :
//   • les travaux s'arrêtent à (fermeture − durée du nettoyage), soit 16:00 pour une fermeture à 16:30 : le nettoyage démarre alors,
//     même si le dernier travail n'est pas terminé (il continue le lendemain, après la mise en route) ;
//   • si la charge de la machine est terminée plus tôt, le nettoyage suit immédiatement le dernier travail.
// Ces créneaux dépendent de TOUS les travaux du jour (ceux d'autres OF compris) : on les recalcule après chaque écriture du planning
// pour les journées touchées. Le créneau est rattaché au dernier travail du jour ; l'équipe est celle de l'ancien nettoyage, sinon la
// première personne du dernier travail. Seules les journées « en mode journée » (une mise en route posée par le planificateur) sont
// concernées, et seuls les créneaux « planifié » à venir sont modifiés. Jamais bloquant : les appelants ignorent les erreurs.

const PL = require('./planification');
const { decouper } = require('./decoupe');

const MER = /mise en route|\bMER\b/i;
const NET = /nettoyage/i;
const mn = (t) => PL.hhmm(String(t).slice(0, 5));
const hh = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const CAL_DEFAUT = { heure_debut: '08:00', heure_fin: '16:30', pause_debut: '12:00', pause_minutes: 30 };

function calendrier(cal) {
  if (!cal) return CAL_DEFAUT;
  return {
    heure_debut: String(cal.heure_debut || cal.debut || CAL_DEFAUT.heure_debut).slice(0, 5),
    heure_fin: String(cal.heure_fin || cal.fin || CAL_DEFAUT.heure_fin).slice(0, 5),
    pause_debut: String(cal.pause_debut || CAL_DEFAUT.pause_debut).slice(0, 5),
    pause_minutes: Number(cal.pause_minutes ?? CAL_DEFAUT.pause_minutes),
  };
}

// Créneau(x) de nettoyage souhaité(s) pour un jour : [{ d, f }] en minutes, ou null si on ne peut pas le poser ce jour-là.
function nettoyageSouhaite(jobs, date, cal, duree) {
  const fins = jobs.filter((r) => r.heure_fin).map((r) => mn(r.heure_fin));
  if (!fins.length) return null;
  const limite = mn(cal.heure_fin) - duree;
  const debut = Math.min(Math.max(...fins), Math.max(limite, mn(cal.heure_debut)));
  const morceaux = decouper(date, [{ nom: 'Nettoyage', duree_h: duree / 60 }], cal, debut);
  if (!morceaux.length || morceaux.some((m) => m.date !== date)) return null;
  return morceaux.map((m) => ({ d: mn(m.heure_debut), f: mn(m.heure_fin), m }));
}

async function traiterJour(supabase, machineId, date, cal, duree) {
  const { data: rows, error } = await supabase.from('planning_jour').select('*').eq('machine_id', machineId).eq('date', date).neq('statut', 'annulé');
  if (error) throw error;
  const toutes = rows || [];
  const nets = toutes.filter((r) => NET.test(r.phase || ''));
  const jobs = toutes.filter((r) => !NET.test(r.phase || '') && r.heure_debut && r.heure_fin);
  const modifiables = (r) => (r.statut || 'planifié') === 'planifié';
  if (!jobs.length) {
    const sup = nets.filter(modifiables).map((r) => r.id);
    if (sup.length) { const { error: e } = await supabase.from('planning_jour').delete().in('id', sup); if (e) throw e; return { supprimes: sup.length, crees: 0 }; }
    return { supprimes: 0, crees: 0 };
  }
  if (!jobs.some((r) => MER.test(r.phase || ''))) return { supprimes: 0, crees: 0 };   // journée hors modèle : inchangée
  if (nets.some((r) => !modifiables(r))) return { supprimes: 0, crees: 0 };           // nettoyage déjà commencé / terminé : on n'y touche pas
  const voulu = nettoyageSouhaite(jobs, date, cal, duree);
  if (!voulu) return { supprimes: 0, crees: 0 };
  const dernier = jobs.slice().sort((a, b) => mn(b.heure_fin) - mn(a.heure_fin) || mn(b.heure_debut) - mn(a.heure_debut))[0];
  // Déjà en place (mêmes horaires, même travail) : rien à faire.
  const actuels = nets.map((r) => ({ d: mn(r.heure_debut), f: mn(r.heure_fin) })).sort((a, b) => a.d - b.d);
  if (actuels.length === voulu.length && actuels.every((x, i) => x.d === voulu[i].d && x.f === voulu[i].f)
    && nets.every((r) => r.gamme_operatoire_id === dernier.gamme_operatoire_id)) return { supprimes: 0, crees: 0 };

  const ids = toutes.map((r) => r.id);
  const { data: liens, error: lErr } = ids.length ? await supabase.from('planning_jour_personnel').select('planning_jour_id, personnel_id').in('planning_jour_id', ids) : { data: [], error: null };
  if (lErr) throw lErr;
  const equipeDe = (r) => [...new Set([...(r.personnel_id ? [r.personnel_id] : []), ...(liens || []).filter((l) => l.planning_jour_id === r.id).map((l) => l.personnel_id)])];
  const dernierNet = nets.slice().sort((a, b) => mn(b.heure_fin) - mn(a.heure_fin))[0];
  const ancienne = dernierNet ? equipeDe(dernierNet) : [];   // équipe du dernier nettoyage connu ce jour-là
  const equipe = ancienne.length ? ancienne : equipeDe(dernier).slice(0, 1);
  const nom = (nets[0] && nets[0].phase) || 'Nettoyage';

  if (nets.length) { const { error: dErr } = await supabase.from('planning_jour').delete().in('id', nets.map((r) => r.id)); if (dErr) throw dErr; }
  const lignes = voulu.map((v) => ({
    date, heure_debut: v.m.heure_debut, heure_fin: v.m.heure_fin, phase: nom, machine_id: machineId, personnel_id: equipe[0] || null,
    operation_id: dernier.operation_id, gamme_operatoire_id: dernier.gamme_operatoire_id, of_id: dernier.of_id, statut: 'planifié',
    commentaire: null, couleur_code: dernier.couleur_code || null,
  }));
  const { data: crees, error: iErr } = await supabase.from('planning_jour').insert(lignes).select('id');
  if (iErr) throw iErr;
  if (equipe.length) {
    const l = []; (crees || []).forEach((c) => equipe.forEach((pid) => l.push({ planning_jour_id: c.id, personnel_id: pid })));
    const { error: pErr } = await supabase.from('planning_jour_personnel').insert(l); if (pErr) throw pErr;
  }
  return { supprimes: nets.length, crees: (crees || []).length };
}

// cibles : [{ machine_id, date }] (les doublons et les jours passés sont ignorés).
// Calendrier « normal » de la base (ouverture, fermeture, pause) quand l'appelant ne le fournit pas.
async function lireCalendrier(supabase) {
  try {
    const { data, error } = await supabase.from('calendrier_travail').select('*');
    const n = !error && (data || []).find((c) => c.code === 'normal');
    return n ? { heure_debut: n.heure_debut, heure_fin: n.heure_fin, pause_debut: n.pause_debut, pause_minutes: n.pause_minutes } : null;
  } catch (_) { return null; }
}

async function recalerNettoyages(supabase, cibles, calIn) {
  if (!cibles || !cibles.length) return { traites: 0 };
  const cal = calendrier(calIn || await lireCalendrier(supabase));
  const duree = PL.NETTOYAGE_MIN;
  const aujourdhui = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Paris' }).slice(0, 10);
  const vus = new Set(); let traites = 0;
  for (const c of cibles || []) {
    if (!c || !c.machine_id || !c.date || c.date < aujourdhui) continue;
    const cle = `${c.machine_id}|${c.date}`; if (vus.has(cle)) continue; vus.add(cle);
    try { await traiterJour(supabase, c.machine_id, c.date, cal, duree); traites++; }
    catch (e) { console.warn('nettoyage ignoré pour', cle, ':', e.message); }
  }
  return { traites };
}

module.exports = { recalerNettoyages, nettoyageSouhaite, traiterJour };
