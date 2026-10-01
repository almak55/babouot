// functions/gerer-machines.js
//
// GET  /.netlify/functions/gerer-machines
//   -> liste toutes les machines (actives et inactives) avec le nom
//      de leur opération principale.
//
// POST /.netlify/functions/gerer-machines
//   body : { code, nom, operation_code?, notes? }
//   -> crée une nouvelle machine. operation_code est le code d'une
//      opération existante (ex: 'DORURE') ; optionnel si la machine
//      n'est pas encore rattachée à une opération précise.
//
// PUT  /.netlify/functions/gerer-machines
//   body : { id, code?, nom?, operation_code?, actif?, notes? }
//   -> modifie une machine existante. Seuls les champs fournis sont
//      mis à jour. operation_code: null désassocie l'opération.

const { getSupabase } = require('./lib/supabaseclient');

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('machines')
        .select('id, code, nom, actif, notes, operations(code, nom)')
        .order('code');
      if (error) throw error;
      return {
        statusCode: 200,
        body: JSON.stringify(data.map((m) => ({
          id: m.id, code: m.code, nom: m.nom, actif: m.actif, notes: m.notes,
          operation: m.operations ? m.operations.nom : null,
          operation_code: m.operations ? m.operations.code : null,
        }))),
      };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { code, nom, operation_code, notes } = body;
      if (!code || !nom) {
        return { statusCode: 400, body: JSON.stringify({ error: 'code et nom sont requis.' }) };
      }

      let operationId = null;
      if (operation_code) {
        const { data: op, error: opError } = await supabase
          .from('operations').select('id').eq('code', operation_code).maybeSingle();
        if (opError) throw opError;
        if (!op) {
          return { statusCode: 400, body: JSON.stringify({ error: `Opération inconnue : ${operation_code}` }) };
        }
        operationId = op.id;
      }

      const { data, error } = await supabase
        .from('machines')
        .insert({ code, nom, operation_id: operationId, notes: notes || null })
        .select('id, code, nom')
        .single();
      if (error) {
        if (error.code === '23505') {
          return { statusCode: 409, body: JSON.stringify({ error: `Le code "${code}" est déjà utilisé par une autre machine.` }) };
        }
        throw error;
      }
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const { id, code, nom, operation_code, actif, notes } = body;
      if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'id requis.' }) };
      }

      const updates = {};
      if (code !== undefined) updates.code = code;
      if (nom !== undefined) updates.nom = nom;
      if (actif !== undefined) updates.actif = actif;
      if (notes !== undefined) updates.notes = notes;
      if (operation_code !== undefined) {
        if (operation_code === null) {
          updates.operation_id = null;
        } else {
          const { data: op, error: opError } = await supabase
            .from('operations').select('id').eq('code', operation_code).maybeSingle();
          if (opError) throw opError;
          if (!op) {
            return { statusCode: 400, body: JSON.stringify({ error: `Opération inconnue : ${operation_code}` }) };
          }
          updates.operation_id = op.id;
        }
      }

      const { data, error } = await supabase
        .from('machines').update(updates).eq('id', id)
        .select('id, code, nom').single();
      if (error) {
        if (error.code === '23505') {
          return { statusCode: 409, body: JSON.stringify({ error: `Le code "${code}" est déjà utilisé par une autre machine.` }) };
        }
        throw error;
      }
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
