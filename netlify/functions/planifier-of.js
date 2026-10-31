// functions/planifier-of.js
//
// POST /.netlify/functions/planifier-of
// body : {
//   of_id,
//   mode: 'avant' | 'arriere',          // avant : démarrer au plus tôt à debut_souhaite
//                                       // arriere : finir au plus tard à fin_au_plus_tard
//   debut_souhaite?: 'AAAA-MM-JJTHH:MM',
//   fin_au_plus_tard?: 'AAAA-MM-JJ' | 'AAAA-MM-JJTHH:MM',   // défaut : délai de l'OF
//   maintenant?: 'AAAA-MM-JJTHH:MM',    // heure locale de l'atelier (ne pas démarrer avant)
//   horaires?: 'normal' | 'heures_sup',
//   replanifier?: boolean,              // reprendre aussi les étapes déjà planifiées (pas "en cours")
//   etapes_imposees?: [ { gamme_id, machine_id?, personnel_ids? } ],
//   appliquer?: boolean                 // false = simple PROPOSITION ; true = écrit le planning
//   --- recalage après retard de production (utilisé par saisir-production) ---
//   etapes_a_replanifier?: [gamme_id]   // étapes à reprendre, quel que soit leur statut (sauf terminé)
//   restant?: { gamme_id: 0..1 }        // part de travail restant à faire sur une étape déjà entamée
//   depuis?: 'AAAA-MM-JJTHH:MM'         // les créneaux de ces étapes antérieurs à cet instant sont conservés (historique)
// }
//
// Calcule, phase par phase, QUAND se déroule chaque étape de l'OF, en tenant
// compte : des horaires de l'atelier (pauses, week-ends), des durées
// chiffrées (temps standards), des machines (occupation, maintenance), du
// personnel (compétences, absences, plages de disponibilité, autres tâches).
// Le calcul lui-même est dans lib/planification.js.
//
// Rien n'est écrit tant que appliquer != true. L'application refuse un plan
// qui comporte un point bloquant (étape non chiffrée, aucune machine
// compatible, paramètres de chiffrage manquants...).

const { getSupabase } = require('./lib/supabaseclient');
const { calculerEtapes } = require('./lib/durees');
const PL = require('./lib/planification');
const { typePhase } = require('./lib/en-ligne');
const { purgerObsoletes } = require('./lib/obsoletes');

const { enMinutes, dateDe, heureDe, debutDeJour, hhmm, MIN_JOUR, HORIZON_JOURS, libelleFerie } = PL;

const CALENDRIERS_DEFAUT = {
  normal:     { code: 'normal',     debut: '08:00', fin: '16:30', pause_debut: '12:00', pause_minutes: 30 },
  heures_sup: { code: 'heures_sup', debut: '07:00', fin: '17:30', pause_debut: '12:00', pause_minutes: 30 },
};
// Samedi exceptionnel : 06:00-12:00, sans pause. Il s'ajoute à l'un des deux calendriers ('normal' ou 'heures_sup').
const SAMEDI = { samedi_debut: '06:00', samedi_fin: '12:00' };

// 'AAAA-MM-JJTHH:MM' -> minutes ; 'AAAA-MM-JJ' -> minutes à `heureParDefaut`.
function lireDateHeure(s, heureParDefaut) {
  if (!s) return null;
  const [d, h] = String(s).split('T');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return enMinutes(d, h ? h.slice(0, 5) : heureParDefaut);
}
const iso = (min) => `${dateDe(min)}T${heureDe(min)}`;

