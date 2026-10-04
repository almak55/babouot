// functions/gerer-temps-standards.js
//
// GET    /.netlify/functions/gerer-temps-standards
//   -> toutes les phases standard, avec le nom de l'opération et de
//      la machine (machine vide = standard valable pour l'opération).
// POST   /.netlify/functions/gerer-temps-standards     (création)
// PUT    /.netlify/functions/gerer-temps-standards     (modification, id requis)
//   body : {
//     id?, operation_id, machine_id?, nom, ordre?,
//     type_calcul: 'fixe' | 'par_element' | 'cadence' | 'formule',
//     duree_h?,          // fixe : durée totale ; par_element : durée PAR élément
//     cadence_par_h?,    // cadence : unités par heure
//     element_param?, element_label?,   // par_element : clé + libellé du paramètre
//     formule?,          // formule : expression donnant des HEURES (voir lib/formules.js)
//     occupe_machine?, nb_personnes?
//   }
// POST   { action: 'copier', operation_id, source_machine_id?, cibles: [machine_id], remplacer? }
//   -> copie les phases d'une machine (ou du standard de l'opération) vers d'autres
//      machines, pour ne pas tout ressaisir. Une machine qui a déjà des phases pour
//      cette opération est ignorée sauf si remplacer = true.
// DELETE /.netlify/functions/gerer-temps-standards?id=uuid

const { getSupabase } = require('./lib/supabaseclient');
const { valider } = require('./lib/phases');

async function cataloguePhases(supabase) {
  const { data, error } = await supabase.from('caracteristiques_produit').select('cle');
  if (error) throw error;
  return new Set(data.map((c) => c.cle));
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

      // ---- Copie de réglages d'une machine vers d'autres ----
      if (event.httpMethod === 'POST' && body.action === 'copier') {
        const { operation_id, source_machine_id = null, remplacer = false } = body;
        const cibles = Array.from(new Set(Array.isArray(body.cibles) ? body.cibles : [])).filter((m) => m && m !== source_machine_id);
        if (!operation_id) return { statusCode: 400, body: JSON.stringify({ error: 'operation_id requis.' }) };
        if (cibles.length === 0) return { statusCode: 400, body: JSON.stringify({ error: 'Choisissez au moins une machine de destination.' }) };

        let q = supabase.from('phases_standard').select('*').eq('operation_id', operation_id);
        q = source_machine_id ? q.eq('machine_id', source_machine_id) : q.is('machine_id', null);
        const { data: source, error: srcError } = await q;
        if (srcError) throw srcError;
        if (source.length === 0) return { statusCode: 400, body: JSON.stringify({ error: 'Aucune phase à copier pour cette source.' }) };

        const copiees = []; const ignorees = [];
        for (const cible of cibles) {
          const { data: existantes, error: exError } = await supabase
            .from('phases_standard').select('id').eq('operation_id', operation_id).eq('machine_id', cible);
          if (exError) throw exError;
          if (existantes.length > 0 && !remplacer) { ignorees.push({ machine_id: cible, raison: 'a déjà des phases pour cette opération' }); continue; }
          if (existantes.length > 0) {
            const { error: delError } = await supabase.from('phases_standard').delete().eq('operation_id', operation_id).eq('machine_id', cible);
            if (delError) throw delError;
          }
          const lignes = source.map(({ id, created_at, ...reste }) => ({ ...reste, machine_id: cible }));
          const { error: insError } = await supabase.from('phases_standard').insert(lignes);
          if (insError) throw insError;
          copiees.push({ machine_id: cible, nb: lignes.length });
        }
        return { statusCode: 200, body: JSON.stringify({ copiees, ignorees }) };
      }

      const { erreur, valeurs } = valider(body, await cataloguePhases(supabase));
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
