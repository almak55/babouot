// lib/rapport-analyse.js
//
// Rapport de production d'un OF : analyse PURE (aucun accès base) des données collectées par rapport-of.js.
//   entrée  : { of, aujourdhui, etapes, personnel, journal, interventions, absences, partages, taux_horaire }
//   sortie  : identité, délai, cycle, indicateurs, détail par étape, personnel, machines, chronologie, changements, aléas,
//             retour d'expérience (points forts / points à améliorer) et plan d'amélioration chiffré.
//
// Les constats s'appuient uniquement sur ce qui a été enregistré (planning, production saisie, journal, interventions, absences) :
// une donnée non saisie est signalée comme telle, jamais estimée.

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const num = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) ? n : null; };

const SEUIL_DEPASSEMENT_PCT = 10;     // heures réelles au-delà du standard : dépassement
const SEUIL_AVANCE_PCT = -15;         // heures réelles très en dessous du standard : standard probablement surestimé
const SEUIL_ACTION_PCT = 15;          // écart à partir duquel on propose de recaler le temps standard

// ---------- dates ----------
const dj = (iso) => new Date(String(iso).slice(0, 10) + 'T12:00:00Z');
const ajoute = (iso, n) => { const d = dj(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const estOuvre = (iso) => { const j = dj(iso).getUTCDay(); return j !== 0 && j !== 6; };
// Jours ouvrés (lundi-vendredi) entre deux dates : positif si b est après a ; 0 le même jour.
function joursOuvres(a, b) {
  if (!a || !b) return null;
  a = String(a).slice(0, 10); b = String(b).slice(0, 10);
  if (a === b) return 0;
  const sens = b > a ? 1 : -1;
  let n = 0, d = a;
  for (let g = 0; g < 4000 && d !== b; g++) { d = ajoute(d, sens); if (estOuvre(d)) n += sens; }
  return n;
}
const jours = (a, b) => (a && b ? Math.round((dj(b) - dj(a)) / 86400000) : null);
const parisDate = (ts) => { if (!ts) return null; try { return new Date(ts).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' }); } catch (e) { return String(ts).slice(0, 10); } };
const parisHeure = (ts) => { if (!ts) return ''; try { return new Date(ts).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const hm = (t) => { const [h, m] = String(t).slice(0, 5).split(':'); return Number(h) * 60 + Number(m); };
const minutesCreneau = (c) => {
  if (!c.debut || !c.fin) return 0;
  const d = hm(c.debut), f = hm(c.fin);
  return Math.max(0, f - d - Math.max(0, Math.min(f, 750) - Math.max(d, 720)));   // pause 12h00-12h30 déduite
};
const hFr = (h) => { if (h === null || h === undefined) return '—'; const m = Math.round(h * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };

function periodes(datesIso) {   // dates -> périodes de jours ouvrés consécutifs
  const tri = Array.from(new Set(datesIso)).sort(); const out = [];
  tri.forEach((d) => {
    const der = out[out.length - 1];
    if (der) { let n = ajoute(der.au, 1); while (!estOuvre(n) && n < d) n = ajoute(n, 1); if (n === d) { der.au = d; der.jours++; return; } }
    out.push({ du: d, au: d, jours: 1 });
  });
  return out;
}

function analyser(D) {
  const of = D.of || {};
  const aujourdhui = D.aujourdhui;
  const nomP = (id) => (D.personnel && D.personnel[id] ? D.personnel[id].nom : '?');
  const journal = (D.journal || []).slice().sort((a, b) => String(a.date_evt).localeCompare(String(b.date_evt)));
  const qualite = [];

  // ---------- plan initial / dernier plan (journal) ----------
  const plans = journal.filter((j) => (j.type === 'planification' || j.type === 'replanification') && j.details);
  const planInitial = plans[0] || null;
  const dernierPlan = plans[plans.length - 1] || null;
  const initialParSeq = {}; ((planInitial && planInitial.details.etapes) || []).forEach((e) => { initialParSeq[e.sequence] = e; });
  const replanifs = journal.filter((j) => j.type === 'replanification');
  const recalages = journal.filter((j) => j.type === 'recalage');
  const changementsDelai = journal.filter((j) => j.type === 'delai');
  const saisiesJournal = journal.filter((j) => j.type === 'saisie');

  // ---------- étapes ----------
  const etapes = (D.etapes || []).slice().sort((a, b) => a.sequence - b.sequence).map((e) => {
    const sais = (e.saisies || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const pers = e.saisies_personne || [];
    const somme = (k) => sais.reduce((t, l) => t + (num(l[k]) || 0), 0);
    const aDetail = sais.some((l) => num(l.heures_reglage) !== null || num(l.heures_production) !== null);
    const hReg = aDetail ? somme('heures_reglage') : null;
    const hProd = aDetail ? somme('heures_production') : null;
    const hTot = sais.some((l) => num(l.heures_reelles) !== null || num(l.heures_reglage) !== null || num(l.heures_production) !== null)
      ? sais.reduce((t, l) => t + (num(l.heures_reelles) !== null ? num(l.heures_reelles) : (num(l.heures_reglage) || 0) + (num(l.heures_production) || 0)), 0) : null;
    const quantite = sais.reduce((t, l) => t + (num(l.quantite) || 0), 0);
    const debutReel = sais.length ? String(sais[0].date).slice(0, 10) : null;
    const finReelle = e.date_fin_reelle ? String(e.date_fin_reelle).slice(0, 10) : (e.statut === 'terminé' && sais.length ? String(sais[sais.length - 1].date).slice(0, 10) : null);
    const creneaux = e.creneaux || [];
    const datesPlan = creneaux.map((c) => c.date).sort();
    const ini = initialParSeq[e.sequence] || null;
    const std = e.std || {};
    const stdTot = num(std.heures_personnes);
    const ecartH = hTot !== null && stdTot !== null && stdTot > 0 ? hTot - stdTot : null;
    const ecartPct = ecartH !== null ? (ecartH / stdTot) * 100 : null;
    const termine = e.statut === 'terminé';
    let verdict = 'non_saisi';
    if (hTot !== null && stdTot > 0 && termine) verdict = ecartPct > SEUIL_DEPASSEMENT_PCT ? 'depassement' : (ecartPct < SEUIL_AVANCE_PCT ? 'avance' : 'conforme');
    else if (hTot !== null && stdTot > 0) verdict = 'en_cours';
    const cadStd = num(std.production_h) > 0 && num(e.quantite_etape) > 0 ? e.quantite_etape / std.production_h : null;
    const cadReelle = hProd !== null && hProd > 0 && quantite > 0 ? quantite / hProd : null;
    const personnes = Array.from(new Set([...pers.map((x) => x.personnel_id), ...creneaux.flatMap((c) => c.personnes || [])].filter(Boolean)));
    const heuresParPersonne = {};
    pers.forEach((x) => { if (x.personnel_id) heuresParPersonne[x.personnel_id] = (heuresParPersonne[x.personnel_id] || 0) + (num(x.heures_reglage) || 0) + (num(x.heures_production) || 0); });
    const machines = Array.from(new Set(creneaux.map((c) => c.machine).filter(Boolean)));
    if (e.machine && !machines.includes(e.machine)) machines.unshift(e.machine);
    const finPrevueInitiale = ini && ini.fin ? String(ini.fin).slice(0, 10) : null;
    const debutPrevuInitial = ini && ini.debut ? String(ini.debut).slice(0, 10) : null;
    const finPrevueActuelle = datesPlan.length ? datesPlan[datesPlan.length - 1] : null;
    return {
      gamme_id: e.gamme_id, sequence: e.sequence, operation: e.operation, statut: e.statut, avancement_pct: num(e.avancement_pct) || 0,
      machines, machine_prevue: e.machine || null,
      quantite_etape: num(e.quantite_etape), unite_quantite: e.unite_quantite || null, quantite_realisee: r2(quantite),
      std: { reglage_h: num(std.reglage_h), production_h: num(std.production_h), total_h: stdTot, chiffre: std.chiffre !== false, manuelle: !!std.manuelle, delai_attente_h: num(std.delai_attente_h) },
      reel: { reglage_h: hReg !== null ? r2(hReg) : null, production_h: hProd !== null ? r2(hProd) : null, total_h: hTot !== null ? r2(hTot) : null, nb_saisies: sais.length, jours_saisis: sais.length },
      ecart_h: ecartH !== null ? r2(ecartH) : null, ecart_pct: ecartPct !== null ? r1(ecartPct) : null, verdict,
      cadence_std: cadStd !== null ? Math.round(cadStd) : null, cadence_reelle: cadReelle !== null ? Math.round(cadReelle) : null,
      debut_prevu_initial: debutPrevuInitial, fin_prevue_initiale: finPrevueInitiale, fin_prevue_actuelle: finPrevueActuelle,
      debut_reel: debutReel, fin_reelle: finReelle,
      ecart_fin_jours: finReelle && (finPrevueInitiale || finPrevueActuelle) ? joursOuvres(finPrevueInitiale || finPrevueActuelle, finReelle) : null,
      ref_ecart_fin: finPrevueInitiale ? 'plan initial' : (finPrevueActuelle ? 'dernier plan' : null),
      personnes: personnes.map(nomP), heures_par_personne: Object.fromEntries(Object.entries(heuresParPersonne).map(([id, h]) => [nomP(id), r2(h)])),
      commentaires: sais.filter((l) => l.commentaire).map((l) => ({ date: String(l.date).slice(0, 10), texte: l.commentaire })),
      predecesseurs: e.predecesseurs || null,
      nb_creneaux: creneaux.length, minutes_planifiees: creneaux.reduce((t, c) => t + minutesCreneau(c), 0),
    };
  });
  // attente entre la fin de l'étape précédente et le début réel
  const parSeq = Object.fromEntries(etapes.map((e) => [e.sequence, e]));
  etapes.forEach((e, i) => {
    const preds = (Array.isArray(e.predecesseurs) ? e.predecesseurs : (i > 0 ? [etapes[i - 1].sequence] : [])).map((s) => parSeq[s]).filter(Boolean);
    const finsPred = preds.map((p) => p.fin_reelle).filter(Boolean).sort();
    e.attente_jours = e.debut_reel && finsPred.length ? Math.max(0, joursOuvres(finsPred[finsPred.length - 1], e.debut_reel)) : null;
  });

  // ---------- dates et délai ----------
  const premiereProd = etapes.map((e) => e.debut_reel).filter(Boolean).sort()[0] || null;
  const finsReelles = etapes.map((e) => e.fin_reelle).filter(Boolean).sort();
  const toutTermine = etapes.length > 0 && etapes.every((e) => e.statut === 'terminé');
  const finReelle = toutTermine ? (finsReelles[finsReelles.length - 1] || null) : null;
  const derniereProd = etapes.flatMap((e) => (e.reel.nb_saisies ? [e.fin_reelle || e.debut_reel] : [])).filter(Boolean).sort().pop() || null;
  const provisoire = !(of.statut === 'terminé' || toutTermine);
  const delai = of.delai ? String(of.delai).slice(0, 10) : null;
  const finPrevueInit = planInitial && planInitial.details.fin ? String(planInitial.details.fin).slice(0, 10) : null;
  const finRef = finReelle || null;
  const ecartDelaiOuvres = delai && finRef ? joursOuvres(delai, finRef) : null;   // > 0 : en retard
  const respecte = delai && finRef ? finRef <= delai : null;
  const debutCycle = premiereProd;
  const finCycle = finReelle || derniereProd;
  const cycle = {
    debut: debutCycle, fin: finCycle,
    jours_calendaires: debutCycle && finCycle ? jours(debutCycle, finCycle) + 1 : null,
    jours_ouvres: debutCycle && finCycle ? joursOuvres(debutCycle, finCycle) + 1 : null,
    jours_production: new Set(etapes.flatMap((e) => []).concat((D.etapes || []).flatMap((x) => (x.saisies || []).map((l) => String(l.date).slice(0, 10))))).size,
    avant_lancement_jours: of.created_at && debutCycle ? jours(parisDate(of.created_at), debutCycle) : null,
  };
  const delaiInfo = {
    delai, fin_reelle: finReelle, fin_prevue_initiale: finPrevueInit, derniere_fin_planifiee: dernierPlan && dernierPlan.details.fin ? String(dernierPlan.details.fin).slice(0, 10) : null,
    respecte, ecart_jours_ouvres: ecartDelaiOuvres,
    ecart_jours_calendaires: delai && finRef ? jours(delai, finRef) : null,
    ecart_plan_initial_ouvres: finPrevueInit && finRef ? joursOuvres(finPrevueInit, finRef) : null,
    texte: !delai ? 'Aucun délai de livraison renseigné sur l\'OF.'
      : !finRef ? (provisoire ? 'Production non terminée : le respect du délai ne peut pas encore être jugé.' : 'Date de fin réelle inconnue.')
        : (respecte ? (ecartDelaiOuvres === 0 ? 'Délai respecté : terminé le jour même de l\'échéance.' : `Délai respecté avec ${Math.abs(ecartDelaiOuvres)} jour(s) ouvré(s) d'avance.`)
          : `Délai NON respecté : ${ecartDelaiOuvres} jour(s) ouvré(s) de retard.`),
    changements: changementsDelai.map((j) => ({ date: parisDate(j.date_evt), ancien: j.details.ancien || null, nouveau: j.details.nouveau || null, origine: j.details.origine || j.details.option || null })),
  };

  // ---------- indicateurs ----------
  const etapesChiffrees = etapes.filter((e) => e.std.total_h > 0);
  const stdTotal = etapesChiffrees.reduce((t, e) => t + e.std.total_h, 0);
  const avecSaisie = etapes.filter((e) => e.reel.total_h !== null);
  const reelTotal = avecSaisie.reduce((t, e) => t + e.reel.total_h, 0);
  const stdComparable = avecSaisie.filter((e) => e.std.total_h > 0).reduce((t, e) => t + e.std.total_h, 0);
  const reelComparable = avecSaisie.filter((e) => e.std.total_h > 0).reduce((t, e) => t + e.reel.total_h, 0);
  const ecartGlobalPct = stdComparable > 0 ? ((reelComparable - stdComparable) / stdComparable) * 100 : null;
  const completude = etapes.length ? Math.round((avecSaisie.length / etapes.length) * 100) : 0;
  const quantiteFinale = etapes.length ? (etapes[etapes.length - 1].quantite_realisee || null) : null;
  const taux = num(D.taux_horaire);
  const nbCorrections = saisiesJournal.filter((j) => j.details && (j.details.supprime || /supprim/.test(j.resume || ''))).length;
  const kpi = {
    heures_standard: r1(stdTotal), heures_reelles: r1(reelTotal), heures_standard_comparables: r1(stdComparable), heures_reelles_comparables: r1(reelComparable),
    ecart_global_pct: ecartGlobalPct !== null ? r1(ecartGlobalPct) : null,
    completude_saisie_pct: completude,
    nb_etapes: etapes.length, nb_etapes_terminees: etapes.filter((e) => e.statut === 'terminé').length,
    nb_replanifications: replanifs.length, nb_recalages: recalages.length,
    nb_saisies: saisiesJournal.length || etapes.reduce((t, e) => t + e.reel.nb_saisies, 0), nb_corrections: nbCorrections,
    nb_interventions: 0, nb_absences_jours: 0,
    quantite_commandee: num(of.quantite), quantite_produite_derniere_etape: quantiteFinale,
    cout_standard: taux !== null ? Math.round(stdComparable * taux) : null, cout_reel: taux !== null ? Math.round(reelComparable * taux) : null, taux_horaire: taux,
    nb_titres_partageant: 0,
  };

  // ---------- personnel ----------
  const parPers = new Map();
  (D.etapes || []).forEach((e) => {
    (e.saisies_personne || []).forEach((x) => {
      if (!x.personnel_id) return;
      const p = parPers.get(x.personnel_id) || { id: x.personnel_id, nom: nomP(x.personnel_id), poste: (D.personnel[x.personnel_id] || {}).poste || '', heures: 0, jours: new Set(), etapes: new Set(), planifie_jours: new Set() };
      p.heures += (num(x.heures_reglage) || 0) + (num(x.heures_production) || 0); p.jours.add(String(x.date).slice(0, 10)); p.etapes.add(e.operation); parPers.set(x.personnel_id, p);
    });
    (e.creneaux || []).forEach((c) => (c.personnes || []).forEach((id) => {
      const p = parPers.get(id) || { id, nom: nomP(id), poste: (D.personnel[id] || {}).poste || '', heures: 0, jours: new Set(), etapes: new Set(), planifie_jours: new Set() };
      p.planifie_jours.add(c.date); p.etapes.add(e.operation); parPers.set(id, p);
    }));
  });
  const personnel = Array.from(parPers.values()).map((p) => ({ nom: p.nom, poste: p.poste, heures_saisies: r2(p.heures), jours_saisis: p.jours.size, jours_planifies: p.planifie_jours.size, etapes: Array.from(p.etapes) }))
    .sort((a, b) => b.heures_saisies - a.heures_saisies || a.nom.localeCompare(b.nom, 'fr'));
  const nbPersonnes = personnel.length;

  // ---------- fenêtre de la production ----------
  const fenDebut = [premiereProd, ...etapes.map((e) => e.fin_prevue_actuelle ? null : null)].filter(Boolean).sort()[0] || (D.etapes || []).flatMap((e) => (e.creneaux || []).map((c) => c.date)).sort()[0] || null;
  const fenFin = finCycle || aujourdhui;

  // ---------- machines et interventions ----------
  const dansFenetre = (d1, d2) => fenDebut && fenFin && String(d1).slice(0, 10) <= fenFin && String(d2 || d1).slice(0, 10) >= fenDebut;
  const interventions = (D.interventions || []).filter((iv) => dansFenetre(iv.date_debut, iv.date_fin || aujourdhui)).map((iv) => ({
    machine: iv.machine, type: iv.type, date_debut: String(iv.date_debut).slice(0, 10), date_fin: iv.date_fin ? String(iv.date_fin).slice(0, 10) : null,
    date_fin_prevue: iv.date_fin_prevue ? String(iv.date_fin_prevue).slice(0, 10) : null, bloquant: iv.bloquant !== false, statut: iv.statut, description: iv.description || '',
    duree_jours_ouvres: iv.date_fin ? joursOuvres(iv.date_debut, iv.date_fin) + 1 : null,
    depassement_jours: iv.date_fin && iv.date_fin_prevue ? Math.max(0, joursOuvres(iv.date_fin_prevue, iv.date_fin)) : 0,
  }));
  kpi.nb_interventions = interventions.length;
  const machinesNoms = Array.from(new Set(etapes.flatMap((e) => e.machines)));
  const machines = machinesNoms.map((nom) => {
    const joursUtil = new Set((D.etapes || []).flatMap((e) => (e.creneaux || []).filter((c) => c.machine === nom).map((c) => c.date)));
    const partage = (D.partages || []).filter((p) => p.machine === nom && joursUtil.has(p.date));
    const autres = Array.from(new Set(partage.flatMap((p) => p.autres_of)));
    return { nom, jours_planifies: joursUtil.size, interventions: interventions.filter((iv) => iv.machine === nom), titres_partageant: autres.length, autres_of: autres };
  });
  kpi.nb_titres_partageant = Array.from(new Set(machines.flatMap((m) => m.autres_of))).length;

  // ---------- absences du personnel affecté ----------
  const idsOf = new Set(Array.from(parPers.keys()));
  const absencesBrutes = (D.absences || []).filter((a) => idsOf.has(a.personnel_id) && fenDebut && a.date >= fenDebut && a.date <= fenFin && estOuvre(a.date));
  const absences = [];
  Array.from(new Set(absencesBrutes.map((a) => a.personnel_id))).forEach((id) => {
    periodes(absencesBrutes.filter((a) => a.personnel_id === id).map((a) => a.date)).forEach((p) => absences.push({ nom: nomP(id), ...p }));
  });
  kpi.nb_absences_jours = absences.reduce((t, a) => t + a.jours, 0);
  // Étapes dont la personne absente était affectée (créneaux ce jour-là)
  const absencesImpact = [];
  absencesBrutes.forEach((a) => {
    (D.etapes || []).forEach((e) => (e.creneaux || []).forEach((c) => { if (c.date === a.date && (c.personnes || []).includes(a.personnel_id)) absencesImpact.push({ nom: nomP(a.personnel_id), date: a.date, operation: e.operation }); }));
  });

  // ---------- changements ----------
  const changements = {
    replanifications: replanifs.map((j) => ({ date: parisDate(j.date_evt), heure: parisHeure(j.date_evt), origine: j.details.origine || 'replanification', fin: j.details.fin ? String(j.details.fin).slice(0, 10) : null, delai_tenu: j.details.respecte_delai ?? null, resume: j.resume })),
    recalages: recalages.map((j) => ({ date: parisDate(j.date_evt), heure: parisHeure(j.date_evt), operations: (j.details.retards || []).map((r) => r.operation), applique: !!j.details.applique, ancienne_fin: j.details.ancienne_fin || null, nouvelle_fin: j.details.nouvelle_fin || null, delai_tenu: j.details.delai_tenu ?? null, resume: j.resume })),
    delais: delaiInfo.changements,
    saisies: saisiesJournal.map((j) => ({ date: parisDate(j.date_evt), heure: parisHeure(j.date_evt), jour: j.details.date || null, operation: j.details.operation || '', resume: j.resume, supprime: !!j.details.supprime })),
    deplanifications: journal.filter((j) => j.type === 'deplanification').map((j) => ({ date: parisDate(j.date_evt), resume: j.resume })),
    affectations: journal.filter((j) => j.type === 'affectation').map((j) => ({ date: parisDate(j.date_evt), resume: j.resume })),
    observations: journal.filter((j) => j.type === 'observation').map((j) => ({ date: parisDate(j.date_evt), heure: parisHeure(j.date_evt), texte: j.resume })),
    journal_disponible: journal.length > 0,
  };
  const remarques = etapes.flatMap((e) => e.commentaires.map((c) => ({ date: c.date, operation: e.operation, texte: c.texte })));

  // ---------- chronologie ----------
  const chrono = [];
  const ajoutC = (date, heure, categorie, titre, detail) => { if (date) chrono.push({ date: String(date).slice(0, 10), heure: heure || '', categorie, titre, detail: detail || '' }); };
  const aCreation = journal.some((j) => j.type === 'creation');
  if (!aCreation && of.created_at) ajoutC(parisDate(of.created_at), parisHeure(of.created_at), 'OF', `OF ${of.numero} créé`, `${of.quantite} ex.`);
  journal.filter((j) => j.type !== 'saisie' && j.type !== 'etape_terminee').forEach((j) => {
    const cat = { creation: 'OF', validation: 'OF', planification: 'Planning', replanification: 'Planning', delai: 'Délai', recalage: 'Retard', termine: 'OF', deplanification: 'Planning', affectation: 'Planning', observation: 'Observation' }[j.type] || 'OF';
    ajoutC(parisDate(j.date_evt), parisHeure(j.date_evt), cat, j.resume, '');
  });
  etapes.forEach((e) => {
    (D.etapes.find((x) => x.gamme_id === e.gamme_id).saisies || []).forEach((l) => {
      const parts = [num(l.quantite) ? `${num(l.quantite)} ex.` : null, num(l.heures_reglage) !== null ? `réglage ${hFr(num(l.heures_reglage))}` : null, num(l.heures_production) !== null ? `production ${hFr(num(l.heures_production))}` : (num(l.heures_reelles) !== null && num(l.heures_reglage) === null ? hFr(num(l.heures_reelles)) : null)].filter(Boolean);
      ajoutC(l.date, '', 'Production', `${e.operation} : ${parts.join(', ') || 'saisie'}`, l.commentaire ? `« ${l.commentaire} »` : '');
    });
    const dejaTermine = journal.some((j) => j.type === 'etape_terminee' && j.details && j.details.gamme_id === e.gamme_id);
    if (e.fin_reelle) {
      const jr = journal.find((j) => j.type === 'etape_terminee' && j.details && j.details.gamme_id === e.gamme_id);
      ajoutC(e.fin_reelle, jr ? parisHeure(jr.date_evt) : '', 'Production', `${e.operation} terminée`, '');
      void dejaTermine;
    }
  });
  interventions.forEach((iv) => ajoutC(iv.date_debut, '', 'Machine', `${iv.machine} : ${iv.type}${iv.bloquant ? '' : ' (marche dégradée)'}`, `${iv.date_fin ? 'jusqu\'au ' + iv.date_fin : 'en cours'}${iv.description ? ' — ' + iv.description : ''}`));
  absences.forEach((a) => ajoutC(a.du, '', 'Personnel', `${a.nom} absent(e)`, a.jours > 1 ? `du ${a.du} au ${a.au} (${a.jours} jours ouvrés)` : ''));
  chrono.sort((a, b) => (a.date + (a.heure || '')).localeCompare(b.date + (b.heure || '')) || a.categorie.localeCompare(b.categorie));

  // ---------- qualité des données ----------
  const sansSaisie = etapes.filter((e) => e.reel.total_h === null);
  if (sansSaisie.length) qualite.push(`Heures réelles non saisies pour ${sansSaisie.length} étape(s) sur ${etapes.length} (${sansSaisie.map((e) => e.operation).join(', ')}) : les écarts de temps ne peuvent pas être calculés pour ces étapes.`);
  const sansDetail = etapes.filter((e) => e.reel.total_h !== null && e.reel.reglage_h === null);
  if (sansDetail.length) qualite.push(`Réglage et production non distingués pour ${sansDetail.length} étape(s) : impossible de savoir si l'écart vient du réglage ou de la cadence.`);
  const sansStd = etapes.filter((e) => !(e.std.total_h > 0));
  if (sansStd.length) qualite.push(`Aucun temps standard pour ${sansStd.length} étape(s) (${sansStd.map((e) => e.operation).join(', ')}) : pas de comparaison possible.`);
  if (!changements.journal_disponible) qualite.push('Aucun événement dans le journal de traçabilité (OF antérieur à la migration 58) : l\'historique des changements (replanifications, délais, corrections) n\'est pas disponible pour cet OF.');
  if (!planInitial) qualite.push('Plan initial non enregistré : les écarts « prévu / réel » se rapportent au dernier planning en vigueur.');
  if (!of.delai) qualite.push('Aucun délai de livraison sur l\'OF.');

  // ---------- retour d'expérience et plan d'amélioration ----------
  const forts = [], faibles = [], actions = [];
  const ajoutA = (a) => actions.push(a);
  const ordreSev = { haute: 0, moyenne: 1, faible: 2 };

  // Délai
  if (respecte === true) forts.push({ titre: 'Délai de livraison respecté', detail: delaiInfo.texte });
  if (respecte === false) {
    const critique = etapes.filter((e) => e.ecart_fin_jours !== null && e.ecart_fin_jours > 0).sort((a, b) => b.ecart_fin_jours - a.ecart_fin_jours)[0];
    const gros = etapes.filter((e) => e.ecart_h !== null && e.ecart_h > 0).sort((a, b) => b.ecart_h - a.ecart_h)[0];
    faibles.push({ titre: 'Délai de livraison non respecté', detail: `${delaiInfo.texte}${critique ? ` L'étape « ${critique.operation} » a fini ${critique.ecart_fin_jours} jour(s) ouvré(s) après sa date prévue (${critique.ref_ecart_fin}).` : ''}${gros ? ` Plus gros dépassement d'heures : « ${gros.operation} » (+${hFr(gros.ecart_h)}).` : ''}` });
    ajoutA({ severite: 'haute', theme: 'Délai', action: `Lancer ce type d'OF plus tôt : prévoir au moins ${Math.max(1, ecartDelaiOuvres)} jour(s) ouvré(s) supplémentaire(s) de marge dans le plan, ou annoncer un délai plus réaliste au client.`, pourquoi: delaiInfo.texte, indicateur: 'Écart en jours ouvrés entre la fin réelle et la date de livraison (cible : ≤ 0)', responsable: 'Chef d\'atelier / Planification', echeance: 'Avant le prochain lancement' });
  }
  if (respecte === true && ecartDelaiOuvres !== null && ecartDelaiOuvres <= -3) {
    forts.push({ titre: 'Marge importante conservée', detail: `Fin ${Math.abs(ecartDelaiOuvres)} jours ouvrés avant l'échéance.` });
    ajoutA({ severite: 'faible', theme: 'Délai', action: `La marge de ${Math.abs(ecartDelaiOuvres)} jours ouvrés permettait de passer d'autres travaux devant ou de proposer un délai plus court au client : revoir la marge de sécurité appliquée au planning pour ce type d'OF.`, pourquoi: 'Capacité d\'atelier immobilisée trop longtemps pour un seul OF.', indicateur: 'Marge moyenne à la livraison (cible : 1 à 2 jours ouvrés)', responsable: 'Chef d\'atelier', echeance: 'Prochaine revue de planning' });
  }

  // Temps par étape
  const depass = etapes.filter((e) => e.verdict === 'depassement').sort((a, b) => b.ecart_h - a.ecart_h);
  const avance = etapes.filter((e) => e.verdict === 'avance');
  const conformes = etapes.filter((e) => e.verdict === 'conforme');
  if (conformes.length) forts.push({ titre: `${conformes.length} étape(s) conforme(s) au temps standard`, detail: conformes.map((e) => `${e.operation} (${e.ecart_pct > 0 ? '+' : ''}${e.ecart_pct} %)`).join(', ') });
  depass.forEach((e) => {
    const regl = e.reel.reglage_h !== null && e.std.reglage_h > 0 ? e.reel.reglage_h - e.std.reglage_h : null;
    const prod = e.reel.production_h !== null && e.std.production_h > 0 ? e.reel.production_h - e.std.production_h : null;
    const cause = regl !== null && prod !== null ? (regl > prod && regl > 0 ? 'réglage / préparation plus long que prévu' : (prod > 0 ? 'production plus lente que la cadence standard' : 'écart réparti')) : 'réglage et production non distingués à la saisie';
    faibles.push({ titre: `« ${e.operation} » : ${hFr(e.reel.total_h)} réalisées pour ${hFr(e.std.total_h)} prévues (+${e.ecart_pct} %)`, detail: `Cause probable : ${cause}.${e.cadence_std && e.cadence_reelle ? ` Cadence réelle ${e.cadence_reelle} /h pour ${e.cadence_std} /h au standard.` : ''}` });
    if (e.ecart_pct >= SEUIL_ACTION_PCT) {
      ajoutA({ severite: e.ecart_pct >= 40 ? 'haute' : 'moyenne', theme: 'Temps standards', action: `Recaler le temps standard de « ${e.operation} » : ${hFr(e.std.total_h)} → ${hFr(e.reel.total_h)} pour ${e.quantite_etape || of.quantite} ex. (ou expliquer et supprimer la cause de l'écart avant de modifier le standard).`, pourquoi: `Écart de +${e.ecart_pct} % (${hFr(e.ecart_h)}) sur cette étape. ${cause}.`, indicateur: 'Écart réel / standard de l\'étape (cible : ±10 %)', responsable: 'Méthodes / Chef d\'atelier', echeance: 'Avant le prochain OF similaire' });
    }
    if (regl !== null && prod !== null && regl > 0 && regl > prod) {
      ajoutA({ severite: 'moyenne', theme: 'Réglages', action: `Réduire le temps de réglage de « ${e.operation} » : regrouper les titres de caractéristiques proches (largeur de carte de dos, coloris de têtes), préparer l'outillage et les consommables la veille, et consigner la fiche de réglage du titre.`, pourquoi: `Réglage réel ${hFr(e.reel.reglage_h)} pour ${hFr(e.std.reglage_h)} prévues.`, indicateur: 'Heures de réglage par titre', responsable: 'Conducteur de machine / Chef d\'atelier', echeance: 'Prochaine fabrication' });
    } else if (prod !== null && prod > 0) {
      ajoutA({ severite: 'moyenne', theme: 'Cadence', action: `Analyser la cadence de « ${e.operation} » (${e.cadence_reelle || '?'} /h au lieu de ${e.cadence_std || '?'} /h) : état de la machine, qualité des matières reçues, effectif et expérience de l'équipe ; vérifier aussi que la quantité traitée à l'heure est bien celle qui est saisie.`, pourquoi: `Production réelle ${hFr(e.reel.production_h)} pour ${hFr(e.std.production_h)} prévues.`, indicateur: 'Cadence réelle / cadence standard (cible : ≥ 90 %)', responsable: 'Conducteur de machine / Maintenance', echeance: 'Prochaine fabrication' });
    }
  });
  avance.forEach((e) => {
    forts.push({ titre: `« ${e.operation} » plus rapide que prévu (${e.ecart_pct} %)`, detail: `${hFr(e.reel.total_h)} réalisées pour ${hFr(e.std.total_h)} au standard.` });
    ajoutA({ severite: 'faible', theme: 'Temps standards', action: `Le temps standard de « ${e.operation} » semble trop large : ${hFr(e.std.total_h)} → ${hFr(e.reel.total_h)} observées. Confirmer sur une 2e production avant de l'abaisser (un standard trop large gonfle les délais annoncés et les devis).`, pourquoi: `Écart de ${e.ecart_pct} %.`, indicateur: 'Écart réel / standard de l\'étape', responsable: 'Méthodes', echeance: 'Après la prochaine production similaire' });
  });
  if (ecartGlobalPct !== null) {
    if (ecartGlobalPct <= SEUIL_DEPASSEMENT_PCT) forts.push({ titre: 'Heures globales maîtrisées', detail: `${hFr(reelComparable)} réalisées pour ${hFr(stdComparable)} prévues (${ecartGlobalPct > 0 ? '+' : ''}${r1(ecartGlobalPct)} %).` });
    else faibles.push({ titre: 'Heures globales au-dessus du standard', detail: `${hFr(reelComparable)} réalisées pour ${hFr(stdComparable)} prévues (+${r1(ecartGlobalPct)} %)${taux !== null ? ` — environ ${Math.round((reelComparable - stdComparable) * taux)} € de main d'œuvre en plus à ${taux} €/h` : ''}.` });
  }

  // Attentes entre étapes
  const attentes = etapes.filter((e) => e.attente_jours !== null && e.attente_jours > Math.max(2, Math.ceil((e.std.delai_attente_h || 0) / 24) + 1));
  attentes.forEach((e) => faibles.push({ titre: `Attente de ${e.attente_jours} jour(s) ouvré(s) avant « ${e.operation} »`, detail: 'Délai entre la fin de l\'étape précédente et le début réel, au-delà du séchage ou de l\'attente imposés.' }));
  if (attentes.length) {
    ajoutA({ severite: attentes.reduce((t, e) => t + e.attente_jours, 0) >= 5 ? 'haute' : 'moyenne', theme: 'Flux', action: `Réduire les files d'attente entre étapes (${attentes.map((e) => `avant « ${e.operation} » : ${e.attente_jours} j`).join(' ; ')}) : réserver la machine suivante dès le lancement et enchaîner les étapes sans temps mort, hors séchage imposé.`, pourquoi: 'Le temps d\'attente allonge le cycle sans ajouter de travail.', indicateur: 'Jours ouvrés d\'attente entre étapes (cible : séchage imposé uniquement)', responsable: 'Chef d\'atelier / Planification', echeance: 'Prochain lancement' });
  } else if (etapes.some((e) => e.attente_jours !== null)) forts.push({ titre: 'Enchaînement des étapes fluide', detail: 'Pas d\'attente anormale entre les étapes.' });

  // Replanifications et recalages
  if (replanifs.length === 0 && changements.journal_disponible && (planInitial || of.statut === 'terminé')) forts.push({ titre: 'Planning stable', detail: 'Aucune replanification après le plan initial.' });
  if (replanifs.length >= 3 || recalages.length >= 2) {
    const origines = Array.from(new Set(replanifs.map((j) => j.details.origine || 'replanification')));
    faibles.push({ titre: `${replanifs.length} replanification(s) dont ${recalages.length} recalage(s) après retard`, detail: `Causes enregistrées : ${origines.join(' ; ') || 'non précisées'}.` });
    ajoutA({ severite: replanifs.length >= 5 ? 'haute' : 'moyenne', theme: 'Stabilité du planning', action: 'Fiabiliser les données avant lancement (temps standards à jour, date de réception du papier et des matières confirmée, disponibilités machines/personnel vérifiées) et figer le planning des 2 jours à venir, sauf urgence validée par le chef d\'atelier.', pourquoi: `${replanifs.length} replanifications : chaque changement désorganise les postes et les OF voisins.`, indicateur: 'Nombre de replanifications par OF (cible : ≤ 2)', responsable: 'Chef d\'atelier', echeance: 'Prochain lancement' });
  }
  const sansDelaiTenu = recalages.filter((j) => j.details.delai_tenu === false);
  if (sansDelaiTenu.length) faibles.push({ titre: 'Retards en cours de production', detail: `${recalages.length} retard(s) constaté(s) en saisie de production ; le délai n'était plus tenu après ${sansDelaiTenu.length} recalage(s).` });

  // Machines
  const ivBloq = interventions.filter((iv) => iv.bloquant);
  if (!interventions.length && machinesNoms.length) forts.push({ titre: 'Aucune intervention machine pendant la production', detail: machinesNoms.join(', ') });
  if (ivBloq.length) {
    faibles.push({ titre: `${ivBloq.length} intervention(s) bloquante(s) sur les machines utilisées`, detail: ivBloq.map((iv) => `${iv.machine} : ${iv.type} du ${iv.date_debut}${iv.date_fin ? ' au ' + iv.date_fin : ' (en cours)'}${iv.depassement_jours ? `, dépassement de ${iv.depassement_jours} j sur la fin annoncée` : ''}`).join(' ; ') });
    ajoutA({ severite: ivBloq.some((iv) => iv.depassement_jours > 0) ? 'haute' : 'moyenne', theme: 'Maintenance', action: `Vérifier l'état préventif des machines concernées (${Array.from(new Set(ivBloq.map((iv) => iv.machine))).join(', ')}) avant le prochain OF similaire, et prévoir une machine de repli ou un créneau tampon pour ces opérations.`, pourquoi: 'Une panne en cours de production décale toute la gamme.', indicateur: 'Jours d\'arrêt machine pendant la production (cible : 0)', responsable: 'Maintenance / Chef d\'atelier', echeance: 'Avant le prochain lancement' });
  }

  // Personnel
  if (absences.length) {
    faibles.push({ titre: `Absence(s) parmi le personnel affecté : ${kpi.nb_absences_jours} jour(s) ouvré(s)`, detail: absences.map((a) => `${a.nom} (${a.jours} j)`).join(', ') + (absencesImpact.length ? `. Créneaux concernés : ${absencesImpact.map((x) => `${x.operation} le ${x.date}`).slice(0, 6).join(', ')}.` : '.') });
    const monoOp = etapes.filter((e) => e.personnes.length === 1);
    ajoutA({ severite: absencesImpact.length ? 'moyenne' : 'faible', theme: 'Personnel', action: `Prévoir un remplaçant habilité pour les postes clés${monoOp.length ? ` (étapes réalisées par une seule personne : ${monoOp.slice(0, 4).map((e) => e.operation).join(', ')})` : ''} : mettre à jour les habilitations machine et former un second opérateur.`, pourquoi: 'Une absence sur un poste mono-opérateur bloque l\'étape ou la fait glisser.', indicateur: 'Étapes avec au moins 2 personnes habilitées (cible : 100 % des étapes critiques)', responsable: 'Chef d\'atelier / RH', echeance: 'Dans le mois' });
  } else if (nbPersonnes > 0) forts.push({ titre: 'Aucune absence du personnel affecté', detail: `${nbPersonnes} personne(s) sur la production.` });

  // Données de saisie
  if (completude < 80 && etapes.length) {
    faibles.push({ titre: 'Saisie des heures incomplète', detail: `${completude} % des étapes ont des heures réelles saisies.` });
    ajoutA({ severite: completude < 50 ? 'haute' : 'moyenne', theme: 'Traçabilité', action: 'Saisir chaque jour, pour chaque étape, la quantité, les heures de réglage et de production par personne (fiche de production remplie en fin de service, recopiée le jour même).', pourquoi: `Seulement ${completude} % des étapes ont des heures : l'analyse et le recalage des temps standards perdent leur fiabilité.`, indicateur: 'Part des étapes avec heures saisies (cible : 100 %)', responsable: 'Chef d\'atelier / Conducteurs', echeance: 'Immédiat' });
  } else if (etapes.length) forts.push({ titre: 'Traçabilité des heures complète', detail: `${completude} % des étapes avec heures saisies.` });
  if (nbCorrections >= 3) { faibles.push({ titre: `${nbCorrections} saisie(s) supprimée(s) ou corrigée(s)`, detail: 'Beaucoup de corrections : consignes de saisie à clarifier.' }); }

  // Quantité
  if (num(of.quantite) && quantiteFinale !== null && !provisoire) {
    const ec = quantiteFinale - of.quantite;
    if (Math.abs(ec) / of.quantite > 0.02) {
      faibles.push({ titre: `Quantité finale ${ec < 0 ? 'inférieure' : 'supérieure'} à la commande (${ec > 0 ? '+' : ''}${ec} ex.)`, detail: `${quantiteFinale} ex. saisis en dernière étape pour ${of.quantite} commandés.` });
      ajoutA({ severite: ec < 0 ? 'haute' : 'faible', theme: 'Quantités', action: ec < 0 ? 'Analyser les pertes (casse, rebuts, écarts de comptage) et prévoir un surplus de matières adapté pour ce type d\'OF.' : 'Vérifier le comptage et l\'excédent de matières lancé pour ce type d\'OF.', pourquoi: `${ec} ex. d'écart.`, indicateur: 'Taux de pertes (cible : < 2 %)', responsable: 'Chef d\'atelier / Qualité', echeance: 'Prochaine fabrication' });
    }
  }
  // Partage des machines
  if (kpi.nb_titres_partageant > 0) forts.push({ titre: 'Machines mutualisées avec d\'autres titres', detail: `${kpi.nb_titres_partageant} autre(s) OF sur les mêmes machines les mêmes jours (une seule mise en route et un seul nettoyage par journée).` });

  // Complétude : action de base
  if (!actions.length) ajoutA({ severite: 'faible', theme: 'Standardisation', action: 'Conserver la méthode : reprendre le même enchaînement de machines, la même équipe et les mêmes temps pour la prochaine fabrication identique.', pourquoi: 'Aucun écart significatif détecté sur les données saisies.', indicateur: 'Écart réel / standard global (cible : ±10 %)', responsable: 'Chef d\'atelier', echeance: 'Prochaine fabrication' });
  actions.sort((a, b) => ordreSev[a.severite] - ordreSev[b.severite]);
  actions.forEach((a, i) => { a.numero = i + 1; });

  // ---------- paramètres recommandés pour la prochaine production identique ----------
  const propositions = etapes.filter((e) => e.statut === 'terminé' && e.reel.total_h !== null && e.std.total_h > 0).map((e) => {
    const ecart = e.ecart_pct;
    const modifier = Math.abs(ecart) >= SEUIL_ACTION_PCT;
    return { operation: e.operation, quantite: e.quantite_etape, standard_h: r2(e.std.total_h), observe_h: e.reel.total_h, propose_h: modifier ? r2(e.reel.total_h) : r2(e.std.total_h), ecart_pct: e.ecart_pct, decision: modifier ? (ecart > 0 ? 'Augmenter le temps standard' : 'Abaisser le temps standard (à confirmer)') : 'Conserver' };
  });
  const cycleOuvres = cycle.jours_ouvres;
  const marge = cycleOuvres ? Math.max(1, Math.ceil(cycleOuvres * 0.1)) : null;
  const lancement = cycleOuvres ? { cycle_observe_jours_ouvres: cycleOuvres, marge_jours_ouvres: marge, lancer_au_plus_tard_jours_ouvres: cycleOuvres + marge + (cycle.avant_lancement_jours && ecartDelaiOuvres > 0 ? 0 : 0) } : null;
  const conditions = [];
  if (machinesNoms.length) conditions.push(`Machines utilisées : ${machinesNoms.join(', ')} — réserver ces machines dès le lancement.`);
  if (personnel.length) conditions.push(`Équipe : ${personnel.slice(0, 6).map((p) => p.nom).join(', ')}${personnel.length > 6 ? '…' : ''} — vérifier leur disponibilité et prévoir un remplaçant par poste clé.`);
  if (attentes.length) conditions.push('Enchaîner les étapes sans attente (hors séchage imposé) pour réduire le cycle.');
  conditions.push('Confirmer avant lancement : matières reçues, fiche de fabrication à jour, date de livraison validée.');

  const identite = {
    numero: of.numero, titre: of.titre || '', client: of.client || '', type_production: of.type_production || '', quantite: of.quantite, priorite: of.priorite || 'normale', statut: of.statut,
    delai, cree_le: of.created_at ? parisDate(of.created_at) : null, date_reception: of.date_reception || null, sans_lot_minimum: !!of.sans_lot_minimum,
    caracteristiques: of.caracteristiques || {},
  };

  return {
    provisoire, genere_le: aujourdhui, identite, delai: delaiInfo, cycle, kpi,
    etapes: etapes.map(({ predecesseurs, ...x }) => x), personnel, machines, interventions, absences, absences_impact: absencesImpact,
    chronologie: chrono, changements, remarques,
    rex: { points_forts: forts, points_faibles: faibles },
    plan: { actions, parametres: { etapes: propositions, lancement }, conditions },
    qualite_donnees: qualite,
  };
}

module.exports = { analyser, joursOuvres, periodes, parisDate, parisHeure, hFr, minutesCreneau };