function intervalleJournee(dateStr, hd, hf) {
  const j = enMinutes(dateStr, '00:00');
  return { d: j + (hd ? hhmm(hd) : 0), f: hd || hf ? j + (hf ? hhmm(hf) : MIN_JOUR) : j + MIN_JOUR };
}

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    }
    const body = JSON.parse(event.body || '{}');
    const { of_id, mode = 'avant', replanifier = false, appliquer = false } = body;
    const etapesImposees = Array.isArray(body.etapes_imposees) ? body.etapes_imposees : [];
    if (!of_id) return { statusCode: 400, body: JSON.stringify({ error: 'of_id requis.' }) };
    if (!['avant', 'arriere'].includes(mode)) return { statusCode: 400, body: JSON.stringify({ error: 'mode invalide (avant | arriere).' }) };
    // horaires : 'normal' | 'heures_sup', avec le suffixe '_samedi' pour ouvrir aussi le samedi (6h-12h, exceptionnel).
    const horairesCode = ['normal', 'normal_samedi', 'heures_sup', 'heures_sup_samedi'].includes(body.horaires) ? body.horaires : 'normal';

    const supabase = getSupabase();
    await purgerObsoletes(supabase);   // ne pas bloquer personnes et machines avec des créneaux d'étapes terminées

    // ---------- 1. OF, étapes chiffrées, calendrier ----------
    const calcul = await calculerEtapes(supabase, of_id);
    if (!calcul) return { statusCode: 404, body: JSON.stringify({ error: 'OF introuvable.' }) };
    const { of, etapes: etapesCalc, calendrier: calTable } = calcul;

    const calendrierDe = (codeComplet) => {
      const samedi = /_samedi$/.test(codeComplet), code = codeComplet.replace(/_samedi$/, '');
      const ligne = calTable.find((c) => c.code === code);
      const base = ligne
        ? { code, debut: ligne.heure_debut, fin: ligne.heure_fin, pause_debut: ligne.pause_debut, pause_minutes: ligne.pause_minutes }
        : CALENDRIERS_DEFAUT[code];
      return samedi ? { ...base, code: codeComplet, ...SAMEDI } : base;
    };
    const cal = calendrierDe(horairesCode);

    const maintenantStr = body.maintenant || new Date().toISOString().slice(0, 16);
    const maintenantMin = lireDateHeure(maintenantStr, '00:00');
    const debutMin = lireDateHeure(body.debut_souhaite, cal.debut) ?? maintenantMin;
    const delaiMin = lireDateHeure(body.fin_au_plus_tard, cal.fin) ?? lireDateHeure(of.delai, cal.fin);
    if (mode === 'arriere' && delaiMin === null) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Planification vers l\'arrière : indiquez une date de fin au plus tard (ou un délai sur l\'OF).' }) };
    }

    // ---------- 2. Quelles étapes planifier, lesquelles sont figées ----------
    const gammeIds = etapesCalc.map((e) => e.gamme_id);
    const { data: lignesOf, error: lignesOfError } = gammeIds.length
      ? await supabase.from('planning_jour').select('id, gamme_operatoire_id, date, heure_debut, heure_fin, statut, personnel_id, planning_jour_personnel(personnel_id)').in('gamme_operatoire_id', gammeIds).neq('statut', 'annulé')
      : { data: [], error: null };
    if (lignesOfError) throw lignesOfError;
    // Avancement des étapes (pour répartir le TEMPS RESTANT d'une tâche déjà entamée entre les personnes).
    const { data: avRows } = gammeIds.length
      ? await supabase.from('gammes_operatoires').select('id, avancement_pct').in('id', gammeIds)
      : { data: [] };
    const avancementDe = Object.fromEntries((avRows || []).map((r) => [r.id, Number(r.avancement_pct || 0)]));

    const idsReplan = new Set(Array.isArray(body.etapes_a_replanifier) ? body.etapes_a_replanifier : []);
    const restant = body.restant && typeof body.restant === 'object' ? body.restant : {};
    const depuisMin = lireDateHeure(body.depuis, '00:00');
    // Tâche déjà entamée à laquelle on impose du personnel : le temps RESTANT est replanifié et réparti entre
    // les personnes (celles déjà là comprises). Le passé est conservé.
    const renforts = new Set(etapesCalc
      .filter((e) => e.statut === 'en cours' && etapesImposees.some((x) => x.gamme_id === e.gamme_id && Array.isArray(x.personnel_ids) && x.personnel_ids.length))
      .map((e) => e.gamme_id));
    const aPlanifier = new Set(etapesCalc
      .filter((e) => e.statut === 'à planifier' || (replanifier && e.statut === 'planifié') || (idsReplan.has(e.gamme_id) && e.statut !== 'terminé') || renforts.has(e.gamme_id))
      .map((e) => e.gamme_id));
    // Avec « depuis », on garde les créneaux déjà passés (historique de ce qui s'est réellement déroulé).
    const aTronquer = [];   // créneau d'une tâche entamée en cours de journée : on garde ce qui est passé
    const lignesARemplacer = lignesOf.filter((l) => aPlanifier.has(l.gamme_operatoire_id)
      && (() => {
        const renfort = renforts.has(l.gamme_operatoire_id);
        const coupure = renfort ? Math.max(maintenantMin, depuisMin ?? -Infinity) : depuisMin;
        const fin = enMinutes(l.date, '00:00') + (l.heure_fin ? hhmm(String(l.heure_fin).slice(0, 5)) : MIN_JOUR);
        if (coupure === null || fin <= coupure) return false;
        const debut = enMinutes(l.date, '00:00') + (l.heure_debut ? hhmm(String(l.heure_debut).slice(0, 5)) : 0);
        if (renfort && debut < coupure) { aTronquer.push({ id: l.id, heure_fin: heureDe(coupure) }); return false; }
        return true;
      })());
    const idsARemplacer = new Set(lignesARemplacer.map((l) => l.id));

    // ---------- 3. Occupation des machines et du personnel ----------
    const dateDepart = dateDe(Math.min(debutMin, maintenantMin));
    const dateFinHorizon = dateDe(debutDeJour(Math.max(debutMin, maintenantMin)) + HORIZON_JOURS * MIN_JOUR);

    const [planRes, absRes, maintRes, persRes, compRes, persMachRes] = await Promise.all([
      supabase.from('planning_jour')
        .select('id, date, heure_debut, heure_fin, machine_id, personnel_id, statut, planning_jour_personnel(personnel_id)')
        .gte('date', dateDepart).neq('statut', 'annulé'),
      supabase.from('personnel_planning_jour')
        .select('personnel_id, date, statut, heure_debut, heure_fin')
        .gte('date', dateDepart).lte('date', dateFinHorizon),
      supabase.from('maintenance_machine').select('*').neq('statut', 'terminé'),
      supabase.from('personnel').select('id, nom').eq('actif', true),
      supabase.from('personnel_competences').select('personnel_id, operation_id'),
      supabase.from('personnel_machines').select('personnel_id, machine_id'),
    ]);
    for (const r of [planRes, absRes, maintRes, persRes, compRes, persMachRes]) if (r.error) throw r.error;

    const occupation = { machines: {}, personnes: {} };
    const ajouter = (cat, id, iv) => { (occupation[cat][id] ??= []).push(iv); };

    planRes.data.filter((l) => !idsARemplacer.has(l.id)).forEach((l) => {
      const tronque = aTronquer.find((t) => t.id === l.id);
      const iv = intervalleJournee(l.date, l.heure_debut && String(l.heure_debut).slice(0, 5), tronque ? tronque.heure_fin : (l.heure_fin && String(l.heure_fin).slice(0, 5)));
      if (l.machine_id) ajouter('machines', l.machine_id, iv);
      const personnes = new Set((l.planning_jour_personnel || []).map((x) => x.personnel_id));
      if (l.personnel_id) personnes.add(l.personnel_id);
      personnes.forEach((p) => ajouter('personnes', p, iv));
    });
    maintRes.data.filter((m) => m.bloquant !== false).forEach((m) => {   // marche dégradée (bloquant = false) : la machine reste utilisable
      const hm = (t) => (t ? String(t).slice(0, 5) : null);
      const d = enMinutes(m.date_debut, hm(m.heure_debut) || '00:00');
      const f = m.date_fin ? enMinutes(m.date_fin, hm(m.heure_fin) || '00:00') + (hm(m.heure_fin) ? 0 : MIN_JOUR) : d + HORIZON_JOURS * MIN_JOUR;
      ajouter('machines', m.machine_id, { d, f });
    });
    absRes.data.forEach((a) => {
      const j = enMinutes(a.date, '00:00');
      if (a.statut === 'absent' || a.statut === 'en arrêt') {
        ajouter('personnes', a.personnel_id, { d: j, f: j + MIN_JOUR });
      } else if (a.heure_debut && a.heure_fin) {
        // "disponible de x à y" : indisponible en dehors de cette plage
        ajouter('personnes', a.personnel_id, { d: j, f: j + hhmm(String(a.heure_debut).slice(0, 5)) });
        ajouter('personnes', a.personnel_id, { d: j + hhmm(String(a.heure_fin).slice(0, 5)), f: j + MIN_JOUR });
      }
    });

    const personnelActif = new Set(persRes.data.map((p) => p.id));
    const nomPersonne = Object.fromEntries(persRes.data.map((p) => [p.id, p.nom]));
    const parOperation = (opId) => compRes.data.filter((c) => c.operation_id === opId && personnelActif.has(c.personnel_id)).map((c) => c.personnel_id);
    const parMachine = (mId) => persMachRes.data.filter((c) => c.machine_id === mId && personnelActif.has(c.personnel_id)).map((c) => c.personnel_id);

    // ---------- 4. Construction de l'entrée du moteur ----------
    // Dépendances : numéros d'étapes (colonne predecesseurs) -> positions dans la liste.
    // null = comportement par défaut (étape précédente), conservé tel quel.
    const positionDe = new Map(etapesCalc.map((e, i) => [e.sequence, i]));
    // Options de lien (démarrage progressif), indexées par position du prédécesseur.
    const enLigneDe = (e) => new Set((e.en_ligne || []).map((x) => x.sequence));
    const liensDe = (e) => {
      const out = {};
      enLigneDe(e).forEach((seq) => { const i = positionDe.get(Number(seq)); if (i !== undefined) out[i] = { en_ligne: true }; });
      Object.entries(e.dependances || {}).forEach(([seq, v]) => {
        const i = positionDe.get(Number(seq));
        if (i !== undefined && enLigneDe(e).has(Number(seq))) {
          out[i] = { en_ligne: true };
        } else if (i !== undefined && v && v.mode === 'progressif') {
          const pct = Number(v.seuil_pct);
          out[i] = { mode: 'progressif', seuil_pct: Number.isFinite(pct) ? pct : 10 };
        }
      });
      return out;
    };
    const indicesDe = (e) => (Array.isArray(e.predecesseurs)
      ? e.predecesseurs.map((s) => positionDe.get(s)).filter((i) => i !== undefined)
      : null);
    const etapesMoteur = etapesCalc.map((e, index) => {
      if (!aPlanifier.has(e.gamme_id)) {
        const fins = lignesOf.filter((l) => l.gamme_operatoire_id === e.gamme_id)
          .map((l) => enMinutes(l.date, '00:00') + (l.heure_fin ? hhmm(String(l.heure_fin).slice(0, 5)) : hhmm(cal.fin)));
        return { index, fixe: true, fin_min: fins.length ? Math.max(...fins) : null, predecesseurs: indicesDe(e) };
      }
      const imp = etapesImposees.find((x) => x.gamme_id === e.gamme_id) || {};
      const besoinMachinePhases = e.phases.some((p) => p.occupe_machine);
      const nbMax = Math.max(1, ...e.phases.map((p) => p.nb_personnes));
      let phases;
      if (e.duree_manuelle_h !== null) {
        phases = [{ nom: 'Étape (durée manuelle)', type_phase: 'production', duree_min: Math.round(e.duree_manuelle_h * 60), besoin_machine: e.phases.length === 0 ? e.machines_compatibles.length > 0 : besoinMachinePhases, nb_personnes: nbMax }];
      } else {
        phases = e.phases.map((p) => ({ nom: p.nom, type_phase: typePhase(p.nom), duree_min: Math.round(p.duree_h * 60), besoin_machine: !!p.occupe_machine, nb_personnes: p.nb_personnes, type_calcul: p.type_calcul }));
      }
      // Étape déjà entamée : seule la part restante est replanifiée. La mise en route et le réglage sont
      // déjà faits ; le nettoyage reste dû ; le reste (cadence, par élément, formule) est proratisé.
      const rest = restant[e.gamme_id] !== undefined ? restant[e.gamme_id] : (renforts.has(e.gamme_id) ? Math.max(0, 1 - avancementDe[e.gamme_id] / 100) : undefined);
      if (rest !== undefined && Number(rest) < 1) {
        const r = Math.max(0, Number(rest));
        const reste = phases
          .filter((p) => !(p.type_calcul === 'fixe' && /mise en route|r[ée]glage|\bMER\b/i.test(p.nom)))
          .map((p) => (p.type_calcul === 'fixe' && /nettoy/i.test(p.nom)) ? p : { ...p, duree_min: Math.max(1, Math.round(p.duree_min * r)) });
        phases = reste.length ? reste : [{ ...phases[phases.length - 1], duree_min: 1 }];
      }
      // Travail sans machine (mains, étuis, caisses, jaquettes…) : durée répartissable entre les personnes affectées.
      const manuel = !phases.some((p) => p.besoin_machine);
      phases = phases.map((p) => ({ ...p, repartissable: manuel }));
      return {
        index,
        predecesseurs: indicesDe(e),
        liens: liensDe(e),
        non_chiffre: !e.chiffre,
        parametres_manquants: e.parametres_manquants,
        bloquants_chiffrage: (e.erreurs_formule || []).map((x) => ({ type: 'formule_erreur', detail: `${x.phase} : ${x.message}` })),
        phases,
        machine_imposee: imp.machine_id || e.machine_id || null,
        machines_candidates: e.machines_compatibles.map((m) => m.id),
        personnes_imposees: Array.isArray(imp.personnel_ids) && imp.personnel_ids.length ? imp.personnel_ids : null,
        // Présence limitée : { id: heures } -> minutes ; les autres restent toute la tâche, un remplaçant prend le relais.
        heures_max: Object.fromEntries(Object.entries(imp.personnel_heures || {})
          .map(([id, h]) => [id, Math.round(Number(String(h).replace(',', '.')) * 60)])
          .filter(([, m]) => Number.isFinite(m) && m > 0)),
        personnes_pour: (machineId) => Array.from(new Set([...parOperation(e.operation_id), ...(machineId ? parMachine(machineId) : [])])),
      };
    });

    const lancer = (calendrier) => {
      const entree = { calendrier, occupation, etapes: etapesMoteur };
      return mode === 'avant' ? PL.planifierAvant(entree, debutMin) : PL.planifierArriere(entree, delaiMin, maintenantMin);
    };
    const plan = lancer(cal);

    // ---------- 5. Mise en forme de la réponse ----------
    const nomMachine = {};
    etapesCalc.forEach((e) => e.machines_compatibles.forEach((m) => { nomMachine[m.id] = m.nom; }));
    const { data: toutesMachines } = await supabase.from('machines').select('id, nom');
    (toutesMachines || []).forEach((m) => { nomMachine[m.id] = m.nom; });

    // Réseau PERT : durées et dépendances seulement (sans ressources ni calendrier).
    const reseau = PL.analyserReseau(etapesMoteur.map((em, i) => ({
      index: i,
      duree_min: em.fixe ? 0 : em.phases.reduce((total, p) => total + (p.repartissable && em.personnes_imposees
        ? PL.dureeAvecEffectif(p.duree_min, p.nb_personnes, em.personnes_imposees.length) : p.duree_min), 0),
      reglage_min: em.fixe ? 0 : em.phases.filter((p) => p.type_phase === 'reglage').reduce((t, p) => t + p.duree_min, 0),
      predecesseurs: em.predecesseurs ?? null,
      liens: em.liens || {},
    })));
    const pert = {
      duree_totale_min: reseau.duree_totale_min,
      etapes: reseau.noeuds.map((n) => {
        const e = etapesCalc[n.index];
        return {
          gamme_id: e.gamme_id, sequence: e.sequence, operation: e.operation, fixe: !!etapesMoteur[n.index].fixe,
          duree_min: n.duree_min, predecesseurs: n.predecesseurs.map((i) => etapesCalc[i].sequence),
          dependances: n.predecesseurs.map((i) => {
            const lien = (etapesMoteur[n.index].liens || {})[i];
            return { sequence: etapesCalc[i].sequence, mode: lien ? (lien.en_ligne ? 'en_ligne' : 'progressif') : 'fin', seuil_pct: lien && !lien.en_ligne ? lien.seuil_pct : null };
          }),
          es: n.es, ef: n.ef, ls: n.ls, lf: n.lf, marge_min: n.marge_min, critique: n.critique,
        };
      }),
    };

    const bloquants = [];
    const etapesSortie = plan.etapes.map((r) => {
      const e = etapesCalc[r.index];
      r.problemes.forEach((p) => { if (p.bloquant) bloquants.push({ sequence: e.sequence, operation: e.operation, type: p.type, detail: p.detail }); });
      return {
        gamme_id: e.gamme_id, sequence: e.sequence, operation: e.operation, statut: e.statut,
        predecesseurs: pert.etapes[r.index].predecesseurs,
        dependances: pert.etapes[r.index].dependances,
        fixe: !!r.fixe,
        travail_manuel: !e.phases.some((p) => p.occupe_machine) && (e.duree_manuelle_h === null ? e.phases.length > 0 : e.machines_compatibles.length === 0),
        avancement_pct: avancementDe[e.gamme_id] || 0,
        renfort: renforts.has(e.gamme_id),
        personnes_actuelles: r.fixe ? Array.from(new Set(lignesOf.filter((l) => l.gamme_operatoire_id === e.gamme_id)
          .flatMap((l) => [l.personnel_id, ...(l.planning_jour_personnel || []).map((x) => x.personnel_id)]).filter(Boolean)))
          .map((id) => ({ id, nom: nomPersonne[id] || '?' })) : [],
        machine: r.machine_id ? { id: r.machine_id, nom: nomMachine[r.machine_id] || '?' } : null,
        machines_possibles: e.machines_compatibles.map((m) => ({ id: m.id, nom: m.nom })),
        debut: r.debut_min !== null ? iso(r.debut_min) : null,
        fin: r.fin_min !== null ? iso(r.fin_min) : null,
        phases: r.phases.map((ph) => ({
          nom: ph.nom, duree_min: ph.duree_min, besoin_machine: ph.besoin_machine,
          repartissable: ph.repartissable, effectif: ph.effectif, effectif_standard: ph.effectif_standard, duree_une_personne_min: ph.duree_une_personne_min,
          personnes: ph.personnes.map((id) => ({ id, nom: nomPersonne[id] || '?' })),
          tranches: ph.tranches.map((t) => ({ date: dateDe(t.d), debut: heureDe(t.d), fin: heureDe(t.f) })),
          // Relais : seulement quand une personne n'est pas là toute la tâche.
          relais: ph.presences ? Object.entries(ph.presences).map(([id, ivs]) => {
            const minutes = ivs.reduce((t, x) => t + (x.f - x.d), 0);
            return { id, nom: nomPersonne[id] || '?', minutes, debut: iso(ivs[0].d), fin: iso(ivs[ivs.length - 1].f), toute_la_tache: minutes >= ph.duree_min };
          }) : null,
          segments: ph.segments ? ph.segments.map((sg) => ({ date: dateDe(sg.d), debut: heureDe(sg.d), fin: heureDe(sg.f), personnes: sg.personnes })) : null,
        })),
        problemes: r.problemes,
      };
    });

    // Jours fériés (en semaine) tombant dans la période du plan : signalés car non travaillés.
    const joursFeriesPeriode = [];
    if (plan.debut_min !== null && plan.fin_min !== null) {
      for (let j = debutDeJour(plan.debut_min); j <= debutDeJour(plan.fin_min); j += MIN_JOUR) {
        const jourSemaine = new Date(j * 60000).getUTCDay();
        const libelle = libelleFerie(dateDe(j));
        if (libelle && jourSemaine !== 0 && jourSemaine !== 6) joursFeriesPeriode.push({ date: dateDe(j), libelle });
      }
    }

    const reponse = {
      of: { id: of.id, numero: of.numero, quantite: of.quantite, delai: of.delai },
      mode, horaires: horairesCode,
      calendrier: cal,
      etapes: etapesSortie,
      resume: {
        debut: plan.debut_min !== null ? iso(plan.debut_min) : null,
        fin: plan.fin_min !== null ? iso(plan.fin_min) : null,
        delai: delaiMin !== null ? iso(delaiMin) : null,
        respecte_delai: delaiMin !== null && plan.fin_min !== null
          ? (mode === 'arriere' ? plan.respecte_delai : plan.fin_min <= delaiMin)
          : null,
        retard_min: delaiMin !== null && plan.fin_min !== null && plan.fin_min > delaiMin ? plan.fin_min - delaiMin : 0,
        marge_min: mode === 'arriere' && plan.respecte_delai ? plan.marge_min : null,
        complet: plan.complet,
      },
      alternative_heures_sup: null,
      bloquants,
      pert,
      jours_feries: joursFeriesPeriode,
      applique: false,
    };

    // Variante avec heures supplémentaires, si le délai n'est pas tenu en horaires normaux.
    if (!/^heures_sup/.test(horairesCode) && delaiMin !== null && reponse.resume.respecte_delai === false) {
      const alt = lancer(calendrierDe(/_samedi$/.test(horairesCode) ? 'heures_sup_samedi' : 'heures_sup'));
      reponse.alternative_heures_sup = {
        debut: alt.debut_min !== null ? iso(alt.debut_min) : null,
        fin: alt.fin_min !== null ? iso(alt.fin_min) : null,
        respecte_delai: alt.fin_min !== null && alt.fin_min <= delaiMin,
      };
    }

    if (!appliquer) return { statusCode: 200, body: JSON.stringify(reponse) };

    // ---------- 6. Application : écriture du planning ----------
    if (!plan.complet || bloquants.length > 0) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: 'Le plan comporte des points bloquants : corrigez-les avant de l\'appliquer.', bloquants }),
      };
    }

    const lignes = [];
    etapesSortie.filter((e) => !e.fixe).forEach((e) => {
      const calc = etapesCalc.find((x) => x.gamme_id === e.gamme_id);
      e.phases.forEach((ph) => {
        // Avec relais : une ligne par segment (même équipe) ; sinon une ligne par tranche.
        const morceaux = ph.segments
          ? ph.segments.map((sg) => ({ date: sg.date, debut: sg.debut, fin: sg.fin, ids: sg.personnes }))
          : ph.tranches.map((t) => ({ date: t.date, debut: t.debut, fin: t.fin, ids: ph.personnes.map((p) => p.id) }));
        morceaux.forEach((t) => {
          lignes.push({
            ligne: {
              date: t.date, heure_debut: t.debut, heure_fin: t.fin,
              machine_id: ph.besoin_machine && e.machine ? e.machine.id : null,
              personnel_id: t.ids.length ? t.ids[0] : null,
              operation_id: calc.operation_id, gamme_operatoire_id: e.gamme_id, of_id: of.id,
              phase: ph.nom, statut: 'planifié',
            },
            personnes: t.ids,
          });
        });
      });
    });

    const cle = (l) => `${l.gamme_operatoire_id}|${l.phase}|${l.date}|${String(l.heure_debut).slice(0, 5)}`;
    let creees = [];
    if (lignes.length > 0) {
      const { data, error } = await supabase.from('planning_jour')
        .insert(lignes.map((x) => x.ligne)).select('id, gamme_operatoire_id, phase, date, heure_debut');
      if (error) throw error;
      creees = data;

      const liens = [];
      creees.forEach((c) => {
        const source = lignes.find((x) => cle(x.ligne) === cle(c));
        if (source) source.personnes.forEach((pid) => liens.push({ planning_jour_id: c.id, personnel_id: pid }));
      });
      if (liens.length > 0) {
        const { error: lienError } = await supabase.from('planning_jour_personnel').insert(liens);
        if (lienError) {
          await supabase.from('planning_jour').delete().in('id', creees.map((c) => c.id)); // annulation
          throw lienError;
        }
      }
    }

    if (lignesARemplacer.length > 0) {
      const { error } = await supabase.from('planning_jour').delete().in('id', lignesARemplacer.map((l) => l.id));
      if (error) throw error;
    }

    for (const t of aTronquer) {
      const { error } = await supabase.from('planning_jour').update({ heure_fin: t.heure_fin }).eq('id', t.id);
      if (error) throw error;
    }

    for (const e of etapesSortie.filter((x) => !x.fixe)) {
      const { error } = await supabase.from('gammes_operatoires')
        .update({ statut: e.statut === 'en cours' ? 'en cours' : 'planifié', machine_id: e.machine ? e.machine.id : null }).eq('id', e.gamme_id);
      if (error) throw error;
    }

    // Une seule mise en route et un seul nettoyage par journée et par machine (opérations cochées) : jours touchés par ce planning.
    try {
      const cibles = [...lignes.map((x) => x.ligne), ...lignesARemplacer].filter((l) => l.machine_id).map((l) => ({ machine_id: l.machine_id, date: l.date, operation_id: l.operation_id }));
      if (cibles.length) await require('./lib/mutualisation').mutualiserJours(supabase, cibles);
    } catch (e) { console.warn('mutualisation ignorée :', e.message); }

    reponse.applique = true;
    reponse.lignes_creees = creees.length;
    return { statusCode: 200, body: JSON.stringify(reponse) };
  } catch (err) {
    console.error('planifier-of error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
