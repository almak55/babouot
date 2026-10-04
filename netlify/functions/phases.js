// lib/phases.js
//
// Règles de validation d'une phase de temps standard, partagées par l'écran de
// saisie (gerer-temps-standards) et l'import Excel : les deux doivent appliquer
// exactement les mêmes règles.

const { analyser, RESERVES, normaliser } = require('./formules');

const TYPES = ['fixe', 'par_element', 'cadence', 'formule'];

function nombre(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

// « Largeur (mm) » -> largeur_mm ; sert de clé de caractéristique ou de paramètre
function cleParam(s) {
  return normaliser(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Une clé de caractéristique doit être utilisable telle quelle dans une formule.
function verifierCle(cle) {
  if (!/^[a-z][a-z0-9_]*$/.test(cle)) return 'La clé doit commencer par une lettre et ne contenir que des lettres minuscules, chiffres et « _ ».';
  if (cle.length > 40) return 'Clé trop longue (40 caractères maximum).';
  if (RESERVES.has(cle) || cle === 'quantite') return `« ${cle} » est un mot réservé.`;
  return null;
}

// Valide et normalise une phase. `catalogue` = ensemble des clés de caractéristiques connues.
// Retourne { erreur } ou { valeurs }.
function valider(body, catalogue = new Set()) {
  const nom = String(body.nom || '').trim();
  if (!body.operation_id) return { erreur: 'operation_id requis.' };
  if (!nom) return { erreur: 'Le nom de la phase est requis.' };
  if (!TYPES.includes(body.type_calcul)) return { erreur: `type_calcul invalide (${TYPES.join(', ')}).` };

  const v = {
    operation_id: body.operation_id,
    machine_id: body.machine_id || null,
    nom,
    ordre: Number.isInteger(Number(body.ordre)) && Number(body.ordre) > 0 ? Number(body.ordre) : 1,
    type_calcul: body.type_calcul,
    duree_h: null, cadence_par_h: null, element_param: null, element_label: null, formule: null,
    occupe_machine: body.occupe_machine === undefined ? true : !!body.occupe_machine,
    nb_personnes: Math.max(1, parseInt(body.nb_personnes, 10) || 1),
  };

  if (body.type_calcul === 'fixe') {
    const d = nombre(body.duree_h);
    if (d === null || Number.isNaN(d) || d < 0) return { erreur: 'Une durée (en heures, ≥ 0) est requise pour un forfait.' };
    v.duree_h = d;
  } else if (body.type_calcul === 'par_element') {
    const d = nombre(body.duree_h);
    if (d === null || Number.isNaN(d) || d < 0) return { erreur: 'Une durée par élément (en heures, ≥ 0) est requise.' };
    const cle = cleParam(body.element_param || body.element_label);
    if (!cle) return { erreur: 'Indiquez ce que l\'on compte (ex: « Nombre de fers »).' };
    v.duree_h = d;
    v.element_param = cle;
    v.element_label = String(body.element_label || '').trim() || body.element_param;
  } else if (body.type_calcul === 'cadence') {
    const c = nombre(body.cadence_par_h);
    if (c === null || Number.isNaN(c) || c <= 0) return { erreur: 'Une cadence (unités par heure, > 0) est requise.' };
    v.cadence_par_h = c;
  } else {
    const f = String(body.formule || '').trim();
    const a = analyser(f);
    if (!a.ok) return { erreur: `Formule invalide : ${a.erreur}` };
    const inconnues = a.variables.filter((x) => x !== 'quantite' && !catalogue.has(x));
    if (inconnues.length) {
      return { erreur: `Caractéristique inconnue : ${inconnues.map((x) => `« ${x} »`).join(', ')}. Créez-la d'abord dans « Caractéristiques produit ».` };
    }
    v.formule = f;
  }
  return { valeurs: v };
}

module.exports = { TYPES, nombre, cleParam, verifierCle, valider };
