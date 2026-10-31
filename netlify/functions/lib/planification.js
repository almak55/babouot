// lib/planification.js
//
// Moteur de planification à l'heure. Fonctions PURES (aucun accès à la
// base) : on lui fournit les durées, les ressources candidates et ce
// qui est déjà occupé, il calcule QUAND chaque phase peut se dérouler.
//
// Temps : minutes écoulées depuis le 01/01/1970 00:00, en heure
// "murale" locale SANS fuseau horaire (on n'utilise Date qu'en UTC pour
// faire de l'arithmétique de calendrier). Évite tout décalage
// d'heure d'été entre le serveur et l'atelier.
//
// Règles :
//   - on ne travaille que du lundi au vendredi, hors jours fériés
//     français, dans les plages du calendrier (ex: 08:00-12:00 et
//     12:30-16:30) ;
//   - une ÉTAPE démarre quand toutes ses étapes prédécesseurs sont
//     terminées (par défaut : l'étape précédente ; plusieurs étapes sans
//     lien entre elles peuvent donc se dérouler en parallèle) ;
//   - un lien peut être « progressif » : l'étape démarre dès qu'un
//     pourcentage de la précédente est avancé (ex: la pliure dès que des
//     feuilles refendues existent) mais ne peut pas se terminer avant elle ;
//   - les PHASES d'une même étape s'enchaînent strictement ;
//   - une phase avance uniquement quand TOUTES ses ressources (machine
//     si elle en utilise une, personnes requises) sont libres, et se
//     met en pause sinon (nuit, pause, absence, autre tâche, autre
//     branche parallèle du même OF) ;
//   - machine : celle imposée, sinon la candidate qui termine le plus tôt ;
//   - personnes : celles imposées, sinon les plus tôt disponibles parmi
//     les compétentes (à égalité : la moins chargée).

const MIN_JOUR = 1440;
const MIN_TRANCHE_MACHINE = 30;   // une machine ne tourne pas par miettes : pas de tranche de conduite plus courte (sauf pour finir une phase ou en fin de journée)
const HORIZON_JOURS = 400;

const hhmm = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };

function enMinutes(dateStr, heureStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = (heureStr || '00:00').split(':').map(Number);
  return Date.UTC(y, mo - 1, d, h, mi) / 60000;
}
const dateDe = (min) => new Date(min * 60000).toISOString().slice(0, 10);
const heureDe = (min) => new Date(min * 60000).toISOString().slice(11, 16);
const debutDeJour = (min) => Math.floor(min / MIN_JOUR) * MIN_JOUR;

// ---------- Jours fériés (France métropolitaine) ----------
const cacheFeries = new Map();

// Dimanche de Pâques (algorithme de Meeus/Jones/Butcher), en ms UTC.
function paques(annee) {
  const a = annee % 19; const b = Math.floor(annee / 100); const c = annee % 100;
  const d = Math.floor(b / 4); const e = b % 4; const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3); const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4); const k = c % 4; const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(annee, mois - 1, jour);
}

// Map 'AAAA-MM-JJ' -> libellé, pour une année.
function joursFeries(annee) {
  if (cacheFeries.has(annee)) return cacheFeries.get(annee);
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const p = paques(annee);
  const jours = (n) => iso(p + n * 86400000);
  const f = new Map([
    [`${annee}-01-01`, 'Jour de l\'An'],
    [jours(1), 'Lundi de Pâques'],
    [`${annee}-05-01`, 'Fête du Travail'],
    [`${annee}-05-08`, 'Victoire 1945'],
    [jours(39), 'Ascension'],
    [jours(50), 'Lundi de Pentecôte'],
    [`${annee}-07-14`, 'Fête nationale'],
    [`${annee}-08-15`, 'Assomption'],
    [`${annee}-11-01`, 'Toussaint'],
    [`${annee}-11-11`, 'Armistice 1918'],
    [`${annee}-12-25`, 'Noël'],
  ]);
  cacheFeries.set(annee, f);
  return f;
}
const libelleFerie = (dateStr) => joursFeries(Number(dateStr.slice(0, 4))).get(dateStr) || null;

// Jour travaillé : lundi-vendredi hors jours fériés. Le samedi n'est ouvert que de façon exceptionnelle,
// quand le calendrier choisi le prévoit (cal.samedi_debut / cal.samedi_fin) ; le dimanche jamais.
const estOuvre = (jourMin, cal) => {
  const j = new Date(jourMin * 60000).getUTCDay();
  if (j === 0) return false;
  if (j === 6 && !(cal && cal.samedi_debut && cal.samedi_fin)) return false;
  return !libelleFerie(dateDe(jourMin));
};

// Plages de travail d'un jour (avant/après la pause).
function fenetresDuJour(jour, cal) {
  // Samedi exceptionnel : une seule plage (ex. 06:00-12:00), sans pause.
  if (new Date(jour * 60000).getUTCDay() === 6) return cal.samedi_debut && cal.samedi_fin ? [[jour + hhmm(cal.samedi_debut), jour + hhmm(cal.samedi_fin)]].filter(([a, b]) => b > a) : [];
  const d = hhmm(cal.debut); const f = hhmm(cal.fin);
  const p = hhmm(cal.pause_debut); const q = p + Number(cal.pause_minutes);
  const res = [];
  if (p > d) res.push([jour + d, jour + Math.min(p, f)]);
  if (f > q) res.push([jour + Math.max(q, d), jour + f]);
  return res.filter(([a, b]) => b > a);
}

// Retire de [fenetre] tous les intervalles occupés ; renvoie les plages libres, triées.
function soustraire(fenetre, occupes) {
  let libres = [{ d: fenetre.d, f: fenetre.f }];
  for (const o of occupes) {
    if (o.f <= fenetre.d || o.d >= fenetre.f) continue;
    const suite = [];
    for (const l of libres) {
      if (o.f <= l.d || o.d >= l.f) { suite.push(l); continue; }
      if (o.d > l.d) suite.push({ d: l.d, f: o.d });
      if (o.f < l.f) suite.push({ d: o.f, f: l.f });
    }
    libres = suite;
    if (libres.length === 0) break;
  }
  return libres.sort((a, b) => a.d - b.d);
}

