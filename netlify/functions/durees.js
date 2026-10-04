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
// Une durée manuelle sur l'étape remplace le total calculé.

const arrondi = (x) => Math.round(x * 100) / 100;
const heures = (t) => { const [h, m] = String(t).split(':'); return Number(h) + Number(m) / 60; };

function nombreOuNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Retourne { of, etapes, calendrier } ou null si l'OF n'existe pas.
async function calculerEtapes(supabase, ofId) {
  const { data: of, error: ofError } = await supabase
    .from('ordres_fabrication').select('id, numero, quantite, delai').eq('id', ofId).maybeSingle();
  if (ofError) throw ofError;
  if (!of) return null;

  const { data: gammes, error: gammesError } = await supabase
    .from('gammes_operatoires')
    .select('id, sequence, statut, operation_id, machine_id, parametres, duree_manuelle_h, operations(code, nom)')
    .eq('of_id', ofId).order('sequence');
  if (gammesError) throw gammesError;

  const opIds = Array.from(new Set(gammes.map((g) => g.operation_id)));
  const [phasesRes, machinesRes, machinesOpsRes, calRes] = await Promise.all([
    opIds.length
      ? supabase.from('phases_standard').select('*').in('operation_id', opIds)
      : Promise.resolve({ data: [] }),
    supabase.from('machines').select('id, nom, operation_id').eq('actif', true),
    supabase.from('machines_operations').select('machine_id, operation_id'),
    supabase.from('calendrier_travail').select('*'),
  ]);
  for (const r of [phasesRes, machinesRes, machinesOpsRes, calRes]) if (r.error) throw r.error;

  const etapes = gammes.map((g) => {
    const parametres = g.parametres || {};
    const phasesOp = phasesRes.data.filter((p) => p.operation_id === g.operation_id);
    const propres = g.machine_id ? phasesOp.filter((p) => p.machine_id === g.machine_id) : [];
    const generiques = phasesOp.filter((p) => !p.machine_id);
    const utilisees = (propres.length ? propres : generiques).slice().sort((a, b) => a.ordre - b.ordre);
    const source = propres.length ? 'machine' : generiques.length ? 'operation' : 'aucune';

    const quantiteEtape = nombreOuNull(parametres.quantite);
    const quantite = quantiteEtape !== null && quantiteEtape > 0 ? quantiteEtape : of.quantite;

    const manquants = [];
    const requis = [];
    const phases = utilisees.map((p) => {
      let d = 0; let detail = '';
      if (p.type_calcul === 'fixe') {
        d = Number(p.duree_h);
        detail = 'forfait';
      } else if (p.type_calcul === 'par_element') {
        const valeur = nombreOuNull(parametres[p.element_param]);
        if (!requis.some((r) => r.cle === p.element_param)) requis.push({ cle: p.element_param, libelle: p.element_label || p.element_param });
        if (valeur === null) {
          if (!manquants.includes(p.element_param)) manquants.push(p.element_param);
          detail = `${p.element_label || p.element_param} : non renseigné`;
        } else {
          d = Number(p.duree_h) * valeur;
          detail = `${p.duree_h} h × ${valeur} ${p.element_label || p.element_param}`;
        }
      } else {
        d = quantite / Number(p.cadence_par_h);
        detail = `${quantite} ÷ ${p.cadence_par_h}/h`;
      }
      return { nom: p.nom, duree_h: arrondi(d), detail, occupe_machine: p.occupe_machine, nb_personnes: p.nb_personnes };
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
      operation: g.operations.nom, operation_code: g.operations.code,
      machine_id: g.machine_id, machines_compatibles: compatibles,
      source, phases,
      parametres, parametres_requis: requis, parametres_manquants: manquants,
      duree_manuelle_h: manuelle,
      chiffre: source !== 'aucune' || manuelle !== null,
      total_h: arrondi(total),
      heures_machine: arrondi(heuresMachine),
      heures_personnes: arrondi(heuresPersonnes),
    };
  });

  const calendrier = calRes.data.map((c) => {
    const utiles = heures(c.heure_fin) - heures(c.heure_debut) - c.pause_minutes / 60;
    return {
      code: c.code, libelle: c.libelle,
      heure_debut: String(c.heure_debut).slice(0, 5), heure_fin: String(c.heure_fin).slice(0, 5),
      pause_debut: String(c.pause_debut).slice(0, 5), pause_minutes: c.pause_minutes,
      heures_utiles_par_jour: arrondi(utiles),
    };
  });

  return { of, etapes, calendrier };
}

module.exports = { calculerEtapes, arrondi, nombreOuNull };
