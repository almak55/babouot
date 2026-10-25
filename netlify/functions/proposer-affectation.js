// functions/proposer-affectation.js
//
// Proposition automatique du personnel pour une étape de gamme.
//
// GET ?gamme_id=uuid[&date=AAAA-MM-JJ][&machine_id=uuid]
// -> {
//      equipe_requise,            // personnes mobilisées (machine.nb_personnes, sinon max des phases du chiffrage)
//      prioritaire,               // OF haute/urgente ou Pléiade/coffret
//      creneaux: [{date, heure_debut, heure_fin}],   // créneaux que prendrait l'étape à la date demandée
//      conducteur: { id, nom, rang, statut:'libre'|'libre_apres', libre_des?, raison } | null,
//      conducteurs: [{ id, nom, rang, statut:'libre'|'libre_apres'|'occupe'|'indisponible', motif?, libre_des? }],
//      aides: [{ id, nom, poste, competent, charge_min, raison }],     // personnes non conducteurs proposées
//      manque_aides,              // nombre d'aides qu'on n'a pas pu trouver
//      debut_suggere: { date, heure } | null,  // si le conducteur retenu n'est libre qu'après sa tâche en cours
//      avertissements: []
//    }
//
// Règles :
//  • conducteur : d'abord le titulaire (rang 1), puis les suppléants, s'ils sont libres sur les créneaux ;
//  • OF prioritaire : un conducteur occupé sur une tâche NON prioritaire est proposé « dès la fin de sa tâche » (sans rien déplacer) ;
//  • aides : personnes libres qui ne sont conductrices d'aucune machine, compétentes pour l'opération d'abord, puis les moins chargées ;
//    à défaut, des conducteurs d'autres machines sont proposés en dernier recours (signalé).

const { getSupabase } = require('./lib/supabaseclient');
const PL = require('./lib/planification');
const { calculerEtapes } = require('./lib/durees');
const { decouper } = require('./lib/decoupe');
const { jourDebutSuggere, aujourdhuiParis, libelleJour } = require('./lib/debut-etape');

const rep = (statusCode, obj) => ({ statusCode, body: JSON.stringify(obj) });
const hm = (t) => PL.hhmm(String(t).slice(0, 5));
const hh = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const bornes = (l) => [l.heure_debut ? hm(l.heure_debut) : 0, l.heure_fin ? hm(l.heure_fin) : 1440];
const chevauche = (a, b) => a[0] < b[1] && b[0] < a[1];
const jjmm = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
const estPrioritaire = (of) => !!of && (['haute', 'urgente'].includes(of.priorite) || ['pleiade', 'coffret'].includes(of.type_production));