// Consomme `dureeMin` minutes de travail à partir de `depuisMin`, uniquement
// dans les plages de travail où aucun intervalle de `occupes` n'est actif.
// Renvoie la liste des tranches [{d, f}] ou null si l'horizon est dépassé.
function consommer(dureeMin, depuisMin, occupes, cal, minTranche) {
  let reste = dureeMin;
  const tranches = [];
  const finHorizon = debutDeJour(depuisMin) + HORIZON_JOURS * MIN_JOUR;
  for (let jour = debutDeJour(depuisMin); jour < finHorizon && reste > 0; jour += MIN_JOUR) {
    if (!estOuvre(jour, cal)) continue;
    for (const [a0, b] of fenetresDuJour(jour, cal)) {
      const a = Math.max(a0, depuisMin);
      if (b <= a) continue;
      for (const l of soustraire({ d: a, f: b }, occupes)) {
        // Pas de miette : un trou coincé entre deux occupations (quelqu'un d'autre, une autre tâche) et plus court que la tranche
        // minimale n'est pas utilisé, sauf s'il suffit à finir la phase. La fin de journée / de matinée, elle, coupe normalement.
        if (minTranche && l.f - l.d < minTranche && l.f - l.d < reste && l.f < b
          && occupes.some((o) => o.d <= l.f && o.f > l.f && o.tag !== 'virt' && o.tag !== 'net')) continue;
        const prise = Math.min(reste, l.f - l.d);
        tranches.push({ d: l.d, f: l.d + prise });
        reste -= prise;
        if (reste <= 0) break;
      }
      if (reste <= 0) break;
    }
  }
  return reste > 0 ? null : tranches;
}

// Fusionne deux tranches consécutives quand seule la pause du midi les sépare
// (une ligne de planning par jour plutôt que deux).
function fusionner(tranches, cal) {
  const res = [];
  for (const t of tranches) {
    const prec = res[res.length - 1];
    if (prec) {
      const jour = debutDeJour(prec.d);
      const memeJour = debutDeJour(t.d) === jour;
      const pauseDebut = jour + hhmm(cal.pause_debut);
      const pauseFin = pauseDebut + Number(cal.pause_minutes);
      if (prec.f === t.d || (memeJour && prec.f === pauseDebut && t.d === pauseFin)) { prec.f = t.f; continue; }
    }
    res.push({ d: t.d, f: t.f });
  }
  return res;
}

// Copie de l'occupation (listes dupliquées) : on y inscrit au fur et à mesure
// ce que le plan en cours place, pour que deux branches parallèles d'un même
// OF ne se marchent pas dessus. L'entrée d'origine n'est jamais modifiée.
function cloner(occupation) {
  const copie = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, v.slice()]));
  return { machines: copie(occupation.machines), personnes: copie(occupation.personnes) };
}

// Présence limitée en heures : une personne n'est là que pour les `minutes` premières
// minutes de travail d'une phase ; une autre prend ensuite le relais.
function prefixe(tranches, minutes) {
  const res = []; let reste = minutes;
  for (const t of tranches) {
    if (reste <= 0) break;
    const l = t.f - t.d; const prise = Math.min(l, reste);
    res.push({ d: t.d, f: t.d + prise }); reste -= prise;
  }
  return res;
}
function suffixe(tranches, minutes) {
  const res = []; let reste = minutes;
  for (const t of tranches) {
    const l = t.f - t.d;
    if (reste >= l) { reste -= l; continue; }
    res.push({ d: t.d + reste, f: t.f }); reste = 0;
  }
  return res;
}
const libreSur = (intervalles, occupes) => intervalles.every((iv) => soustraire(iv, occupes).reduce((t, l) => t + (l.f - l.d), 0) === iv.f - iv.d);

// Découpe une phase en segments « même équipe » : [{ d, f, personnes: [ids] }].
function segmenter(tranches, presences, cal) {
  const ids = Object.keys(presences);
  const bornes = new Set();
  tranches.forEach((t) => { bornes.add(t.d); bornes.add(t.f); });
  ids.forEach((id) => presences[id].forEach((iv) => { bornes.add(iv.d); bornes.add(iv.f); }));
  const pts = Array.from(bornes).sort((a, b) => a - b);
  const elem = [];
  tranches.forEach((t) => {
    const dans = pts.filter((x) => x >= t.d && x <= t.f);
    for (let i = 0; i + 1 < dans.length; i++) {
      const a = dans[i]; const b = dans[i + 1];
      const qui = ids.filter((id) => presences[id].some((iv) => iv.d <= a && iv.f >= b));
      elem.push({ d: a, f: b, cle: qui.slice().sort().join('|'), personnes: qui });
    }
  });
  const segments = []; let run = [];
  const vider = () => {
    if (!run.length) return;
    fusionner(run.map((x) => ({ d: x.d, f: x.f })), cal).forEach((t) => segments.push({ d: t.d, f: t.f, personnes: run[0].personnes }));
    run = [];
  };
  elem.forEach((e) => { if (run.length && run[0].cle !== e.cle) vider(); run.push(e); });
  vider();
  return segments;
}

// Travail manuel (sans cadence machine) : la durée chiffrée représente un contenu de travail en
// heures-personnes (durée standard x effectif standard). Avec n personnes, la durée écoulée est
// contenu / n, arrondie au quart d'heure le plus proche (ex. 4 h pour une personne, 3 personnes :
// 80 min -> 1 h 15). Si l'effectif est celui prévu, la durée n'est pas modifiée.
function dureeAvecEffectif(dureeMin, effectifStandard, n) {
  const std = Math.max(1, effectifStandard || 1);
  const k = Math.max(1, n || std);
  if (k === std) return dureeMin;
  const brut = (dureeMin * std) / k;
  const quart = Math.round(brut / 15) * 15;
  return quart > 0 ? quart : Math.max(1, Math.round(brut));
}

