// functions/gerer-machines.js
//
// GET  /.netlify/functions/gerer-machines
//   -> liste toutes les machines (actives et inactives) avec la liste
//      de leurs opérations (une machine peut en faire plusieurs).
//
// POST /.netlify/functions/gerer-machines
//   body : { code, nom, operation_codes?: string[], notes? }
//   -> crée une nouvelle machine, rattachée à 0, 1 ou plusieurs
//      opérations existantes (ex: ['DORURE', 'FINITION']).
//
// PUT  /.netlify/functions/gerer-machines
//   body : { id, code?, nom?, operation_codes?: string[], actif?, notes? }
//   -> modifie une machine existante. Si operation_codes est fourni,
//      remplace entièrement l'ensemble de ses opérations (liste vide
//      = plus aucune opération rattachée).

const { getSupabase } = require('./lib/supabaseclient');

async function resoudreOperationIds(supabase, codes) {
  if (!codes || codes.length === 0) return [];
  const { data, error } = await supabase.from('operations').select('id, code').in('code', codes);
  if (error) throw error;
  const trouves = data.map((o) => o.code);
  const inconnus = codes.filter((c) => !trouves.includes(c));
  if (inconnus.length > 0) {
    const err = new Error(`Code(s) d'opération inconnu(s) : ${inconnus.join(', ')}`);
    err.isClientError = true;
    throw err;
  }
  return data.map((o) => o.id);
}

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('machines')
        .select('id, code, nom, actif, notes, machines_operations(operations(code, nom))')
        .order('code');
      if (error) throw error;
      return {
        statusCode: 200,
        body: JSON.stringify(data.map((m) => ({
          id: m.id, code: m.code, nom: m.nom, actif: m.actif, notes: m.notes,
          operations: m.machines_operations.map((mo) => mo.operations),
        }))),
      };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { code, nom, operation_codes, notes } = body;
      if (!code || !nom) {
        return { statusCode: 400, body: JSON.stringify({ error: 'code et nom sont requis.' }) };
      }

      let operationIds;
      try { operationIds = await resoudreOperationIds(supabase, operation_codes); }
      catch (e) {
        if (e.isClientError) return { statusCode: 400, body: JSON.stringify({ error: e.message }) };
        throw e;
      }

      const { data: machine, error } = await supabase
        .from('machines')
        .insert({ code, nom, notes: notes || null })
        .select('id, code, nom')
        .single();
      if (error) {
        if (error.code === '23505') {
          return { statusCode: 409, body: JSON.stringify({ error: `Le code "${code}" est déjà utilisé par une autre machine.` }) };
        }
        throw error;
      }

      if (operationIds.length > 0) {
        const { error: linkError } = await supabase
          .from('machines_operations')
          .insert(operationIds.map((operation_id) => ({ machine_id: machine.id, operation_id })));
        if (linkError) throw linkError;
      }

      return { statusCode: 200, body: JSON.stringify(machine) };
    }

    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const { id, code, nom, operation_codes, actif, notes } = body;
      if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'id requis.' }) };
      }

      const updates = {};
      if (code !== undefined) updates.code = code;
      if (nom !== undefined) updates.nom = nom;
      if (actif !== undefined) updates.actif = actif;
      if (notes !== undefined) updates.notes = notes;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('machines').update(updates).eq('id', id);
        if (error) {
          if (error.code === '23505') {
            return { statusCode: 409, body: JSON.stringify({ error: `Le code "${code}" est déjà utilisé par une autre machine.` }) };
          }
          throw error;
        }
      }

      if (operation_codes !== undefined) {
        let operationIds;
        try { operationIds = await resoudreOperationIds(supabase, operation_codes); }
        catch (e) {
          if (e.isClientError) return { statusCode: 400, body: JSON.stringify({ error: e.message }) };
          throw e;
        }

        const { error: delError } = await supabase.from('machines_operations').delete().eq('machine_id', id);
        if (delError) throw delError;

        if (operationIds.length > 0) {
          const { error: insError } = await supabase
            .from('machines_operations')
            .insert(operationIds.map((operation_id) => ({ machine_id: id, operation_id })));
          if (insError) throw insError;
        }
      }

      const { data, error: readError } = await supabase
        .from('machines').select('id, code, nom').eq('id', id).single();
      if (readError) throw readError;

      return { statusCode: 200, body: JSON.stringify(data) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
  } catch (err) {
    console.error('gerer-machines error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