function prochainJourOuvre(iso) {
  let j = PL.debutDeJour(PL.enMinutes(iso, '00:00')) + PL.MIN_JOUR;
  while (!PL.estOuvre(j)) j += PL.MIN_JOUR;
  return PL.dateDe(j);
}

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return rep(405, { error: 'Méthode non autorisée, utiliser GET.' });
    const q = event.queryStringParameters || {};
    if (!q.gamme_id) return rep(400, { error: 'gamme_id requis.' });
    const supabase = getSupabase();

    const { data: gamme, error: eG } = await supabase.from('gammes_operatoires')
      .select('id, of_id, operation_id, machine_id').eq('id', q.gamme_id).single();
    if (eG) throw eG;
    const { data: ofNouveau, error: eO } = await supabase.from('ordres_fabrication').select('id, priorite, type_production').eq('id', gamme.of_id).single();
    if (eO) throw eO;
    const prioritaire = estPrioritaire(ofNouveau);
    const machineId = q.machine_id !== undefined ? (q.machine_id || null) : gamme.machine_id;
    const avertissements = [];

    // Durée réelle de l'étape (chiffrage) -> créneaux horaires
    const calcul = await calculerEtapes(supabase, gamme.of_id);
    const etape = calcul ? calcul.etapes.find((e) => e.gamme_id === gamme.id) : null;
    const cal = (calcul && calcul.calendrier.find((c) => c.code === 'normal')) || { heure_debut: '08:00', heure_fin: '16:30', pause_debut: '12:00', pause_minutes: 30 };
    const phases = !etape ? [] : (etape.duree_manuelle_h !== null && etape.duree_manuelle_h !== undefined
      ? [{ nom: 'Étape (durée manuelle)', duree_h: Number(etape.duree_manuelle_h), nb_personnes: 1 }]
      : (etape.phases || []).map((p) => ({ nom: p.nom, duree_h: Number(p.duree_h), nb_personnes: Number(p.nb_personnes) || 1 })));
    const chiffree = phases.some((p) => p.duree_h > 0);
    const date = q.date || (await jourDebutSuggere(supabase, gamme.id, aujourdhuiParis())).date;
    const faireCreneaux = (d, debutMin) => (chiffree ? decouper(d, phases, cal, debutMin) : [{ date: d, heure_debut: null, heure_fin: null, phase: null }]);
    let creneaux = faireCreneaux(date);
    const chercherJour = q.chercher_jour === '1';
    if (!chiffree) avertissements.push('Étape non chiffrée : elle est comptée sur la journée entière.');
    // Fenêtre de données : 90 jours si on cherche un jour libre, sinon ~3 semaines (pour pouvoir enchaîner après une tâche en cours).
    const dates = [];
    for (let k = 0; k < (chercherJour ? 90 : 21); k++) { const mn = PL.enMinutes(date, '00:00') + k * PL.MIN_JOUR; if (PL.estOuvre(mn)) dates.push(PL.dateDe(mn)); }
    creneaux.forEach((c) => { if (!dates.includes(c.date)) dates.push(c.date); });

    // Équipe requise : réglage de la machine, sinon le plus grand effectif des phases chiffrées
    let machine = null;
    if (machineId) {
      const { data: m, error: eM } = await supabase.from('machines').select('*').eq('id', machineId).maybeSingle();
      if (eM) throw eM; machine = m;
    }
    const parPhases = Math.max(1, ...phases.filter((p) => p.duree_h > 0).map((p) => p.nb_personnes));
    const equipeRequise = machine && machine.nb_personnes > 1 ? machine.nb_personnes : Math.max(machine && machine.nb_personnes ? machine.nb_personnes : 1, parPhases);

    // Données
    const [persRes, pmRes, compRes, absRes, lignesRes] = await Promise.all([
      supabase.from('personnel').select('id, nom, poste').eq('actif', true).order('nom'),
      supabase.from('personnel_machines').select('*'),
      supabase.from('personnel_competences').select('personnel_id, operation_id').eq('operation_id', gamme.operation_id),
      supabase.from('personnel_planning_jour').select('personnel_id, date, statut, heure_debut, heure_fin').in('date', dates),
      supabase.from('planning_jour').select('id, date, heure_debut, heure_fin, personnel_id, machine_id, of_id, gamme_operatoire_id, statut').in('date', dates).neq('statut', 'annulé'),
    ]);
    for (const r of [persRes, pmRes, compRes, absRes, lignesRes]) if (r.error) throw r.error;
    let maintenances = [];
    if (machineId) {
      const { data: mt, error: eMt } = await supabase.from('maintenance_machine').select('date_debut, date_fin, statut').eq('machine_id', machineId).neq('statut', 'terminé');
      if (!eMt) maintenances = mt || [];   // table facultative
    }
    const ids = lignesRes.data.map((l) => l.id);
    const [liensRes, ofsRes] = await Promise.all([
      ids.length ? supabase.from('planning_jour_personnel').select('planning_jour_id, personnel_id').in('planning_jour_id', ids) : { data: [] },
      lignesRes.data.length ? supabase.from('ordres_fabrication').select('id, numero, priorite, type_production').in('id', Array.from(new Set(lignesRes.data.map((l) => l.of_id).filter(Boolean)))) : { data: [] },
    ]);
    for (const r of [liensRes, ofsRes]) if (r.error) throw r.error;
    const ofDe = (id) => ofsRes.data.find((o) => o.id === id) || null;
    const equipeDe = (l) => new Set([l.personnel_id, ...liensRes.data.filter((x) => x.planning_jour_id === l.id).map((x) => x.personnel_id)].filter(Boolean));
    const lignes = lignesRes.data.filter((l) => l.gamme_operatoire_id !== gamme.id);

    const chargeMin = (pid) => lignes.filter((l) => equipeDe(l).has(pid)).reduce((t, l) => { const [s, e] = bornes(l); return t + Math.max(0, e - s - Math.max(0, Math.min(e, 750) - Math.max(s, 720))); }, 0);

    // Statut d'une personne sur les créneaux de l'étape
    const evaluer = (pid) => {
      const blocages = [];
      for (const m of creneaux) {
        const b = bornes(m);
        const a = absRes.data.find((x) => x.personnel_id === pid && x.date === m.date);
        if (a) {
          if (a.statut === 'absent') return { statut: 'indisponible', motif: `absent(e) le ${jjmm(m.date)}` };
          if (a.statut === 'en arrêt') return { statut: 'indisponible', motif: `en arrêt le ${jjmm(m.date)}` };
          if (a.heure_debut && a.heure_fin && (b[0] < hm(a.heure_debut) || b[1] > hm(a.heure_fin))) return { statut: 'indisponible', motif: `disponible seulement ${String(a.heure_debut).slice(0, 5)}–${String(a.heure_fin).slice(0, 5)} le ${jjmm(m.date)}` };
        }
        for (const l of lignes) if (l.date === m.date && equipeDe(l).has(pid) && chevauche(b, bornes(l))) blocages.push(l);
      }
      if (!blocages.length) return { statut: 'libre' };
      const of0 = ofDe(blocages[0].of_id);
      const libelle = `déjà affecté(e) sur ${of0 ? of0.numero : 'une autre tâche'} le ${jjmm(blocages[0].date)}`;
      if (prioritaire && blocages.every((l) => !estPrioritaire(ofDe(l.of_id)))) {
        // Fin de la dernière tâche normale qui gêne : le conducteur pourra démarrer juste après.
        const fin = blocages.map((l) => ({ date: l.date, min: l.heure_fin ? hm(l.heure_fin) : hm(cal.heure_fin) }))
          .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : y.min - x.min))[0];
        let libreDes = { date: fin.date, heure: hh(fin.min) };
        if (fin.min >= hm(cal.heure_fin)) libreDes = { date: prochainJourOuvre(fin.date), heure: cal.heure_debut };
        return { statut: 'libre_apres', libre_des: libreDes, motif: `${libelle} (tâche non prioritaire) — libre dès ${jjmm(libreDes.date)} ${libreDes.heure}` };
      }
      return { statut: 'occupe', motif: libelle };
    };

    // « Libre après sa tâche » : on décale réellement l'étape à cette heure-là et on revérifie (autre tâche plus tard,
    // machine prise…). Résultat : soit libre à une heure confirmée, soit occupé.
    const evaluerEnchaine = (pid) => {
      let res = evaluer(pid);
      if (res.statut !== 'libre_apres') return res;
      const base = creneaux;
      try {
        for (let i = 0; i < 8; i++) {
          const { date: d, heure } = res.libre_des;
          creneaux = faireCreneaux(d, PL.hhmm(heure));
          if (machineOccupee()) return { statut: 'occupe', motif: `la machine est déjà prise à partir de ${jjmm(d)} ${heure}` };
          const r2 = evaluer(pid);
          if (r2.statut === 'libre') return { ...res, libre_des: { date: d, heure } };
          if (r2.statut !== 'libre_apres') return r2;
          res = r2;
        }
        return { statut: 'occupe', motif: 'pas de plage assez longue ce jour-là' };
      } finally { creneaux = base; }
    };
    // Conducteurs de la machine : titulaire puis suppléants (uniquement les personnes avec un rang).
    // Les autres personnes liées à la machine sont seulement « habilitées » : elles sont proposées comme aides.
    const lienMachine = machineId ? pmRes.data.filter((x) => x.machine_id === machineId) : [];
    const ordreC = lienMachine.filter((x) => x.rang !== null && x.rang !== undefined).sort((a, b) => a.rang - b.rang);
    const habilitesIds = new Set(lienMachine.filter((x) => x.rang === null || x.rang === undefined).map((x) => x.personnel_id));
    const nomDe = (pid) => (persRes.data.find((p) => p.id === pid) || {}).nom || '?';
    const calcConducteurs = () => ordreC.filter((x) => persRes.data.some((p) => p.id === x.personnel_id)).map((x) => ({
      id: x.personnel_id, nom: nomDe(x.personnel_id), rang: x.rang, titulaire: x.rang === 1, ...evaluerEnchaine(x.personnel_id),
    }));
    const machineOccupee = () => !!machineId && (
      lignes.some((l) => l.machine_id === machineId && creneaux.some((m) => m.date === l.date && chevauche(bornes(m), bornes(l))))
      || maintenances.some((mt) => creneaux.some((m) => mt.date_debut <= m.date && (!mt.date_fin || mt.date_fin >= m.date))));
    // Recherche du premier jour où la machine ET un conducteur sont disponibles.
    let jourPropose = null;
    if (chercherJour && machineId) {
      const initial = creneaux; let trouve = null;
      for (const d of dates) {
        creneaux = faireCreneaux(d);
        if (machineOccupee()) continue;
        if (ordreC.length && !calcConducteurs().some((c) => c.statut === 'libre' || c.statut === 'libre_apres')) continue;
        trouve = d; break;
      }
      if (trouve) jourPropose = { date: trouve, change: trouve !== date };
      else { creneaux = initial; avertissements.push('Aucun jour disponible (machine + conducteur) dans les 90 prochains jours.'); }
    }
    const conducteurs = calcConducteurs();
    let conducteur = conducteurs.find((c) => c.statut === 'libre') || null;
    if (!conducteur) {
      const apres = conducteurs.filter((c) => c.statut === 'libre_apres')
        .sort((a, b) => (a.libre_des.date + a.libre_des.heure).localeCompare(b.libre_des.date + b.libre_des.heure));
      conducteur = apres[0] || null;
    }
    if (conducteur && conducteur.statut === 'libre_apres') creneaux = faireCreneaux(conducteur.libre_des.date, PL.hhmm(conducteur.libre_des.heure));   // aides évaluées sur le créneau réellement décalé
    if (machineId && !conducteurs.length) avertissements.push('Aucun conducteur défini pour cette machine : renseignez-les dans la fiche de la machine.');
    if (machineId && conducteurs.length && !conducteur) avertissements.push('Aucun conducteur de cette machine n\'est disponible sur ces créneaux.');
    if (conducteur) conducteur.raison = conducteur.statut === 'libre'
      ? (conducteur.rang === 1 ? 'conducteur titulaire, libre' : 'suppléant, libre (titulaire indisponible)')
      : conducteur.motif;

    // Aides : non conducteurs, libres, compétents puis peu chargés
    const besoin = Math.max(0, equipeRequise - (conducteur ? 1 : (machineId ? 0 : 0)));
    const conducteursIds = new Set(ordreC.map((x) => x.personnel_id));
    const conducteurAilleurs = new Set(pmRes.data.filter((x) => x.rang !== null && x.rang !== undefined).map((x) => x.personnel_id));
    const competents = new Set(compRes.data.map((x) => x.personnel_id));
    // Machine avec une liste d'aides potentiels : on ne propose que ces personnes. Sans liste, tout le personnel est candidat.
    const restreindreAides = !!machineId && habilitesIds.size > 0;
    if (machineId && !habilitesIds.size && equipeRequise > 1) avertissements.push('Aucune aide potentielle définie pour cette machine : renseignez-les dans sa fiche (sinon tout le personnel est candidat).');
    const candidatsAides = persRes.data
      .filter((p) => !conducteursIds.has(p.id) && !(conducteur && conducteur.id === p.id))
      .filter((p) => !restreindreAides || habilitesIds.has(p.id))
      .map((p) => ({ id: p.id, nom: p.nom, poste: p.poste || '', ...evaluer(p.id), competent: competents.has(p.id), habilite: habilitesIds.has(p.id), autre_conducteur: conducteurAilleurs.has(p.id), charge_min: chargeMin(p.id) }))
      .filter((p) => p.statut === 'libre')
      .sort((a, b) => (Number(a.autre_conducteur) - Number(b.autre_conducteur)) || (Number(b.habilite) - Number(a.habilite)) || (Number(b.competent) - Number(a.competent)) || (a.charge_min - b.charge_min) || a.nom.localeCompare(b.nom, 'fr'));
    const aides = candidatsAides.slice(0, besoin).map((p) => ({
      id: p.id, nom: p.nom, poste: p.poste, competent: p.competent, charge_min: p.charge_min,
      raison: [p.autre_conducteur ? 'conducteur d\'une autre machine (dernier recours)' : 'aide', p.habilite ? 'habilité(e) sur la machine' : '', p.competent ? 'compétent' : 'sans compétence enregistrée', 'libre'].filter(Boolean).join(', '),
    }));
    const manqueAides = Math.max(0, besoin - aides.length);
    if (manqueAides) avertissements.push(`${manqueAides} aide(s) manquante(s) pour compléter l'équipe de ${equipeRequise}${restreindreAides ? ' : pas assez d\'aides potentiels disponibles de la fiche machine' : ''}.`);
    if (aides.some((a) => !a.competent) && competents.size) avertissements.push('Certaines aides proposées n\'ont pas la compétence enregistrée pour cette opération.');

    return rep(200, {
      equipe_requise: equipeRequise, prioritaire, jour_propose: jourPropose ? { ...jourPropose, libelle: libelleJour(creneaux[0].date) } : null, date: creneaux[0].date, creneaux: creneaux.map((c) => ({ date: c.date, heure_debut: c.heure_debut, heure_fin: c.heure_fin })),
      conducteur: conducteur ? { id: conducteur.id, nom: conducteur.nom, rang: conducteur.rang, statut: conducteur.statut, libre_des: conducteur.libre_des || null, raison: conducteur.raison } : null,
      conducteurs: conducteurs.map((c) => ({ id: c.id, nom: c.nom, rang: c.rang, statut: c.statut, motif: c.motif || null, libre_des: c.libre_des || null })),
      aides, manque_aides: manqueAides,
      debut_suggere: conducteur && conducteur.statut === 'libre_apres' ? conducteur.libre_des : null,
      avertissements,
    });
  } catch (err) {
    return rep(500, { error: err.message });
  }
};

exports.handler = require('./lib/auth').avecAuth(handlerProtege);