// ---------------------------------------------------------------------------------------------
// Journée de machine (mise en route, réglage, roulage, nettoyage)
//
// Pour les équipements qui demandent une mise en route et un nettoyage (montage de couvertures, machine couleur,
// emboîtage, pressure en colle…) :
//   • UNE mise en route par jour et par machine, à l'ouverture, dès qu'un travail y passe ;
//   • chaque travail garde son réglage puis son roulage ; un travail qui continue le lendemain ne refait pas son réglage ;
//   • les travaux se suivent sans qu'un autre s'intercale entre le réglage et la fin du roulage d'un travail ;
//   • les travaux s'arrêtent à (fermeture − durée de nettoyage), soit 16:00 : le nettoyage de fin de journée démarre alors,
//     même si le travail n'est pas terminé ; si la charge de la machine est finie plus tôt, il suit le dernier travail.
//     Les créneaux de nettoyage sont écrits à l'enregistrement du planning (lib/nettoyage.js).
// Une étape est « en journée » si elle porte etape.journee = { mer_min, mer: {…phase de mise en route} } (posé par planifier-of).
// Les intervalles d'occupation portent un `tag` : 'mer' (mise en route), 'net' (nettoyage), 'maint' (maintenance) ; sans tag = travail.
// ---------------------------------------------------------------------------------------------
const NETTOYAGE_MIN = 30;
const JOURS_RESERVES = 150;

// La machine a-t-elle déjà sa mise en route ce jour-là ? (posée par un autre travail du même jour : une seule par jour)
function jourTravaille(intervalles, jour) {
  return intervalles.some((iv) => iv.tag === 'mer' && iv.d < jour + MIN_JOUR && iv.f > jour);
}

// Occupation de la machine telle que la voit un travail « en journée » : les nettoyages déjà posés sont ignorés (ils seront
// replacés après le dernier travail), l'ouverture est réservée à la mise en route des jours qui n'en ont pas encore, et la fin de journée au nettoyage.
function occupationJournee(reelle, curseur, cal, merLen, merMin) {
  const base = reelle.filter((iv) => iv.tag !== 'net');
  const res = [];
  const debut = debutDeJour(curseur);
  for (let k = 0; k < JOURS_RESERVES; k++) {
    const jour = debut + k * MIN_JOUR;
    if (!estOuvre(jour, cal)) continue;
    const fen = fenetresDuJour(jour, cal);
    if (!fen.length) continue;
    const ouverture = fen[0][0]; const fermeture = fen[fen.length - 1][1];
    if (!jourTravaille(base, jour)) res.push({ d: ouverture, f: ouverture + (merLen[jour] || merMin), tag: 'virt' });
    res.push({ d: Math.max(ouverture, fermeture - NETTOYAGE_MIN), f: fermeture, tag: 'virt' });
  }
  return base.concat(res);
}

// Un travail SANS mise en route propre (ex. étape à durée manuelle) posé sur une machine « en journée » s'arrête lui aussi à
// (fermeture − durée de nettoyage) : la fin de journée est réservée au nettoyage de la machine (il reprend le lendemain).
function occupationAvecNettoyage(reelle, curseur, cal) {
  const base = reelle.filter((iv) => iv.tag !== 'net');
  const res = [];
  const debut = debutDeJour(curseur);
  for (let k = 0; k < JOURS_RESERVES; k++) {
    const jour = debut + k * MIN_JOUR;
    if (!estOuvre(jour, cal)) continue;
    const fen = fenetresDuJour(jour, cal);
    if (!fen.length) continue;
    const ouverture = fen[0][0]; const fermeture = fen[fen.length - 1][1];
    res.push({ d: Math.max(ouverture, fermeture - NETTOYAGE_MIN), f: fermeture, tag: 'virt' });
  }
  return base.concat(res);
}

function simulerJournee(etape, machineId, curseur, ctx, charge, sync) {
  const cal = ctx.calendrier;
  const reelle = ctx.occupation.machines[machineId] || [];
  const j = etape.journee;
  const travail = etape.phases.filter((p) => !p.mer && p.type_phase !== 'nettoyage');
  const merLen = {};
  const avec = (occ) => ({ calendrier: cal, occupation: { machines: { ...ctx.occupation.machines, [machineId]: occ }, personnes: ctx.occupation.personnes }, conducteurs: ctx.conducteurs });
  let r = null; let merPhases = [];
  for (let tour = 0; tour < 4; tour++) {
    r = simulerEtape({ ...etape, phases: travail }, machineId, curseur, avec(occupationJournee(reelle, curseur, cal, merLen, j.mer_min)), charge, sync);
    if (!r) return null;
    // Jours où le travail occupe la machine : chacun a besoin de sa mise en route (sauf s'il y a déjà du travail ce jour-là).
    const jours = Array.from(new Set(r.phases.filter((p) => p.besoin_machine).flatMap((p) => p.brutes.map((t) => debutDeJour(t.d))))).sort((a, b) => a - b);
    merPhases = []; let stable = true;
    for (const jour of jours) {
      if (jourTravaille(reelle.filter((iv) => iv.tag !== 'net'), jour)) continue;
      const fen = fenetresDuJour(jour, cal); if (!fen.length) continue;
      const ouverture = fen[0][0];
      // La mise en route est faite par le conducteur du jour : celui déjà prévu sur la machine, sinon celui du premier travail de ce jour.
      // (une phase qui continue d'un jour sur l'autre garde son conducteur : on regarde les tranches du jour, pas seulement le début de la phase)
      const duJour = (p) => p.brutes.filter((t) => debutDeJour(t.d) === jour);
      const premier = r.phases.filter((p) => p.besoin_machine && p.personnes && p.personnes.length && duJour(p).length).sort((a, b) => duJour(a)[0].d - duJour(b)[0].d)[0];
      const cond = (((ctx.conducteurs || {})[machineId] || {})[jour]) || (premier ? premier.personnes[0] : null);
      const rm = simulerEtape({ ...etape, phases: [j.mer], personnes_imposees: cond ? [cond] : etape.personnes_imposees }, machineId, ouverture, avec(reelle.filter((iv) => iv.tag !== 'net')), charge, null);
      if (!rm || !rm.phases.length) continue;
      const fin = rm.phases[0].brutes[rm.phases[0].brutes.length - 1].f;
      if (fin - ouverture > (merLen[jour] || j.mer_min)) { merLen[jour] = fin - ouverture; stable = false; }   // personnel pris à l'ouverture : on laisse la place
      merPhases.push({ ...rm.phases[0], mer: true });
    }
    if (stable) break;
  }
  const phases = merPhases.concat(r.phases).sort((a, b) => a.brutes[0].d - b.brutes[0].d);
  return {
    machine_id: machineId, phases,
    debut_min: phases.length ? phases[0].tranches[0].d : curseur,
    fin_min: r.fin_min,
    problemes: r.problemes,
  };
}

