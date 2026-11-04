// lib/optimisation.js
//
// « Optimiser la production » (Reporting) : fonctions PURES (sans accès à la base).
//   - mesurer(D)        : indicateurs d'un planning (retards, réglages, nettoyages, trous des machines, heures supplémentaires, charge du personnel…)
//   - noter(m, extras)  : note d'un planning (plus bas = meilleur) et son détail par critère
//   - candidats(ofs, a) : ordres de passage des OF à essayer (règles métier de l'atelier)
//   - comparer(...)     : classement des essais par rapport au planning actuel + texte de synthèse
// Le moteur de planification (planifier-of.js) reste seul juge de la faisabilité : chaque ordre proposé est réellement planifié,
// puis mesuré ; rien n'est estimé « à la main ».

const { joursOuvres } = require('./rapport-analyse');
const EL = require('./en-ligne');

const hm = (t) => { const [h, m] = String(t || '00:00').slice(0, 5).split(':'); return Number(h) * 60 + Number(m || 0); };
const jourSemaine = (iso) => new Date(String(iso).slice(0, 10) + 'T12:00:00Z').getUTCDay();   // 0 = dimanche
const PAUSE = [720, 750];          // 12 h 00 – 12 h 30
const JOUR_NORMAL = [480, 990];    // 08 h 00 – 16 h 30
const JOURNEE_MIN = 480;           // journée de référence : 8 h de travail

// Minutes d'un créneau (pause déduite si elle est comprise).
function minutesCreneau(l) {
  const d = hm(l.heure_debut), f = hm(l.heure_fin);
  if (!(f > d)) return 0;
  return f - d - Math.max(0, Math.min(f, PAUSE[1]) - Math.max(d, PAUSE[0]));
}
// Minutes hors de la journée normale (avant 8 h, après 16 h 30) ; tout le samedi est en heures supplémentaires.
function minutesHeuresSup(l) {
  const d = hm(l.heure_debut), f = hm(l.heure_fin);
  if (!(f > d)) return 0;
  if (jourSemaine(l.date) === 6) return minutesCreneau(l);
  return Math.max(0, Math.min(f, JOUR_NORMAL[0]) - d) + Math.max(0, f - Math.max(d, JOUR_NORMAL[1]));
}
const arrondi = (x, n = 1) => { const k = Math.pow(10, n); return Math.round(x * k) / k; };

