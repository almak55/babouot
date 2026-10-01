// functions/gammes-ordre.js
//
// GET /.netlify/functions/gammes-ordre?of_id=uuid
//
// Réponse : [ { id, sequence, statut, operation: { id, code, nom } } ]

const { getSupabase } = require('./lib/supabaseclient');

exports.handler = async (event) => {
  try {
    const ofId = (event.queryStringParameters || {}).of_id;
    if (!ofId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Paramètre of_id requis.' }) };
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('gammes_operatoires')
      .select('id, sequence, statut, operations(id, code, nom)')
      .eq('of_id', ofId)
      .order('sequence');
    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify(data.map((g) => ({
        id: g.id, sequence: g.sequence, statut: g.statut, operation: g.operations,
      }))),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
