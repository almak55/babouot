// lib/mutualisation.js — une seule mise en route et un seul nettoyage par journée et par machine.
//
// Pour les opérations cochées « Mutualiser mise en route et nettoyage » (operations.mutualiser_mer_net), quand plusieurs travaux
// se suivent sur la même machine le même jour : seul le PREMIER travail garde sa mise en route, seul le DERNIER garde son nettoyage ;
// chaque travail garde son réglage et sa production. Les travaux suivants sont ramenés au plus tôt (derrière le précédent) quand
// c'est possible (machine, personnel, dépendances de l'OF).
//
// Les phases retirées sont mémorisées dans planning_jour.phases_retirees : si le premier ou le dernier travail du jour est déplacé
// ou supprimé, la phase est rétablie au bon endroit. Le calcul est idempotent : le relancer ne change rien tant que le planning ne bouge pas.
// Jamais bloquant : toute erreur est ignorée par les appelants (le planning reste tel quel).

const PL = require('./planification');
const { decouper } = require('./decoupe');

const MER = /mise en route|\bMER\b/i;
const NET = /nettoyage/i;
const estMer = (p) => MER.test(p || '');
const estNet = (p) => NET.test(p || '');
const mn = (t) => PL.hhmm(String(t).slice(0, 5));
const hh = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const CAL_DEFAUT = { heure_debut: '08:00', heure_fin: '16:30', pause_debut: '12:00', pause_minutes: 30 };

async function lireCalendrier(supabase) {
  const { data, error } = await supabase.from('calendrier_travail').select('*');
  const n = !error && (data || []).find((c) => c.code === 'normal');
  return n ? { heure_debut: String(n.heure_debut).slice(0, 5), heure_fin: String(n.heure_fin).slice(0, 5), pause_debut: String(n.pause_debut).slice(0, 5), pause_minutes: Number(n.pause_minutes) } : CAL_DEFAUT;
}
// Minutes de travail entre a et b (même jour), pause déduite.
function travailEntre(a, b, cal) {
  if (b <= a) return 0;
  const pD = mn(cal.pause_debut), pF = pD + Number(cal.pause_minutes);
  return (b - a) - Math.max(0, Math.min(b, pF) - Math.max(a, pD));
}
// Recule de `travail` minutes de travail depuis `depuis` ; null si on sortirait de la journée.
function reculer(depuis, travail, cal) {
  const dMin = mn(cal.heure_debut), pD = mn(cal.pause_debut), pF = pD + Number(cal.pause_minutes);
  const fen = [[dMin, pD], [pF, mn(cal.heure_fin)]];
  let cur = depuis, reste = travail;
  for (let i = fen.length - 1; i >= 0 && reste > 0; i--) {
    const [ws, we] = fen[i];
    if (cur <= ws) continue;
    if (cur > we) cur = we;
    const pris = Math.min(reste, cur - ws); cur -= pris; reste -= pris;
  }
  return reste > 0 ? null : cur;
}
const chevauche = (a, b) => a.d < b.f && b.d < a.f;

// Regroupe les créneaux d'une étape en phases successives : [{ nom, min }]
function phasesDe(rows) {
  const out = [];
  rows.slice().sort((a, b) => mn(a.heure_debut) - mn(b.heure_debut)).forEach((r) => {
    const m = mn(r.heure_fin) - mn(r.heure_debut);
    const der = out[out.length - 1];
    if (der && der.nom === (r.phase || null)) der.min += m; else out.push({ nom: r.phase || null, min: m });
  });
  return out;
}
const memes = (a, b) => a.length === b.length && a.every((x, i) => x.nom === b[i].nom && x.min === b[i].min);

async function colonnesPretes(supabase) {
  const { error } = await supabase.from('planning_jour').select('phases_retirees').limit(1);
  const { error: e2 } = await supabase.from('operations').select('mutualiser_mer_net').limit(1);
  return !error && !e2;
}

async function operationsMutualisees(supabase) {
  const { data, error } = await supabase.from('operations').select('id').eq('mutualiser_mer_net', true);
  return error ? new Set() : new Set((data || []).map((o) => o.id));
}

