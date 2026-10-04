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
//   - on ne travaille que du lundi au vendredi, dans les plages du
//     calendrier (ex: 08:00-12:00 et 12:30-16:30) ;
//   - une phase ne démarre qu'une fois la précédente terminée
//     (enchaînement strict pour l'instant — pas de parallélisme) ;
//   - une phase avance uniquement quand TOUTES ses ressources (machine
//     si elle en utilise une, personnes requises) sont libres, et se
//     met en pause sinon (nuit, pause, absence, autre tâche) ;
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
const estOuvre = (jourMin) => { const j = new Date(jourMin * 60000).getUTCDay(); return j !== 0 && j !== 6; };

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

function simulerEtape(etape, machineId, curseur, entree, charge) {
  const cal = entree.calendrier;
  const occMachine = machineId ? (entree.occupation.machines[machineId] || []) : [];
  const occPers = (id) => entree.occupation.personnes[id] || [];
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
    phasesRes.push({ nom: ph.nom, duree_min: ph.duree_min, besoin_machine: !!ph.besoin_machine, personnes: choisis, tranches: fusionner(t, cal) });
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

function planifierEtape(etape, curseur, entree, charge) {
  const vide = (problemes) => ({ index: etape.index, machine_id: null, phases: [], debut_min: null, fin_min: null, problemes });
  if (etape.non_chiffre) {
    return vide([{ type: 'non_chiffre', bloquant: true, detail: 'Étape non chiffrée : aucun temps standard ni durée manuelle.' }]);
  }
  const problemes = [];
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
    const essai = simulerEtape(etape, m, curseur, entree, charge);
    if (essai && (!meilleur || essai.fin_min < meilleur.fin_min)) meilleur = essai;
  }
  if (!meilleur) {
    return vide(problemes.concat([{ type: 'horizon_depasse', bloquant: true, detail: 'Impossible de placer cette étape dans l\'horizon de planification.' }]));
  }
  meilleur.phases.forEach((ph) => ph.personnes.forEach((p) => charge.set(p, (charge.get(p) || 0) + ph.duree_min)));
  return {
    index: etape.index,
    machine_id: meilleur.machine_id,
    phases: meilleur.phases,
    debut_min: meilleur.debut_min,
    fin_min: meilleur.fin_min,
    problemes: problemes.concat(meilleur.problemes),
  };
}

// Planification vers l'avant : démarre au plus tôt à `debutMin`.
function planifierAvant(entree, debutMin) {
  const charge = new Map();
  let curseur = debutMin;
  const etapes = [];
  for (const etape of entree.etapes) {
    if (etape.fixe) {
      if (etape.fin_min !== null && etape.fin_min !== undefined) curseur = Math.max(curseur, etape.fin_min);
      etapes.push({ index: etape.index, fixe: true, machine_id: null, phases: [], debut_min: null, fin_min: etape.fin_min ?? null, problemes: [] });
      continue;
    }
    const res = planifierEtape(etape, curseur, entree, charge);
    etapes.push(res);
    if (res.fin_min !== null) curseur = Math.max(curseur, res.fin_min);
  }
  const planifiees = etapes.filter((e) => !e.fixe);
  const avecHoraires = planifiees.filter((e) => e.debut_min !== null);
  return {
    etapes,
    debut_min: avecHoraires.length ? avecHoraires[0].debut_min : null,
    fin_min: avecHoraires.length ? curseur : null,
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

module.exports = {
  enMinutes, dateDe, heureDe, debutDeJour, hhmm, MIN_JOUR, HORIZON_JOURS,
  fenetresDuJour, soustraire, consommer, fusionner, planifierAvant, planifierArriere,
};