function simulerEtape(etape, machineId, curseur, ctx, charge, sync) {
  const cal = ctx.calendrier;
  const occMachine = machineId ? (ctx.occupation.machines[machineId] || []) : [];
  const occPers = (id) => ctx.occupation.personnes[id] || [];
  const imposees = etape.personnes_imposees && etape.personnes_imposees.length ? etape.personnes_imposees : null;
  const pool = imposees || etape.personnes_pour(machineId);
  const phasesRes = [];
  const problemes = [];
  const condEtape = {};   // conducteur déjà retenu par une phase précédente de CETTE étape, par jour (réglage → roulage → …)
  let c = curseur;

  for (const phase of etape.phases) {
    if (phase.duree_min <= 0) continue;
    // En ligne : la production ne démarre pas avant celle du prédécesseur (le réglage, lui, se fait en parallèle).
    if (sync && phase.type_phase === 'production' && c < sync.debut) c = sync.debut;
    const occMach = phase.besoin_machine ? occMachine : [];
    const minTr = phase.besoin_machine ? (phase.duree_min <= 90 ? phase.duree_min : MIN_TRANCHE_MACHINE) : 0;   // phase courte : d'un seul tenant ; longue : pas de tranche < 30 min
    // Durée écoulée : pour un travail manuel, elle dépend du nombre de personnes réellement présentes.
    const effectifPrevu = imposees ? imposees.length : Math.min(Math.max(1, phase.nb_personnes || 1), pool.length || Infinity);
    const duree = phase.repartissable && Number.isFinite(effectifPrevu)
      ? dureeAvecEffectif(phase.duree_min, phase.nb_personnes, effectifPrevu) : phase.duree_min;
    const ph = { ...phase, duree_min: duree, duree_standard_min: phase.duree_min };
    let choisis; let notes = null;
    if (imposees) {
      choisis = imposees;
    } else {
      const k = Math.max(1, ph.nb_personnes || 1);
      if (pool.length === 0) {
        choisis = [];
        problemes.push({ type: 'sans_personnel', bloquant: false, detail: `Aucune personne compétente trouvée pour « ${ph.nom} » : personnel à affecter.` });
      } else {
        notes = pool.map((id) => {
          const t = consommer(ph.duree_min, c, [].concat(occMach, occPers(id)), cal, minTr);
          return { id, fin: t ? t[t.length - 1].f : Infinity, charge: charge.get(id) || 0 };
        });
        notes.sort((a, b) => a.fin - b.fin || a.charge - b.charge || (a.id < b.id ? -1 : 1));
        choisis = notes.slice(0, k).map((n) => n.id);
        if (pool.length < k) {
          problemes.push({ type: 'effectif_incomplet', bloquant: false, detail: `« ${ph.nom} » demande ${k} personnes, ${pool.length} compétente(s) seulement.` });
        }
      }
    }
    // UN SEUL CONDUCTEUR par machine et par jour : si un conducteur est déjà prévu sur cette machine le jour où la phase démarre,
    // c'est lui qui la conduit (en tête de l'équipe) ; les aides restent choisies librement. S'il est occupé, la phase attend qu'il soit libre.
    if (!imposees && notes && machineId && ph.besoin_machine && choisis.length) {
      const k = Math.max(1, ph.nb_personnes || 1);
      let courant = choisis;
      for (let essai = 0; essai < 8; essai++) {
        const t0 = consommer(ph.duree_min, c, [].concat(occMach, ...courant.map(occPers)), cal, minTr);
        if (!t0) break;
        const jourT0 = debutDeJour(t0[0].d);
        const cond = (((ctx.conducteurs || {})[machineId] || {})[jourT0]) || condEtape[jourT0];
        if (!cond || courant[0] === cond) break;
        if (!pool.includes(cond)) {
          problemes.push({ type: 'conducteurs_differents', bloquant: false, detail: `« ${ph.nom} » : un autre conducteur est déjà prévu sur cette machine ce jour-là mais il n'est pas habilité pour cette opération — deux conducteurs différents.` });
          break;
        }
        courant = [cond, ...notes.filter((n) => n.id !== cond).slice(0, Math.max(0, k - 1)).map((n) => n.id)];
      }
      choisis = courant;
    }
    // Personnes à présence limitée en heures (relayées ensuite par d'autres).
    const quotas = etape.heures_max || {};
    const limitees = choisis.filter((id) => Number(quotas[id]) > 0 && Number(quotas[id]) < ph.duree_min);
    const pleins = choisis.filter((id) => !limitees.includes(id));
    let t = consommer(ph.duree_min, c, [].concat(occMach, ...pleins.map(occPers)), cal, minTr);
    if (!t) return null;
    let presences = null;
    if (limitees.length) {
      presences = {};
      pleins.forEach((id) => { presences[id] = t; });
      limitees.forEach((id) => { presences[id] = prefixe(t, Number(quotas[id])); });
      // Une personne limitée doit être libre pendant SA présence ; sinon on revient à la contrainte stricte.
      if (limitees.some((id) => !libreSur(presences[id], occPers(id)))) {
        t = consommer(ph.duree_min, c, [].concat(occMach, ...choisis.map(occPers)), cal, minTr);
        if (!t) return null;
        pleins.forEach((id) => { presences[id] = t; });
        limitees.forEach((id) => { presences[id] = prefixe(t, Number(quotas[id])); });
      }
      // Relais : un remplaçant compétent, libre sur tout le reste de la phase, prend la suite.
      const dejaLa = new Set(choisis);
      limitees.slice().sort((a, b) => Number(quotas[a]) - Number(quotas[b])).forEach((id) => {
        const reste = suffixe(t, Number(quotas[id]));
        const candidats = pool.concat(etape.personnes_pour(machineId))
          .filter((x, i, arr) => arr.indexOf(x) === i && !dejaLa.has(x) && libreSur(reste, occPers(x)));
        candidats.sort((a, b) => (charge.get(a) || 0) - (charge.get(b) || 0) || (a < b ? -1 : 1));
        if (candidats.length) {
          presences[candidats[0]] = reste; dejaLa.add(candidats[0]);
        } else {
          problemes.push({ type: 'relais_manquant', bloquant: false, detail: `« ${ph.nom} » : après le départ d'une personne limitée en heures, aucun remplaçant disponible — personnel à affecter pour la suite.` });
        }
      });
    }
    if (machineId && ph.besoin_machine && choisis.length) t.forEach((x) => { const j = debutDeJour(x.d); if (!condEtape[j]) condEtape[j] = choisis[0]; });
    phasesRes.push({
      nom: ph.nom, type_phase: ph.type_phase || null, mer: !!ph.mer, duree_min: ph.duree_min, besoin_machine: !!ph.besoin_machine,
      repartissable: !!ph.repartissable, effectif: choisis.length || null, effectif_standard: Math.max(1, ph.nb_personnes || 1),
      duree_une_personne_min: ph.repartissable ? Math.round(ph.duree_standard_min * Math.max(1, ph.nb_personnes || 1)) : null,
      personnes: presences ? Object.keys(presences) : choisis,
      presences, segments: presences ? segmenter(t, presences, cal) : null,
      tranches: fusionner(t, cal), brutes: t,
    });
    c = t[t.length - 1].f;
  }

  const vus = new Set();
  const uniques = problemes.filter((p) => { const k = p.type + p.detail; if (vus.has(k)) return false; vus.add(k); return true; });
  return {
    machine_id: machineId,
    phases: phasesRes,
    debut_min: phasesRes.length ? phasesRes[0].tranches[0].d : curseur,
    fin_min: c,
    problemes: uniques,
  };
}

