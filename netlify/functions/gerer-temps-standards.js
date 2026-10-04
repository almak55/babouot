// functions/gerer-temps-standards.js
//
// GET    /.netlify/functions/gerer-temps-standards
//   -> toutes les phases standard, avec le nom de l'opération et de
//      la machine (machine vide = standard valable pour l'opération).
// POST   /.netlify/functions/gerer-temps-standards     (création)
// PUT    /.netlify/functions/gerer-temps-standards     (modification, id requis)
//   body : {
//     id?, operation_id, machine_id?, nom, ordre?,
//     type_calcul: 'fixe' | 'par_element' | 'cadence',
//     duree_h?,          // fixe : durée totale ; par_element : durée PAR élément
//     cadence_par_h?,    // cadence : unités par heure
//     element_param?, element_label?,   // par_element : clé + libellé du paramètre
//     occupe_machine?, nb_personnes?
//   }
// DELETE /.netlify/functions/gerer-temps-standards?id=uuid

const { getSupabase } = require('./lib/supabaseclient');

const TYPES = ['fixe', 'par_element', 'cadence'];

function nombre(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function cleParam(s) {
  return String(s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Valide et normalise le corps de la requête. Retourne { erreur } ou { valeurs }.
function valider(body) {
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
    duree_h: null, cadence_par_h: null, element_param: null, element_label: null,
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
  } else {
    const c = nombre(body.cadence_par_h);
    if (c === null || Number.isNaN(c) || c <= 0) return { erreur: 'Une cadence (unités par heure, > 0) est requise.' };
    v.cadence_par_h = c;
  }
  return { valeurs: v };
}

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('phases_standard')
        .select('*, operations(code, nom), machines(code, nom)');
      if (error) throw error;
      data.sort((a, b) =>
        (a.operations.nom).localeCompare(b.operations.nom, 'fr') ||
        (a.machines ? a.machines.nom : '').localeCompare(b.machines ? b.machines.nom : '', 'fr') ||
        a.ordre - b.ordre
      );
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const { erreur, valeurs } = valider(body);
      if (erreur) return { statusCode: 400, body: JSON.stringify({ error: erreur }) };

      if (event.httpMethod === 'POST') {
        const { data, error } = await supabase.from('phases_standard').insert(valeurs).select('id').single();
        if (error) throw error;
        return { statusCode: 200, body: JSON.stringify(data) };
      }
      if (!body.id) return { statusCode: 400, body: JSON.stringify({ error: 'id requis.' }) };
      const { data, error } = await supabase.from('phases_standard').update(valeurs).eq('id', body.id).select('id').single();
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'DELETE') {
      const id = (event.queryStringParameters || {}).id;
      if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'Paramètre id requis.' }) };
      const { error } = await supabase.from('phases_standard').delete().eq('id', id);
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
  } catch (err) {
    console.error('gerer-temps-standards error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