// D = { ofs:[{id,numero,titre,delai}], creneaux:[{of_id,date,heure_debut,heure_fin,phase,machine_id,personnes:[id],statut}],
//       machines:{id:nom}, personnel:{id:nom}, depuis:'AAAA-MM-JJ', debut, fin, non_planifies:{of_id:nbEtapes} }
function mesurer(D) {
  const depuis = String(D.depuis || '0000-00-00').slice(0, 10);
  const debut = D.debut ? String(D.debut).slice(0, 10) : null, fin = D.fin ? String(D.fin).slice(0, 10) : null;
  const tous = (D.creneaux || []).filter((l) => l.statut !== 'annulé' && l.date && l.heure_debut && l.heure_fin);
  const aVenir = tous.filter((l) => String(l.date).slice(0, 10) >= depuis);

  // ── par OF : début, fin, retard ──
  const ofs = (D.ofs || []).map((of) => {
    const ls = tous.filter((l) => l.of_id === of.id);
    const finDt = ls.reduce((m, l) => { const t = `${String(l.date).slice(0, 10)}T${String(l.heure_fin).slice(0, 5)}`; return t > m ? t : m; }, '');
    const debDt = ls.reduce((m, l) => { const t = `${String(l.date).slice(0, 10)}T${String(l.heure_debut).slice(0, 5)}`; return !m || t < m ? t : m; }, '');
    const delai = of.delai ? String(of.delai).slice(0, 10) : null;
    const nonPlanifie = (D.non_planifies && D.non_planifies[of.id]) > 0;
    const finJour = finDt ? finDt.slice(0, 10) : null;
    const retardJours = delai && finJour && finJour > delai ? joursOuvres(delai, finJour) : 0;
    return { of_id: of.id, numero: of.numero, titre: of.titre || '', delai, debut: debDt || null, fin: finDt || null, retard_jours: retardJours, en_retard: retardJours > 0, non_planifie: !!nonPlanifie || !ls.length };
  });

  // ── minutes par type de phase, mises en route et nettoyages distincts ──
  const min = { production: 0, reglage: 0, nettoyage: 0 };
  const evts = { reglage: new Set(), nettoyage: new Set() };
  aVenir.forEach((l) => {
    const t = EL.typePhase(l.phase); const m = minutesCreneau(l);
    min[t] += m;
    if (t !== 'production') evts[t].add(`${l.machine_id || '-'}|${String(l.date).slice(0, 10)}|${/mise en route/i.test(l.phase || '') ? 'mer' : t}`);
  });
  const nbMer = Array.from(evts.reglage).filter((k) => /\|mer$/.test(k)).length;

  // ── machines : jours ouverts, minutes, trous entre créneaux d'une même journée ──
  const parMachineJour = new Map();
  aVenir.filter((l) => l.machine_id).forEach((l) => { const k = `${l.machine_id}|${String(l.date).slice(0, 10)}`; (parMachineJour.get(k) || parMachineJour.set(k, []).get(k)).push(l); });
  let trous = 0; const machines = new Map();
  parMachineJour.forEach((ls, k) => {
    const [mid] = k.split('|');
    const iv = ls.map((l) => [hm(l.heure_debut), hm(l.heure_fin)]).filter(([d, f]) => f > d).sort((a, b) => a[0] - b[0]);
    if (!iv.length) return;
    const fusion = [];
    iv.forEach(([d, f]) => { const dernier = fusion[fusion.length - 1]; if (dernier && d <= dernier[1]) dernier[1] = Math.max(dernier[1], f); else fusion.push([d, f]); });
    const chevauchePause = (d, f) => Math.max(0, Math.min(f, PAUSE[1]) - Math.max(d, PAUSE[0]));
    const utiliseNet = fusion.reduce((t, [d, f]) => t + (f - d) - chevauchePause(d, f), 0);
    const debutJ = fusion[0][0], finJ = fusion[fusion.length - 1][1];
    const trouNet = Math.max(0, Math.round((finJ - debutJ) - chevauchePause(debutJ, finJ) - utiliseNet));
    trous += trouNet;
    const x = machines.get(mid) || { id: mid, nom: (D.machines || {})[mid] || '?', jours: 0, minutes: 0, reglage: 0, nettoyage: 0, trous: 0 };
    x.jours += 1; x.minutes += ls.reduce((s, l) => s + minutesCreneau(l), 0); x.trous += trouNet;
    ls.forEach((l) => { const t = EL.typePhase(l.phase); if (t !== 'production') x[t] += minutesCreneau(l); });
    machines.set(mid, x);
  });

  // ── heures supplémentaires ──
  const hs = aVenir.reduce((s, l) => s + minutesHeuresSup(l), 0);

  // ── personnel ──
  const parPersJour = new Map(); let sansPersonne = 0;
  aVenir.forEach((l) => {
    const ps = Array.from(new Set(l.personnes || []));
    if (!ps.length) { sansPersonne += 1; return; }
    const m = minutesCreneau(l);
    ps.forEach((p) => { const k = `${p}|${String(l.date).slice(0, 10)}`; parPersJour.set(k, (parPersJour.get(k) || 0) + m); });
  });
  const parPers = new Map(); let maxJour = 0, surcharge = 0;
  parPersJour.forEach((m, k) => { const p = k.split('|')[0]; parPers.set(p, (parPers.get(p) || 0) + m); if (m > maxJour) maxJour = m; if (m > JOURNEE_MIN) surcharge += 1; });
  const totaux = Array.from(parPers.values());
  const moy = totaux.length ? totaux.reduce((s, x) => s + x, 0) / totaux.length : 0;
  const ecartType = totaux.length > 1 ? Math.sqrt(totaux.reduce((s, x) => s + (x - moy) ** 2, 0) / totaux.length) : 0;

  // ── période demandée ──
  let dansPeriode = 0, horsPeriode = 0;
  aVenir.forEach((l) => { const d = String(l.date).slice(0, 10); const m = minutesCreneau(l); if ((!debut || d >= debut) && (!fin || d <= fin)) dansPeriode += m; else horsPeriode += m; });

  const retardes = ofs.filter((o) => o.en_retard);
  const finGlobale = ofs.reduce((m, o) => (o.fin && o.fin > m ? o.fin : m), '');
  return {
    nb_of: ofs.length, nb_en_retard: retardes.length, retard_jours_total: retardes.reduce((s, o) => s + o.retard_jours, 0),
    retard_max_jours: retardes.reduce((m, o) => Math.max(m, o.retard_jours), 0), nb_non_planifies: ofs.filter((o) => o.non_planifie).length,
    fin_globale: finGlobale || null,
    minutes: { production: Math.round(min.production), reglage: Math.round(min.reglage), nettoyage: Math.round(min.nettoyage), total: Math.round(min.production + min.reglage + min.nettoyage) },
    nb_mises_en_route: nbMer, nb_nettoyages: evts.nettoyage.size,
    jours_machine: parMachineJour.size, trous_min: Math.round(trous), heures_sup_min: Math.round(hs),
    machines: Array.from(machines.values()).sort((a, b) => b.minutes - a.minutes),
    personnel: { nb: parPers.size, total_min: Math.round(totaux.reduce((s, x) => s + x, 0)), max_jour_min: Math.round(maxJour), jours_surcharge: surcharge, ecart_type_min: Math.round(ecartType), creneaux_sans_personne: sansPersonne },
    dans_periode_min: Math.round(dansPeriode), hors_periode_min: Math.round(horsPeriode),
    ofs,
  };
}