function planifierEtape(etape, curseur, ctx, charge, sync) {
  const vide = (problemes) => ({ index: etape.index, machine_id: null, phases: [], debut_min: null, fin_min: null, problemes });
  if (etape.non_chiffre) {
    // Si on connaît la vraie cause (ex: formule invalide), on l'affiche plutôt que le message générique.
    const causes = (etape.bloquants_chiffrage || []).map((b) => ({ type: b.type, bloquant: true, detail: b.detail }));
    return vide(causes.length ? causes : [{ type: 'non_chiffre', bloquant: true, detail: 'Étape non chiffrée : aucun temps standard ni durée manuelle.' }]);
  }
  const problemes = [];
  // Erreurs de chiffrage détectées en amont (ex: formule invalide) : bloquantes.
  (etape.bloquants_chiffrage || []).forEach((b) => problemes.push({ type: b.type, bloquant: true, detail: b.detail }));
  if (etape.parametres_manquants && etape.parametres_manquants.length) {
    problemes.push({ type: 'parametres_manquants', bloquant: true, detail: 'Paramètres de chiffrage à renseigner : la durée est sous-estimée.' });
  }
  const besoinMachine = etape.phases.some((p) => p.besoin_machine);
  let candidats;
  if (!besoinMachine) candidats = [null];
  else if (etape.machine_imposee) candidats = [etape.machine_imposee];
  else candidats = etape.machines_candidates || [];
  if (candidats.length === 0) {
    return vide(problemes.concat([{ type: 'sans_machine', bloquant: true, detail: 'Aucune machine compatible avec cette opération.' }]));
  }

  let meilleur = null;
  for (const m of candidats) {
    let essai;
    if (etape.journee && m) {
      // Travail « en journée » : aucun autre travail ne s'intercale entre son réglage et la fin de son roulage.
      // S'il y en a un, on repart derrière lui (le premier qui gêne), jusqu'à trouver un créneau d'un seul tenant.
      let cur = curseur;
      for (let k = 0; k < 400; k++) {
        essai = simulerJournee(etape, m, cur, ctx, charge, sync);
        if (!essai) break;
        const bloc = essai.phases.filter((p) => !p.mer && p.besoin_machine);
        if (!bloc.length) break;
        const d0 = Math.min(...bloc.map((p) => p.brutes[0].d)); const f0 = Math.max(...bloc.map((p) => p.brutes[p.brutes.length - 1].f));
        const gene = (ctx.occupation.machines[m] || []).filter((iv) => !iv.tag && iv.d < f0 && iv.f > d0);
        if (!gene.length) break;
        const suite = Math.min(...gene.map((iv) => iv.f));
        cur = Math.max(cur + 1, suite);
      }
    } else if (m && ctx.machinesJournee && ctx.machinesJournee.has(m)) {
      const occ = occupationAvecNettoyage(ctx.occupation.machines[m] || [], curseur, ctx.calendrier);
      essai = simulerEtape(etape, m, curseur, { ...ctx, occupation: { machines: { ...ctx.occupation.machines, [m]: occ }, personnes: ctx.occupation.personnes } }, charge, sync);
    } else essai = simulerEtape(etape, m, curseur, ctx, charge, sync);
    if (essai && (!meilleur || essai.fin_min < meilleur.fin_min)) meilleur = essai;
  }
  if (!meilleur) {
    return vide(problemes.concat([{ type: 'horizon_depasse', bloquant: true, detail: 'Impossible de placer cette étape dans l\'horizon de planification.' }]));
  }

  return {
    index: etape.index,
    machine_id: meilleur.machine_id,
    phases: meilleur.phases,
    debut_min: meilleur.debut_min,
    fin_min: meilleur.fin_min,
    problemes: problemes.concat(meilleur.problemes),
  };
}

