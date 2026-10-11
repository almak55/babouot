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

const estOuvre = (jourMin) => {
  const j = new Date(jourMin * 60000).getUTCDay();
  if (j === 0 || j === 6) return false;
  return !libelleFerie(dateDe(jourMin));
};

// Plages de travail d'un jour (avant/après la pause).
function fenetresDuJour(jour, cal) {
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
function consommer(dureeMin, depuisMin, occupes, cal) {
  let reste = dureeMin;
  const tranches = [];
  const finHorizon = debutDeJour(depuisMin) + HORIZON_JOURS * MIN_JOUR;
  for (let jour = debutDeJour(depuisMin); jour < finHorizon && reste > 0; jour += MIN_JOUR) {
    if (!estOuvre(jour)) continue;
    for (const [a0, b] of fenetresDuJour(jour, cal)) {
      const a = Math.max(a0, depuisMin);
      if (b <= a) continue;
      for (const l of soustraire({ d: a, f: b }, occupes)) {
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

function simulerEtape(etape, machineId, curseur, ctx, charge) {
  const cal = ctx.calendrier;
  const occMachine = machineId ? (ctx.occupation.machines[machineId] || []) : [];
  const occPers = (id) => ctx.occupation.personnes[id] || [];
  const imposees = etape.personnes_imposees && etape.personnes_imposees.length ? etape.personnes_imposees : null;
  const pool = imposees || etape.personnes_pour(machineId);
  const phasesRes = [];
  const problemes = [];
  let c = curseur;

  for (const ph of etape.phases) {
    if (ph.duree_min <= 0) continue;
    const occMach = ph.besoin_machine ? occMachine : [];
    let choisis;
    if (imposees) {
      choisis = imposees;
    } else {
      const k = Math.max(1, ph.nb_personnes || 1);
      if (pool.length === 0) {
        choisis = [];
        problemes.push({ type: 'sans_personnel', bloquant: false, detail: `Aucune personne compétente trouvée pour « ${ph.nom} » : personnel à affecter.` });
      } else {
        const notes = pool.map((id) => {
          const t = consommer(ph.duree_min, c, [].concat(occMach, occPers(id)), cal);
          return { id, fin: t ? t[t.length - 1].f : Infinity, charge: charge.get(id) || 0 };
        });
        notes.sort((a, b) => a.fin - b.fin || a.charge - b.charge || (a.id < b.id ? -1 : 1));
        choisis = notes.slice(0, k).map((n) => n.id);
        if (pool.length < k) {
          problemes.push({ type: 'effectif_incomplet', bloquant: false, detail: `« ${ph.nom} » demande ${k} personnes, ${pool.length} compétente(s) seulement.` });
        }
      }
    }
    const occupes = [].concat(occMach, ...choisis.map(occPers));
    const t = consommer(ph.duree_min, c, occupes, cal);
    if (!t) return null;
    phasesRes.push({ nom: ph.nom, duree_min: ph.duree_min, besoin_machine: !!ph.besoin_machine, personnes: choisis, tranches: fusionner(t, cal), brutes: t });
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

function planifierEtape(etape, curseur, ctx, charge) {
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
    const essai = simulerEtape(etape, m, curseur, ctx, charge);
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
      const iv = { d: t.d, f: t.f };
      if (ph.besoin_machine && res.machine_id) (ctx.occupation.machines[res.machine_id] ??= []).push(iv);
      ph.personnes.forEach((p) => (ctx.occupation.personnes[p] ??= []).push(iv));
    });
    ph.personnes.forEach((p) => charge.set(p, (charge.get(p) || 0) + ph.duree_min));
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
  const ctx = { calendrier: entree.calendrier, occupation: cloner(entree.occupation) };
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
    let finMinRequise = 0;       // lien progressif : on ne peut pas finir avant la fin du prédécesseur
    preds.forEach((p) => {
      const pr = resultats.get(p);
      if (!pr) return;
      const lien = liens[p];
      if (lien && lien.mode === 'progressif' && pr.brutes && pr.brutes.length) {
        depart = Math.max(depart, instantAtteint(pr, lien.seuil_pct));
        finMinRequise = Math.max(finMinRequise, pr.fin);
      } else {
        depart = Math.max(depart, pr.fin);
      }
    });

    if (etape.fixe) {
      const fin = etape.fin_min !== null && etape.fin_min !== undefined ? Math.max(depart, etape.fin_min) : depart;
      resultats.set(etape.index, { debut: depart, fin, duree: 0, brutes: null });
      etapes.push({ index: etape.index, fixe: true, machine_id: null, phases: [], debut_min: null, fin_min: etape.fin_min ?? null, problemes: [] });
      return;
    }

    let res = planifierEtape(etape, depart, ctx, charge);
    if (res.fin_min !== null && res.phases.length && finMinRequise > 0 && res.fin_min < finMinRequise) {
      // Démarrage progressif : l'étape irait plus vite que son prédécesseur ne produit.
      // On cherche le plus petit départ pour lequel elle ne finit pas avant lui.
      let lo = depart; let hi = finMinRequise; let atteint = null;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        const r = planifierEtape(etape, mid, ctx, charge);
        if (r.fin_min !== null && r.fin_min >= finMinRequise) { hi = mid; atteint = r; } else { lo = mid; }
      }
      res = atteint || planifierEtape(etape, hi, ctx, charge);
    }
    inscrire(res, ctx, charge);
    etapes.push(res);

    if (res.fin_min !== null) {
      const brutes = res.phases.flatMap((ph) => ph.brutes);
      resultats.set(etape.index, { debut: res.debut_min, fin: res.fin_min, duree: brutes.reduce((t, x) => t + (x.f - x.d), 0), brutes });
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
  const lienDe = (i, pIdx) => {
    const l = (noeuds[i].liens || {})[noeuds[pIdx].index];
    if (!l || l.mode !== 'progressif') return null;
    const pct = Number.isFinite(Number(l.seuil_pct)) ? Math.max(0, Math.min(100, Number(l.seuil_pct))) : 10;
    return { decalage: Math.round(d[pIdx] * pct / 100) };
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
      if (lien) { debut = Math.max(debut, es[j] + lien.decalage); finMin = Math.max(finMin, ef[j]); }
      else debut = Math.max(debut, ef[j]);
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
      if (lien) { borneDebut = Math.min(borneDebut, ls[j] - lien.decalage); fin = Math.min(fin, lf[j]); }
      else fin = Math.min(fin, ls[j]);
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
  enMinutes, dateDe, heureDe, debutDeJour, hhmm, MIN_JOUR, HORIZON_JOURS,
  joursFeries, libelleFerie, estOuvre,
  fenetresDuJour, soustraire, consommer, fusionner, ordreTopologique, planifierAvant, planifierArriere, analyserReseau,
};