async function liensDe(supabase, ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabase.from('planning_jour_personnel').select('planning_jour_id, personnel_id').in('planning_jour_id', ids.slice(i, i + 150));
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

// Étapes (une par étape de gamme, dans l'ordre horaire) avec les phases actuelles, retirées et cibles.
function construireEtapes(candidates, date, ctx) {
  const parCle = new Map();
  candidates.forEach((r) => { const k = r.gamme_operatoire_id || `${r.of_id}|${r.operation_id}`; (parCle.get(k) || parCle.set(k, []).get(k)).push(r); });
  const etapes = [...parCle.entries()].map(([cle, rs]) => {
    const debut = Math.min(...rs.map((r) => mn(r.heure_debut))), fin = Math.max(...rs.map((r) => mn(r.heure_fin)));
    const fixe = date < ctx.aujourdhui || rs.some((r) => (r.statut || 'planifié') !== 'planifié') || (date === ctx.aujourdhui && debut < ctx.maintenantMin);
    return { cle, rows: rs, debut, fin, fixe, actives: phasesDe(rs), retirees: [] };
  }).sort((a, b) => a.debut - b.debut || String(a.cle).localeCompare(String(b.cle)));
  etapes.forEach((e) => {
    const vus = new Map();
    e.rows.forEach((r) => (Array.isArray(r.phases_retirees) ? r.phases_retirees : []).forEach((p) => { if (p && p.nom && !vus.has(p.nom)) vus.set(p.nom, { nom: p.nom, min: Number(p.min) }); }));
    e.retirees = [...vus.values()];
  });

  // Rôles : premier travail du jour = mise en route ; dernier = nettoyage.
  const n = etapes.length;
  etapes.forEach((e, k) => {
    if (e.fixe) { e.cible = e.actives; e.cibleRetirees = e.retirees; return; }
    let act = e.actives.map((x) => ({ ...x })), ret = e.retirees.map((x) => ({ ...x }));
    const veutMer = k === 0, veutNet = k === n - 1;
    const bouger = (test, veut, enTete) => {
      const presente = act.filter((p) => test(p.nom));
      if (!veut && presente.length) { ret.push(...presente); act = act.filter((p) => !test(p.nom)); }
      if (veut && !presente.length) { const r = ret.find((p) => test(p.nom)); if (r) { ret = ret.filter((p) => p !== r); if (enTete) act.unshift(r); else act.push(r); } }
    };
    bouger(estMer, veutMer, true); bouger(estNet, veutNet, false);
    e.cible = act; e.cibleRetirees = ret;
  });
  return etapes;
}
const aChanger = (etapes) => etapes.some((e) => !e.fixe && !(memes(e.cible, e.actives) && memes(e.cibleRetirees, e.retirees)));

// Traite une machine un jour donné. Retourne { modifie: [...] }.
async function traiterJour(supabase, machineId, date, ctx) {
  const { data: rowsM, error } = await supabase.from('planning_jour').select('*').eq('machine_id', machineId).eq('date', date).neq('statut', 'annulé');
  if (error) throw error;
  const rows = rowsM || [];
  const candidates = rows.filter((r) => ctx.ops.has(r.operation_id) && r.heure_debut && r.heure_fin);
  if (!candidates.length) return { modifie: [] };
  const autres = rows.filter((r) => !candidates.includes(r));

  const etapes = construireEtapes(candidates, date, ctx);
  if (!aChanger(etapes)) return { modifie: [] };

  // Données pour les contrôles : tout le planning du jour (personnel, dépendances d'OF) et les disponibilités.
  const { data: toutJour, error: tErr } = await supabase.from('planning_jour').select('*').eq('date', date).neq('statut', 'annulé');
  if (tErr) throw tErr;
  const idsJour = (toutJour || []).map((r) => r.id);
  const liens = idsJour.length ? await liensDe(supabase, idsJour) : [];
  const equipeDe = (r) => new Set([...(r.personnel_id ? [r.personnel_id] : []), ...liens.filter((l) => l.planning_jour_id === r.id).map((l) => l.personnel_id)]);
  const idsEtapes = new Set(etapes.flatMap((e) => (e.fixe ? [] : e.rows.map((r) => r.id))));
  const { data: dispos } = await supabase.from('personnel_planning_jour').select('personnel_id, statut, heure_debut, heure_fin').eq('date', date);

  const iv = (r) => ({ d: r.heure_debut ? mn(r.heure_debut) : 0, f: r.heure_fin ? mn(r.heure_fin) : 1440 });
  const intervallesMachine = [...autres.map(iv), ...etapes.filter((e) => e.fixe).flatMap((e) => e.rows.map(iv))];   // fixes : ne bougent pas
  const placees = [];   // intervalles des étapes déjà (re)posées pendant ce passage

  const libre = (e, mors) => {
    const nouv = mors.map((m) => ({ d: mn(m.heure_debut), f: mn(m.heure_fin) }));
    if (nouv.some((x) => [...intervallesMachine, ...placees].some((o) => chevauche(x, o)))) return false;
    const equipe = new Set(e.rows.flatMap((r) => [...equipeDe(r)]));
    for (const pid of equipe) {
      const prises = (toutJour || []).filter((r) => !idsEtapes.has(r.id) && equipeDe(r).has(pid)).map(iv);
      if (nouv.some((x) => prises.some((o) => chevauche(x, o)))) return false;
      const dsp = (dispos || []).find((x) => x.personnel_id === pid);
      if (dsp && (dsp.statut === 'absent' || dsp.statut === 'en arrêt')) return false;
      if (dsp && dsp.heure_debut && dsp.heure_fin && nouv.some((x) => x.d < mn(dsp.heure_debut) || x.f > mn(dsp.heure_fin))) return false;
    }
    return true;
  };
  const modifie = [];
  let finPrecedente = null, etapePrecedente = null;
  for (let k = 0; k < etapes.length; k++) {
    const e = etapes[k];
    const changeProp = !e.fixe && !(memes(e.cible, e.actives) && memes(e.cibleRetirees, e.retirees));
    let finEtape = e.fin;
    if (!e.fixe && (changeProp || (etapePrecedente && etapePrecedente.compacte))) {
      const phases = e.cible.map((p) => ({ nom: p.nom, duree_h: p.min / 60 }));
      const merRetablie = e.cible.some((p) => estMer(p.nom)) && !e.actives.some((p) => estMer(p.nom));
      const debutOrig = e.debut;
      // Départ : au plus tôt derrière le travail précédent si l'enchaînement était continu ; sinon là où commençaient les créneaux restants.
      // Si la mise en route est retirée, les créneaux restants commencent là où commençait le premier d'entre eux.
      const retiree = (nom) => (estMer(nom) && !e.cible.some((c) => estMer(c.nom))) || (estNet(nom) && !e.cible.some((c) => estNet(c.nom)));
      const restants = e.rows.slice().sort((x, y) => mn(x.heure_debut) - mn(y.heure_debut)).filter((r) => !retiree(r.phase));
      const debutRestant = restants.length ? mn(restants[0].heure_debut) : debutOrig;
      const continu = finPrecedente !== null && travailEntre(finPrecedente.origFin, debutOrig, ctx.cal) <= 0;
      const essais = [];
      if (merRetablie) { const s = reculer(debutOrig, e.cible.find((p) => estMer(p.nom)).min, ctx.cal); if (s !== null) essais.push(s); }
      if (continu && finPrecedente.nouvelleFin < debutOrig) {
        // Dépendances : pas avant la fin d'une autre étape du même OF terminée juste avant ce jour-là.
        const garde = Math.max(0, ...((toutJour || []).filter((r) => r.of_id === e.rows[0].of_id && r.gamme_operatoire_id !== e.rows[0].gamme_operatoire_id && r.heure_fin && mn(r.heure_fin) <= debutOrig).map((r) => mn(r.heure_fin))));
        essais.push(Math.max(finPrecedente.nouvelleFin, garde));
      }
      essais.push(debutRestant, debutOrig);
      let pose = null;
      for (const s of [...new Set(essais)]) {
        const mors = decouper(date, phases, ctx.cal, s);
        if (!mors.length || mors.some((m) => m.date !== date)) continue;
        if (!libre(e, mors)) continue;
        pose = mors; break;
      }
      if (pose) {
        placees.push(...pose.map((m) => ({ d: mn(m.heure_debut), f: mn(m.heure_fin) })));
        e.nouveaux = pose; finEtape = mn(pose[pose.length - 1].heure_fin);
        e.compacte = finEtape < e.fin || (e.cible.length < e.actives.length);
        const identique = memes(phasesDe(pose.map((m) => ({ ...m, phase: m.phase }))), e.actives) && memes(e.cibleRetirees, e.retirees) && pose[0].heure_debut === hh(e.debut) && finEtape === e.fin;
        if (identique) e.nouveaux = null;
      } else { e.nouveaux = null; e.compacte = false; placees.push(...e.rows.map(iv)); }   // conflit : on laisse cette étape telle quelle
    } else { placees.push(...e.rows.map(iv)); e.compacte = false; }
    finPrecedente = { origFin: e.fin, nouvelleFin: finEtape };
    etapePrecedente = e;
  }

  // Écriture : on remplace les créneaux des étapes modifiées (suppression par id, contrôlée, puis insertion).
  for (const e of etapes) {
    if (!e.nouveaux || ctx.apercu) { if (e.nouveaux) modifie.push({ cle: e.cle, avant: e.actives, apres: e.cible }); continue; }
    const equipe = [...new Set(e.rows.flatMap((r) => [...equipeDe(r)]))];
    const modele = e.rows[0];
    const { data: sup, error: dErr } = await supabase.from('planning_jour').delete().in('id', e.rows.map((r) => r.id)).select('id');
    if (dErr) throw dErr;
    if ((sup || []).length !== e.rows.length) continue;   // quelqu'un d'autre a modifié ce jour-là : on n'insiste pas
    const lignes = e.nouveaux.map((m, i) => ({
      date, heure_debut: m.heure_debut, heure_fin: m.heure_fin, phase: m.phase, machine_id: machineId, personnel_id: equipe[0] || null,
      operation_id: modele.operation_id, gamme_operatoire_id: modele.gamme_operatoire_id, of_id: modele.of_id, statut: 'planifié',
      commentaire: modele.commentaire || null, couleur_code: modele.couleur_code || null,
      phases_retirees: i === 0 && e.cibleRetirees.length ? e.cibleRetirees : null,
    }));
    const { data: crees, error: iErr } = await supabase.from('planning_jour').insert(lignes).select('id');
    if (iErr) throw iErr;
    if (equipe.length) {
      const l = []; (crees || []).forEach((c) => equipe.forEach((pid) => l.push({ planning_jour_id: c.id, personnel_id: pid })));
      const { error: lErr } = await supabase.from('planning_jour_personnel').insert(l); if (lErr) throw lErr;
    }
    modifie.push({ cle: e.cle, avant: e.actives, apres: e.cible });
  }
  return { modifie };
}

// cibles : [{ machine_id, date }] ou null (= tous les jours à venir qui contiennent une opération mutualisée).
async function mutualiserJours(supabase, cibles, options = {}) {
  if (!(await colonnesPretes(supabase))) return { traites: 0, modifies: 0, desactive: true };
  const ops = await operationsMutualisees(supabase);
  if (!ops.size) return { traites: 0, modifies: 0 };
  const maintenant = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Paris' });   // 'AAAA-MM-JJ HH:MM:SS'
  const aujourdhui = maintenant.slice(0, 10), maintenantMin = mn(maintenant.slice(11, 16));
  const cal = await lireCalendrier(supabase);
  let jours = cibles;
  if (!jours) {
    // Un seul appel pour tout l'horizon ; on ne traite que les jours où quelque chose est à changer (analyse en mémoire).
    const limite = new Date(Date.parse(aujourdhui + 'T12:00:00Z') + 60 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase.from('planning_jour').select('*').in('operation_id', [...ops]).gte('date', aujourdhui).lte('date', limite).neq('statut', 'annulé');
    if (error) throw error;
    const groupes = new Map();
    (data || []).filter((r) => r.machine_id && r.heure_debut && r.heure_fin).forEach((r) => { const k = `${r.machine_id}|${r.date}`; (groupes.get(k) || groupes.set(k, []).get(k)).push(r); });
    jours = [];
    for (const [k, rs] of groupes) {
      const [machine_id, date] = k.split('|');
      if (aChanger(construireEtapes(rs, date, { aujourdhui, maintenantMin }))) jours.push({ machine_id, date });
    }
    jours = jours.slice(0, options.maxJours || 40);
  } else {
    jours = jours.filter((j) => !j.operation_id || ops.has(j.operation_id));
  }
  const vus = new Set(); let traites = 0, modifies = 0; const details = [];
  for (const j of jours) {
    if (!j.machine_id || !j.date || j.date < aujourdhui) continue;
    const cle = `${j.machine_id}|${j.date}`; if (vus.has(cle)) continue; vus.add(cle);
    try {
      const r = await traiterJour(supabase, j.machine_id, j.date, { ops, cal, aujourdhui, maintenantMin, apercu: !!options.apercu });
      traites++; modifies += r.modifie.length; if (r.modifie.length) details.push({ machine_id: j.machine_id, date: j.date, etapes: r.modifie.length });
    } catch (e) { console.warn('mutualisation ignorée pour', cle, ':', e.message); }
  }
  return { traites, modifies, details };
}

module.exports = { mutualiserJours, traiterJour, phasesDe, travailEntre, reculer, estMer, estNet };