// Inscrit ce qu'une étape vient de placer : les étapes suivantes (notamment
// celles d'une branche parallèle) doivent en tenir compte.
function inscrire(res, ctx, charge) {
  if (res.fin_min === null) return;
  res.phases.forEach((ph) => {
    ph.tranches.forEach((t) => {
      const iv = ph.mer ? { d: t.d, f: t.f, tag: 'mer' } : { d: t.d, f: t.f };
      if (ph.besoin_machine && res.machine_id) {
        (ctx.occupation.machines[res.machine_id] ??= []).push(iv);
        const ref = ph.personnes && ph.personnes[0];   // premier conducteur posé ce jour-là sur la machine : il conduira tout le reste de la journée
        if (ref) { const reg = ((ctx.conducteurs ??= {})[res.machine_id] ??= {}); const J = debutDeJour(t.d); if (!reg[J]) reg[J] = ref; }
      }
      if (!ph.presences) ph.personnes.forEach((p) => (ctx.occupation.personnes[p] ??= []).push(iv));
    });
    if (ph.presences) {
      Object.entries(ph.presences).forEach(([p, ivs]) => {
        ivs.forEach((iv) => (ctx.occupation.personnes[p] ??= []).push({ d: iv.d, f: iv.f }));
        charge.set(p, (charge.get(p) || 0) + ivs.reduce((tt, x) => tt + (x.f - x.d), 0));
      });
    } else {
      ph.personnes.forEach((p) => charge.set(p, (charge.get(p) || 0) + ph.duree_min));
    }
  });
}

// Instant où une étape déjà placée atteint `pct` % de son travail.
function instantAtteint(pr, pct) {
  const p = Number.isFinite(Number(pct)) ? Math.max(0, Math.min(100, Number(pct))) : 10;
  const cible = Math.round(pr.duree * p / 100);
  if (cible <= 0) return pr.debut;
  let cumul = 0;
  for (const t of pr.brutes) {
    const l = t.f - t.d;
    if (cumul + l >= cible) return t.d + (cible - cumul);
    cumul += l;
  }
  return pr.fin;
}

// Contraintes d'un lien « étape ← prédécesseur ». Trois types, cumulables :
//   fin        : démarre quand le prédécesseur est TERMINÉ ;
//   debut      : démarre dès que le prédécesseur a DÉMARRÉ ;
//   progressif : démarre dès seuil_pct % du prédécesseur fait, sans pouvoir finir avant lui.
// Ancien format (sans indicateurs) : absent = « fin » ; { mode: 'progressif', seuil_pct } = progressif.
function contraintesLien(lien) {
  if (lien && lien.en_ligne) return { fin: false, debut: true, progressif: false, en_ligne: true, seuil_pct: 10 };
  if (!lien) return { fin: true, debut: false, progressif: false, seuil_pct: 10 };
  const explicite = 'fin' in lien || 'debut' in lien || 'progressif' in lien;
  const pct = Number.isFinite(Number(lien.seuil_pct)) ? Math.max(0, Math.min(100, Number(lien.seuil_pct))) : 10;
  if (!explicite) {
    return lien.mode === 'progressif' ? { fin: false, debut: false, progressif: true, seuil_pct: pct } : { fin: true, debut: false, progressif: false, seuil_pct: pct };
  }
  const c = { fin: !!lien.fin, debut: !!lien.debut, progressif: !!lien.progressif, seuil_pct: pct };
  if (!c.fin && !c.debut && !c.progressif) c.fin = true;
  return c;
}

// Ordre de traitement des étapes : un prédécesseur est toujours traité avant
// son successeur, QUELLE QUE SOIT sa position dans la liste (ou son numéro).
//   preds[i] : positions des prédécesseurs de la position i.
// Renvoie { ordre: [positions], cycle: [positions] } — `cycle` est vide si le
// réseau est valide ; sinon il contient les étapes prises dans une boucle.
// À égalité, l'ordre de la liste est conservé (résultat stable).
function ordreTopologique(preds) {
  const n = preds.length;
  const restants = preds.map((ps) => new Set(ps));
  const fait = new Array(n).fill(false);
  const ordre = [];
  while (ordre.length < n) {
    let prochain = -1;
    for (let i = 0; i < n; i++) {
      if (!fait[i] && restants[i].size === 0) { prochain = i; break; }
    }
    if (prochain === -1) {
      return { ordre, cycle: Array.from({ length: n }, (_, i) => i).filter((i) => !fait[i]) };
    }
    fait[prochain] = true;
    ordre.push(prochain);
    restants.forEach((r) => r.delete(prochain));
  }
  return { ordre, cycle: [] };
}

// Prédécesseurs (en positions) d'une liste d'étapes : null = étape précédente de la liste.
function predecesseursEnPositions(etapes) {
  const pos = new Map(etapes.map((e, i) => [e.index, i]));
  return etapes.map((e, i) => (e.predecesseurs ?? (i > 0 ? [etapes[i - 1].index] : []))
    .filter((p) => pos.has(p) && pos.get(p) !== i).map((p) => pos.get(p)));
}