// Note d'un planning (plus bas = meilleur). Chaque critère est exprimé en « points » comparables :
//  - un OF en retard coûte 3 000 pts + 2 400 pts par jour ouvré de retard (≈ 5 pts par minute d'une journée de 8 h) ;
//  - un OF non planifié coûte 10 000 pts ; une étape en attente d'un lot minimum, 1 500 pts ;
//  - fin du dernier OF : 60 pts par jour ouvré après aujourd'hui ;
//  - réglages et nettoyages : 1 pt par minute ; trous des machines : 0,5 pt par minute ; heures supplémentaires : 2 pts par minute ;
//  - déséquilibre de la charge du personnel : 0,3 pt par minute d'écart-type, jours de plus de 8 h : 300 pts chacun.
const POIDS = { retard_of: 3000, retard_jour: 2400, non_planifie: 10000, attente_lot: 1500, fin_jour: 60, reglage: 1, trou: 0.5, heure_sup: 2, desequilibre: 0.3, surcharge: 300 };
function noter(m, extras, aujourdhui) {
  const e = extras || {};
  const finJours = m.fin_globale && aujourdhui ? Math.max(0, joursOuvres(aujourdhui, m.fin_globale.slice(0, 10))) : 0;
  const d = {
    retards: m.nb_en_retard * POIDS.retard_of + m.retard_jours_total * POIDS.retard_jour,
    non_planifies: m.nb_non_planifies * POIDS.non_planifie + (e.attentes_lot || 0) * POIDS.attente_lot,
    fin_globale: finJours * POIDS.fin_jour,
    reglages: (m.minutes.reglage + m.minutes.nettoyage) * POIDS.reglage,
    trous: m.trous_min * POIDS.trou,
    heures_sup: m.heures_sup_min * POIDS.heure_sup,
    personnel: m.personnel.ecart_type_min * POIDS.desequilibre + m.personnel.jours_surcharge * POIDS.surcharge,
  };
  const total = Object.values(d).reduce((s, x) => s + x, 0);
  return { total: Math.round(total), detail: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Math.round(v)])) };
}

// ── Ordres de passage à essayer ──
// ofs : [{id, numero, delai, priorite, type_production, charge_min, machines:[nom], debut_actuel}]
const RANG_PRIORITE = { urgente: 0, haute: 1, normale: 2 };
const estPrioritaire = (o) => ['pleiade', 'coffret'].includes(o.type_production) || o.priorite === 'urgente';
function candidats(ofs, aujourdhui) {
  const cmpDelai = (a, b) => String(a.delai || '9999-12-31').slice(0, 10).localeCompare(String(b.delai || '9999-12-31').slice(0, 10));
  const cmpPrio = (a, b) => (RANG_PRIORITE[a.priorite] ?? 3) - (RANG_PRIORITE[b.priorite] ?? 3);
  const tri = (cmp) => ofs.slice().sort((a, b) => cmp(a, b) || cmpDelai(a, b) || String(a.numero).localeCompare(String(b.numero))).map((o) => o.id);
  const marge = (o) => (o.delai ? joursOuvres(aujourdhui, String(o.delai).slice(0, 10)) : 999) - (Number(o.charge_min) || 0) / JOURNEE_MIN;
  const signature = (o) => `${o.type_production || '-'}|${(o.machines || []).slice().sort().join('+')}`;
  const groupes = new Map(); ofs.forEach((o) => { const s = signature(o); (groupes.get(s) || groupes.set(s, []).get(s)).push(o); });
  const ordreGroupes = Array.from(groupes.values()).sort((g1, g2) => cmpDelai(g1.slice().sort(cmpDelai)[0], g2.slice().sort(cmpDelai)[0]));
  const liste = [
    { code: 'actuel', nom: 'Recalcul au plus tôt, ordre actuel', description: 'Conserve l\'ordre de passage actuel du planning et replace chaque tâche au plus tôt (comble les trous).', ordre: tri((a, b) => String(a.debut_actuel || '9999').localeCompare(String(b.debut_actuel || '9999'))) },
    { code: 'echeance', nom: 'Échéances d\'abord', description: 'Les OF dont la date de livraison est la plus proche passent en premier.', ordre: tri(() => 0) },
    { code: 'priorite', nom: 'Priorités métier', description: 'Pléiade, Coffret et commandes urgentes d\'abord, puis par date de livraison.', ordre: tri((a, b) => (estPrioritaire(a) ? 0 : 1) - (estPrioritaire(b) ? 0 : 1) || cmpPrio(a, b)) },
    { code: 'marge', nom: 'Marge la plus faible d\'abord', description: 'Les OF qui ont le moins de temps de marge (jours ouvrés avant la livraison − charge restante) passent en premier.', ordre: tri((a, b) => marge(a) - marge(b)) },
    { code: 'regroupement', nom: 'Regroupement par machines', description: 'Les OF qui utilisent les mêmes machines sont enchaînés : moins de mises en route et de nettoyages.', ordre: ordreGroupes.flatMap((g) => g.slice().sort(cmpDelai).map((o) => o.id)) },
  ];
  // Un seul essai par ordre distinct (le premier nom rencontré est conservé).
  const vus = new Map(); const sortie = [];
  liste.forEach((c) => { const cle = c.ordre.join('|'); if (vus.has(cle)) { vus.get(cle).aussi.push(c.nom); return; } c.aussi = []; vus.set(cle, c); sortie.push(c); });
  return sortie;
}

