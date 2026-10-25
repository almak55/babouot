// lib/durees.js
//
// Calcul des durées d'un OF, partagé par `calculer-durees` (chiffrage)
// et `planifier-of` (planification à l'heure) : les deux doivent
// toujours s'appuyer sur exactement la même logique.
//
// Règle de choix des phases pour une étape :
//   1. si une machine est prévue ET a des phases propres pour cette
//      opération -> ces phases ;
//   2. sinon les phases standard de l'opération (machine_id vide) ;
//   3. sinon l'étape n'est pas chiffrée (sauf durée manuelle).
//
// Durée d'une phase :
//   fixe        = duree_h
//   par_element = duree_h x paramètre de l'étape (ex: nb_fers)
//   cadence     = quantité / cadence_par_h  (quantité = paramètre
//                 "quantite" de l'étape, sinon quantité de l'OF)
//   formule     = résultat de la formule (en heures), avec les caractéristiques
//                 du produit (largeur, nombre de pages…) et la quantité
// Valeur d'une caractéristique : celle de l'étape si elle en a une, sinon celle de l'OF.
// Une durée manuelle sur l'étape remplace le total calculé.

const { analyser, evaluer } = require('./formules');
const EL = require('./en-ligne');

const arrondi = (x) => Math.round(x * 100) / 100;
const heures = (t) => { const [h, m] = String(t).split(':'); return Number(h) + Number(m) / 60; };

function nombreOuNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Retourne { of, etapes, calendrier } ou null si l'OF n'existe pas.
async function calculerEtapes(supabase, ofId) {
  let { data: of, error: ofError } = await supabase
    .from('ordres_fabrication').select('id, numero, quantite, delai, caracteristiques, type_production').eq('id', ofId).maybeSingle();
  if (ofError && /type_production/.test(ofError.message || '')) {
    // Migration 23 pas encore exécutée : on continue sans type de production.
    ({ data: of, error: ofError } = await supabase
      .from('ordres_fabrication').select('id, numero, quantite, delai, caracteristiques').eq('id', ofId).maybeSingle());
  }
  if (ofError) throw ofError;
  if (!of) return null;

  await require('./ordre-gamme').normaliserGamme(supabase, ofId);   // dépendances implicites rendues explicites (ordre logique)
  const { data: gammes, error: gammesError } = await supabase
    .from('gammes_operatoires')
    .select('id, sequence, statut, operation_id, machine_id, parametres, duree_manuelle_h, predecesseurs, dependances, operations(code, nom)')
    .eq('of_id', ofId).order('sequence');
  if (gammesError) throw gammesError;

  const opIds = Array.from(new Set(gammes.map((g) => g.operation_id)));
  const typesRes = await supabase.from('types_production').select('code, libelle').order('ordre');
  const typesProduction = typesRes.error ? [] : (typesRes.data || []);
  const typeOf = (of && of.type_production) || null;
  const [phasesRes, machinesRes, machinesOpsRes, calRes, catalogueRes] = await Promise.all([
    opIds.length
      ? supabase.from('phases_standard').select('*').in('operation_id', opIds)
      : Promise.resolve({ data: [] }),
    supabase.from('machines').select('id, nom, operation_id').eq('actif', true),
    supabase.from('machines_operations').select('machine_id, operation_id'),
    supabase.from('calendrier_travail').select('*'),
    supabase.from('caracteristiques_produit').select('cle, libelle, type, unite'),
  ]);
  for (const r of [phasesRes, machinesRes, machinesOpsRes, calRes, catalogueRes]) if (r.error) throw r.error;

  const catalogue = catalogueRes.data || [];
  const parCle = Object.fromEntries(catalogue.map((c) => [c.cle, c]));
  const typesCar = Object.fromEntries(catalogue.map((c) => [c.cle, c.type]));
  const caracteristiquesOf = of.caracteristiques || {};

  const etapes = gammes.map((g) => {
    const parametres = g.parametres || {};
    const phasesOp = phasesRes.data.filter((p) => p.operation_id === g.operation_id);
    // Priorité : temps de la machine pour le type de l'OF > temps de la machine pour tous types >
    // temps standard de l'opération pour le type de l'OF > pour tous types.
    const duType = (liste) => liste.filter((p) => (p.type_production || null) === typeOf);
    const tousTypes = (liste) => liste.filter((p) => !p.type_production);
    const deLaMachine = g.machine_id ? phasesOp.filter((p) => p.machine_id === g.machine_id) : [];
    const deLOperation = phasesOp.filter((p) => !p.machine_id);
    const candidats = [
      ['machine', typeOf ? duType(deLaMachine) : []], ['machine', tousTypes(deLaMachine)],
      ['operation', typeOf ? duType(deLOperation) : []], ['operation', tousTypes(deLOperation)],
    ];
    const retenu = candidats.find(([, l]) => l.length) || ['aucune', []];
    const utilisees = retenu[1].slice().sort((a, b) => a.ordre - b.ordre);
    const source = retenu[0];
    // Des temps existent mais pour un autre type de production : il faut choisir le type de l'OF.
    const typesAutres = Array.from(new Set(phasesOp.filter((p) => p.type_production && p.type_production !== typeOf
      && (!p.machine_id || p.machine_id === g.machine_id)).map((p) => p.type_production)));
    const typeManquant = !utilisees.length && typesAutres.length > 0;

    const quantiteEtape = nombreOuNull(parametres.quantite);
    const quantite = quantiteEtape !== null && quantiteEtape > 0 ? quantiteEtape : of.quantite;

    // Valeur d'une caractéristique : propre à l'étape, sinon celle de l'OF.
    const valeurDe = (cle) => {
      const brut = parametres[cle] !== undefined && parametres[cle] !== null && String(parametres[cle]).trim() !== ''
        ? parametres[cle] : caracteristiquesOf[cle];
      return brut === undefined || brut === null || String(brut).trim() === '' ? null : brut;
    };

    const manquants = [];
    const requis = [];
    const erreursFormule = [];
    const ajouterRequis = (cle, libelle, type, unite) => {
      if (!requis.some((r) => r.cle === cle)) requis.push({ cle, libelle, type: type || 'nombre', unite: unite || null });
    };
    const phases = utilisees.map((p) => {
      let d = 0; let detail = '';
      if (p.type_calcul === 'fixe') {
        d = Number(p.duree_h);
        detail = 'forfait';
      } else if (p.type_calcul === 'par_element') {
        const valeur = nombreOuNull(valeurDe(p.element_param));
        ajouterRequis(p.element_param, (parCle[p.element_param] && parCle[p.element_param].libelle) || p.element_label || p.element_param, 'nombre', parCle[p.element_param] && parCle[p.element_param].unite);
        if (valeur === null) {
          if (!manquants.includes(p.element_param)) manquants.push(p.element_param);
          detail = `${p.element_label || p.element_param} : non renseigné`;
        } else {
          d = Number(p.duree_h) * valeur;
          detail = `${p.duree_h} h × ${valeur} ${p.element_label || p.element_param}`;
        }
      } else if (p.type_calcul === 'formule') {
        const a = analyser(p.formule);
        if (!a.ok) {
          erreursFormule.push({ phase: p.nom, message: a.erreur });
          detail = `formule invalide : ${a.erreur}`;
        } else {
          const valeurs = {};
          a.variables.forEach((v) => {
            const info = v === 'quantite' ? { libelle: 'Quantité (exemplaires)', type: 'nombre', unite: null } : (parCle[v] || { libelle: v, type: 'nombre', unite: null });
            if (v === 'quantite') valeurs[v] = quantite;
            else { const val = valeurDe(v); if (val !== null) valeurs[v] = val; }
            ajouterRequis(v, info.libelle, info.type, info.unite);
          });
          const r = evaluer(p.formule, valeurs, { ...typesCar, quantite: 'nombre' });
          if (!r.ok) {
            erreursFormule.push({ phase: p.nom, message: r.erreur });
            detail = `erreur : ${r.erreur}`;
          } else if (r.manquantes.length) {
            r.manquantes.forEach((v) => { if (!manquants.includes(v)) manquants.push(v); });
            detail = `${p.formule} — à renseigner : ${r.manquantes.join(', ')}`;
          } else {
            d = r.valeur;
            detail = `${p.formule}  [${a.variables.map((v) => `${v} = ${valeurs[v]}`).join(', ')}]`;
          }
        }
      } else if (p.quantite_formule && String(p.quantite_formule).trim()) {
        // Cadence sur une autre unité que l'exemplaire (cahiers cousus/pliés, coupes au massicot…) :
        // la quantité de travail se calcule d'après la fiche (ex. quantite * nb_cahiers).
        const unite = p.unite_cadence || 'unités';
        const a = analyser(p.quantite_formule);
        if (!a.ok) {
          erreursFormule.push({ phase: p.nom, message: `quantité à traiter : ${a.erreur}` });
          detail = `formule invalide : ${a.erreur}`;
        } else {
          const valeurs = {};
          a.variables.forEach((v) => {
            const info = v === 'quantite' ? { libelle: 'Quantité (exemplaires)', type: 'nombre', unite: null } : (parCle[v] || { libelle: v, type: 'nombre', unite: null });
            if (v === 'quantite') valeurs[v] = quantite;
            else { const val = valeurDe(v); if (val !== null) valeurs[v] = val; }
            ajouterRequis(v, info.libelle, info.type, info.unite);
          });
          const r = evaluer(p.quantite_formule, valeurs, { ...typesCar, quantite: 'nombre' });
          if (!r.ok) {
            erreursFormule.push({ phase: p.nom, message: `quantité à traiter : ${r.erreur}` });
            detail = `erreur : ${r.erreur}`;
          } else if (r.manquantes.length) {
            r.manquantes.forEach((v) => { if (!manquants.includes(v)) manquants.push(v); });
            detail = `à renseigner : ${r.manquantes.join(', ')}`;
          } else {
            const n = Math.max(1, Number(p.par_passage) || 1);
            const passages = n > 1 ? Math.ceil(r.valeur / n - 1e-9) : r.valeur;
            d = passages / Number(p.cadence_par_h);
            detail = n > 1
              ? `${Math.round(r.valeur * 100) / 100} ${unite} ÷ ${n} par passage = ${passages} passages ÷ ${p.cadence_par_h} passages/h  [${p.quantite_formule}]`
              : `${Math.round(r.valeur * 100) / 100} ${unite} ÷ ${p.cadence_par_h} ${unite}/h  [${p.quantite_formule}]`;
          }
        }
      } else {
        const n = Math.max(1, Number(p.par_passage) || 1);
        if (n > 1) {
          const passages = Math.ceil(quantite / n - 1e-9);
          d = passages / Number(p.cadence_par_h);
          detail = `${quantite} ex. ÷ ${n} par passage = ${passages} passages ÷ ${p.cadence_par_h} passages/h`;
        } else {
          d = quantite / Number(p.cadence_par_h);
          detail = `${quantite} ÷ ${p.cadence_par_h}/h`;
        }
      }
      return { nom: p.nom, duree_h: arrondi(d), detail, occupe_machine: p.occupe_machine, nb_personnes: p.nb_personnes, type_calcul: p.type_calcul };
    });

    const totalPhases = phases.reduce((s, p) => s + p.duree_h, 0);
    let heuresMachine = phases.filter((p) => p.occupe_machine).reduce((s, p) => s + p.duree_h, 0);
    let heuresPersonnes = phases.reduce((s, p) => s + p.duree_h * p.nb_personnes, 0);

    const manuelle = g.duree_manuelle_h === null || g.duree_manuelle_h === undefined ? null : Number(g.duree_manuelle_h);
    let total = totalPhases;
    if (manuelle !== null) {
      total = manuelle;
      if (totalPhases > 0) {
        const ratio = manuelle / totalPhases;
        heuresMachine *= ratio; heuresPersonnes *= ratio;
      } else {
        heuresMachine = manuelle; heuresPersonnes = manuelle;
      }
    }

    const compatibles = machinesRes.data
      .filter((m) => m.operation_id === g.operation_id ||
        machinesOpsRes.data.some((mo) => mo.machine_id === m.id && mo.operation_id === g.operation_id))
      .map((m) => ({ id: m.id, nom: m.nom, temps_specifiques: phasesOp.some((p) => p.machine_id === m.id) }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

    return {
      gamme_id: g.id, sequence: g.sequence, statut: g.statut,
      operation_id: g.operation_id,
      predecesseurs: g.predecesseurs ?? null,   // numéros d'étapes ; null = après l'étape précédente
      dependances: g.dependances || {},         // options par lien : { "1": { mode: "progressif", seuil_pct: 10 } }
      operation: g.operations.nom, operation_code: g.operations.code,
      machine_id: g.machine_id, machines_compatibles: compatibles,
      source, phases, type_manquant: typeManquant,
      types_possibles: typeManquant ? typesAutres : [],
      parametres, parametres_requis: requis, parametres_manquants: manquants,
      duree_manuelle_h: manuelle,
      erreurs_formule: erreursFormule,
      chiffre: (source !== 'aucune' && erreursFormule.length === 0) || manuelle !== null,
      total_h: arrondi(total),
      heures_machine: arrondi(heuresMachine),
      heures_personnes: arrondi(heuresPersonnes),
    };
  });

  // Opérations en ligne : la production de l'étape suit celle de son prédécesseur.
  const reglesEL = await EL.chargerRegles(supabase);
  EL.appliquerEnLigne(etapes, reglesEL);
  // Couples « en ligne » connus (ex. contrôle couvertures / montage) : l'écran propose « en ligne » par défaut pour ces liens.
  etapes.forEach((e) => { e.regle_en_ligne = etapes.filter((x) => x.sequence !== e.sequence && reglesEL.has(`${e.operation_code}|${x.operation_code}`)).map((x) => x.sequence); });

  const calendrier = calRes.data.map((c) => {
    const utiles = heures(c.heure_fin) - heures(c.heure_debut) - c.pause_minutes / 60;
    return {
      code: c.code, libelle: c.libelle,
      heure_debut: String(c.heure_debut).slice(0, 5), heure_fin: String(c.heure_fin).slice(0, 5),
      pause_debut: String(c.pause_debut).slice(0, 5), pause_minutes: c.pause_minutes,
      heures_utiles_par_jour: arrondi(utiles),
    };
  });

  return { of: { ...of, caracteristiques: caracteristiquesOf, type_production: typeOf }, types_production: typesProduction, etapes, calendrier, catalogue };
}

module.exports = { calculerEtapes, arrondi, nombreOuNull };