// Planification vers l'avant : démarre au plus tôt à `debutMin`.
//   etape.predecesseurs : indices des étapes à terminer d'abord
//                         (absent/null : l'étape précédente ; [] : aucune dépendance).
//   etape.liens         : { [indice du prédécesseur]: { mode: 'progressif', seuil_pct } }
//                         sinon le lien est « attendre la fin ».
function planifierAvant(entree, debutMin) {
  const ctx = { calendrier: entree.calendrier, occupation: cloner(entree.occupation), conducteurs: JSON.parse(JSON.stringify(entree.conducteurs || {})) };
  // Machines « en journée » : celles où passe un travail avec mise en route (cet OF ou d'autres déjà planifiés).
  ctx.machinesJournee = new Set();
  (entree.etapes || []).forEach((e) => { if (e.journee) (e.machine_imposee ? [e.machine_imposee] : (e.machines_candidates || [])).forEach((m) => ctx.machinesJournee.add(m)); });
  Object.entries(entree.occupation.machines || {}).forEach(([m, ivs]) => { if (ivs.some((iv) => iv.tag === 'mer')) ctx.machinesJournee.add(m); });
  const charge = new Map();
  const resultats = new Map();   // index -> { debut, fin, duree, brutes } : point de départ des suivantes
  const etapes = [];

  const topo = ordreTopologique(predecesseursEnPositions(entree.etapes));
  // En cas de boucle (refusée à la saisie), les étapes concernées sont traitées à la suite, dans l'ordre de la liste.
  const ordreTraitement = topo.ordre.concat(topo.cycle);

  ordreTraitement.forEach((pos) => {
    const etape = entree.etapes[pos];
    const preds = etape.predecesseurs ?? (pos > 0 ? [entree.etapes[pos - 1].index] : []);
    const liens = etape.liens || {};
    let depart = debutMin;
    let sync = null;   // fenêtre de production du prédécesseur (étape en ligne)
    let finMinRequise = 0;       // lien progressif : on ne peut pas finir avant la fin du prédécesseur
    preds.forEach((p) => {
      const pr = resultats.get(p);
      if (!pr) return;
      const c = contraintesLien(liens[p]);
      const mesurable = !!(pr.brutes && pr.brutes.length);
      // Sans tranches mesurables (étape déjà faite, impossible à placer) : « progressif » se ramène à « fin ».
      if (c.fin || (c.progressif && !mesurable)) depart = Math.max(depart, pr.fin);
      if (c.debut) depart = Math.max(depart, pr.debut);
      if (c.en_ligne) {
        if (pr.prod) sync = { debut: Math.max(sync ? sync.debut : 0, pr.prod.d), fin: Math.max(sync ? sync.fin : 0, pr.prod.f) };
        else depart = Math.max(depart, pr.fin);   // prédécesseur sans production mesurable : on attend sa fin
      }
      if (c.progressif && mesurable) {
        depart = Math.max(depart, instantAtteint(pr, c.seuil_pct));
        finMinRequise = Math.max(finMinRequise, pr.fin);
      }
    });
    // Délai d'attente minimal (séchage…) : le départ est repoussé de N minutes après la fin réelle de l'étape attendue.
    Object.entries(etape.delais || {}).forEach(([p, minutes]) => {
      const pr = resultats.get(Number(p));
      if (pr && pr.reel && Number(minutes) > 0) depart = Math.max(depart, pr.fin + Number(minutes));
    });

    if (etape.fixe) {
      const fin = etape.fin_min !== null && etape.fin_min !== undefined ? Math.max(depart, etape.fin_min) : depart;
      resultats.set(etape.index, { debut: depart, fin, duree: 0, brutes: null, reel: etape.fin_min !== null && etape.fin_min !== undefined });
      etapes.push({ index: etape.index, fixe: true, machine_id: null, phases: [], debut_min: null, fin_min: etape.fin_min ?? null, problemes: [] });
      return;
    }

    let res = planifierEtape(etape, depart, ctx, charge, sync);
    if (res.fin_min !== null && res.phases.length && finMinRequise > 0 && res.fin_min < finMinRequise) {
      // Démarrage progressif : l'étape irait plus vite que son prédécesseur ne produit.
      // On cherche le plus petit départ pour lequel elle ne finit pas avant lui.
      let lo = depart; let hi = finMinRequise; let atteint = null;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        const r = planifierEtape(etape, mid, ctx, charge, sync);
        if (r.fin_min !== null && r.fin_min >= finMinRequise) { hi = mid; atteint = r; } else { lo = mid; }
      }
      res = atteint || planifierEtape(etape, hi, ctx, charge, sync);
    }
    inscrire(res, ctx, charge);
    etapes.push(res);

    if (res.fin_min !== null) {
      const brutes = res.phases.flatMap((ph) => ph.brutes);
      const prods = res.phases.filter((ph) => ph.type_phase === 'production').flatMap((ph) => ph.brutes);
      const prod = prods.length ? { d: Math.min(...prods.map((x) => x.d)), f: Math.max(...prods.map((x) => x.f)) } : null;
      resultats.set(etape.index, { debut: res.debut_min, fin: res.fin_min, duree: brutes.reduce((t, x) => t + (x.f - x.d), 0), brutes, prod, reel: true });
    } else {
      // Étape impossible à placer : elle ne retarde pas ses successeurs (qui repartent de leur propre départ).
      resultats.set(etape.index, { debut: depart, fin: depart, duree: 0, brutes: null });
    }
  });

  // Résultats remis dans l'ordre de la liste (et non dans l'ordre de traitement).
  etapes.sort((a, b) => a.index - b.index);
  const planifiees = etapes.filter((e) => !e.fixe);
  const placees = planifiees.filter((e) => e.debut_min !== null);
  return {
    etapes,
    debut_min: placees.length ? Math.min(...placees.map((e) => e.debut_min)) : null,
    fin_min: placees.length ? Math.max(...placees.map((e) => e.fin_min)) : null,
    complet: planifiees.every((e) => e.fin_min !== null),
  };
}