const dureeFr = (min) => { const m = Math.round(Math.abs(min)); const h = Math.floor(m / 60); return `${h} h ${String(m % 60).padStart(2, '0')}`; };
const sgn = (x) => (x > 0 ? '+' : x < 0 ? '-' : '');

// base : mesure du planning actuel ; essais : [{code,nom,description,ordre,mesure,attentes_lot,echecs}]
function comparer(base, essais, aujourdhui) {
  const noteBase = noter(base, { attentes_lot: 0 }, aujourdhui);
  const lignes = essais.map((e) => {
    const note = noter(e.mesure, { attentes_lot: e.attentes_lot || 0 }, aujourdhui);
    return { ...e, note, gain_points: noteBase.total - note.total, gain_pct: noteBase.total > 0 ? Math.round(((noteBase.total - note.total) / noteBase.total) * 1000) / 10 : 0 };
  }).sort((a, b) => a.note.total - b.note.total);
  // Recommandé : le meilleur essai, à condition qu'il fasse mieux que le planning actuel (au moins 2 % de la note, ou un OF en retard de moins).
  const meilleur = lignes[0] || null;
  const recommande = meilleur && (meilleur.gain_pct >= 2 || meilleur.mesure.nb_en_retard < base.nb_en_retard) && meilleur.mesure.nb_en_retard <= base.nb_en_retard ? meilleur : null;
  const texte = [];
  if (!recommande) {
    texte.push(meilleur ? `Aucune organisation essayée ne fait nettement mieux que le planning actuel (meilleur essai : « ${meilleur.nom} », ${sgn(meilleur.gain_pct)}${Math.abs(meilleur.gain_pct)} %). Le planning actuel est conservé.` : 'Aucun essai exploitable.');
  } else {
    const m = recommande.mesure;
    texte.push(`Organisation recommandée : « ${recommande.nom} » (${recommande.gain_pct} % mieux que le planning actuel).`);
    if (m.nb_en_retard !== base.nb_en_retard) texte.push(`OF en retard : ${base.nb_en_retard} → ${m.nb_en_retard}.`);
    const dReg = (m.minutes.reglage + m.minutes.nettoyage) - (base.minutes.reglage + base.minutes.nettoyage);
    if (Math.abs(dReg) >= 15) texte.push(`Réglages et nettoyages : ${sgn(dReg)}${dureeFr(dReg)}.`);
    const dTr = m.trous_min - base.trous_min; if (Math.abs(dTr) >= 30) texte.push(`Temps morts sur les machines : ${sgn(dTr)}${dureeFr(dTr)}.`);
    const dJ = m.jours_machine - base.jours_machine; if (dJ !== 0) texte.push(`Journées de machine ouvertes : ${base.jours_machine} → ${m.jours_machine}.`);
    if (m.fin_globale && base.fin_globale && m.fin_globale.slice(0, 10) !== base.fin_globale.slice(0, 10)) texte.push(`Fin du dernier OF : ${base.fin_globale.slice(0, 10).split('-').reverse().join('/')} → ${m.fin_globale.slice(0, 10).split('-').reverse().join('/')}.`);
    if (m.heures_sup_min > base.heures_sup_min) texte.push(`Attention : ${dureeFr(m.heures_sup_min - base.heures_sup_min)} d'heures supplémentaires en plus.`);
  }
  return { note_base: noteBase, essais: lignes, recommande_code: recommande ? recommande.code : null, texte: texte.join(' ') };
}

module.exports = { mesurer, noter, candidats, comparer, minutesCreneau, minutesHeuresSup, POIDS };
