// functions/gerer-competences.js
//
// GET /.netlify/functions/gerer-competences?personnel_id=uuid
//   -> { personnel_id, operation_codes: string[] }
//      la liste des opérations actuellement cochées pour cette personne.
//
// PUT /.netlify/functions/gerer-competences
//   body : { personnel_id, operation_codes: string[] }
//   -> remplace entièrement l'ensemble des compétences (opérations)
//      de cette personne par la liste fournie (liste vide = aucune
//      compétence). Ne touche pas à personnel_machines (compétences
//      machine précises, ex: Benoit sur BDM/DA/Intégra), gérées
//      séparément.

const { getSupabase } = require('./lib/supabaseclient');

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();

    if (event.httpMethod === 'GET') {
      const personnelId = (event.queryStringParameters || {}).personnel_id;
      if (!personnelId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Paramètre personnel_id requis.' }) };
      }
      const { data, error } = await supabase
        .from('personnel_competences')
        .select('operations(code)')
        .eq('personnel_id', personnelId);
      if (error) throw error;
      return {
        statusCode: 200,
        body: JSON.stringify({ personnel_id: personnelId, operation_codes: data.map((c) => c.operations.code) }),
      };
    }

    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const { personnel_id, operation_codes } = body;
      if (!personnel_id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'personnel_id requis.' }) };
      }

      let operationIds = [];
      if (operation_codes && operation_codes.length > 0) {
        const { data: ops, error: opsError } = await supabase
          .from('operations').select('id, code').in('code', operation_codes);
        if (opsError) throw opsError;
        const trouves = ops.map((o) => o.code);
        const inconnus = operation_codes.filter((c) => !trouves.includes(c));
        if (inconnus.length > 0) {
          return { statusCode: 400, body: JSON.stringify({ error: `Code(s) d'opération inconnu(s) : ${inconnus.join(', ')}` }) };
        }
        operationIds = ops.map((o) => o.id);
      }

      const { error: delError } = await supabase
        .from('personnel_competences').delete().eq('personnel_id', personnel_id);
      if (delError) throw delError;

      if (operationIds.length > 0) {
        const { error: insError } = await supabase
          .from('personnel_competences')
          .insert(operationIds.map((operation_id) => ({ personnel_id, operation_id })));
        if (insError) throw insError;
      }

      return { statusCode: 200, body: JSON.stringify({ personnel_id, operation_codes: operation_codes || [] }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
  } catch (err) {
    console.error('gerer-competences error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