// Planification vers l'arrière : l'OF doit être terminé au plus tard à
// `finMaxMin`. On cherche le démarrage le plus TARDIF qui tient dans le
// délai (dichotomie sur la date de début), sans démarrer avant `plancherMin`.
// Si même un démarrage au plancher dépasse le délai, on renvoie ce plan-là,
// marqué comme ne respectant pas le délai.
function planifierArriere(entree, finMaxMin, plancherMin) {
  const auPlancher = planifierAvant(entree, plancherMin);
  if (!auPlancher.complet || auPlancher.fin_min > finMaxMin) {
    return Object.assign(auPlancher, {
      respecte_delai: false,
      retard_min: auPlancher.complet ? auPlancher.fin_min - finMaxMin : null,
      debut_demande_min: plancherMin,
    });
  }
  let lo = plancherMin; let hi = finMaxMin; let meilleur = auPlancher;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const r = planifierAvant(entree, mid);
    if (r.complet && r.fin_min <= finMaxMin) { lo = mid; meilleur = r; } else { hi = mid; }
  }
  return Object.assign(meilleur, {
    respecte_delai: true, retard_min: 0, marge_min: finMaxMin - meilleur.fin_min, debut_demande_min: lo,
  });
}

// Réseau PERT / chemin critique (méthode CPM). Ne regarde QUE les durées et
// les dépendances (pas les ressources ni le calendrier) : c'est la durée
// minimale théorique de l'OF et la marge de chaque étape.
//   noeuds : [{ index, duree_min, predecesseurs: [index] | null,
//               liens?: { [index du prédécesseur]: { mode: 'progressif', seuil_pct } } }]
//            dans l'ordre (un prédécesseur est toujours placé avant son successeur).
// Lien normal : l'étape démarre quand la précédente est finie.
// Lien progressif : elle démarre dès que seuil_pct % de la précédente est fait
// (décalage = seuil_pct % de sa durée) et ne peut pas finir avant elle.
// Marge d'une étape = de combien elle peut glisser sans retarder l'OF.
// Une étape de marge nulle est CRITIQUE.
function analyserReseau(noeuds) {
  const pos = new Map(noeuds.map((n, i) => [n.index, i]));
  const preds = noeuds.map((n, i) => (n.predecesseurs ?? (i > 0 ? [noeuds[i - 1].index] : []))
    .filter((p) => pos.has(p) && pos.get(p) !== i));
  const d = noeuds.map((n) => n.duree_min);
  // Contraintes du lien i ← pIdx : « fin », décalage de démarrage (début / progressif), fin minimale (progressif).
  const lienDe = (i, pIdx) => {
    const c = contraintesLien((noeuds[i].liens || {})[noeuds[pIdx].index]);
    // En ligne : démarre avec le prédécesseur (réglages en parallèle) ; la production attend la sienne et ne finit pas avant elle.
    const decalage = c.en_ligne ? Math.max(0, (noeuds[pIdx].reglage_min || 0) - (noeuds[i].reglage_min || 0))
      : (c.progressif ? Math.round(d[pIdx] * c.seuil_pct / 100) : 0);
    return { fin: c.fin, depart: c.debut || c.progressif, decalage, finMin: c.progressif || !!c.en_ligne };
  };

  const topo = ordreTopologique(preds.map((ps) => ps.map((p) => pos.get(p))));
  const ordre = topo.ordre.concat(topo.cycle);
  const es = []; const ef = [];
  ordre.forEach((i) => {
    const n = noeuds[i];
    let debut = 0; let finMin = 0;
    preds[i] = preds[i].filter((p) => es[pos.get(p)] !== undefined);
    preds[i].forEach((p) => {
      const j = pos.get(p); const lien = lienDe(i, j);
      if (lien.fin) debut = Math.max(debut, ef[j]);
      if (lien.depart) debut = Math.max(debut, es[j] + lien.decalage);
      if (lien.finMin) finMin = Math.max(finMin, ef[j]);
    });
    es[i] = debut;
    ef[i] = Math.max(debut + d[i], finMin);
  });
  const total = Math.max(0, ...ef);

  const succ = noeuds.map(() => []);
  preds.forEach((ps, i) => ps.forEach((p) => succ[pos.get(p)].push(i)));
  const lf = []; const ls = [];
  for (let k = ordre.length - 1; k >= 0; k--) {
    const i = ordre[k];
    let fin = total; let borneDebut = Infinity;
    succ[i].forEach((j) => {
      const lien = lienDe(j, i);
      if (lien.fin) fin = Math.min(fin, ls[j]);
      if (lien.depart) borneDebut = Math.min(borneDebut, ls[j] - lien.decalage);
      if (lien.finMin) fin = Math.min(fin, lf[j]);
    });
    lf[i] = fin;
    ls[i] = Math.min(fin - d[i], borneDebut);
  }
  return {
    duree_totale_min: total,
    noeuds: noeuds.map((n, i) => ({
      index: n.index, duree_min: d[i], predecesseurs: preds[i],
      es: es[i], ef: ef[i], ls: ls[i], lf: lf[i], marge_min: ls[i] - es[i],
      critique: d[i] > 0 && ls[i] === es[i],
    })),
  };
}

module.exports = {
  enMinutes, dateDe, heureDe, debutDeJour, hhmm, MIN_JOUR, HORIZON_JOURS, NETTOYAGE_MIN,
  joursFeries, libelleFerie, estOuvre,
  dureeAvecEffectif, fenetresDuJour, soustraire, consommer, fusionner, ordreTopologique, contraintesLien, planifierAvant, planifierArriere, analyserReseau,
};
