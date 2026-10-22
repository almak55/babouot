// functions/gammes-ordre.js
//
// GET /.netlify/functions/gammes-ordre?of_id=uuid
//
// Réponse : [ { id, sequence, statut, operation: { id, code, nom } } ]

const { getSupabase } = require('./lib/supabaseclient');

const handlerProtege = async (event) => {
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

    // Opération sans machine ? Oui si toutes ses phases standard sont manuelles,
    // ou si elle n'a aucune phase et aucune machine compatible.
    const opIds = Array.from(new Set(data.map((g) => g.operations && g.operations.id).filter(Boolean)));
    if (!opIds.length) return { statusCode: 200, body: JSON.stringify(data.map((g) => ({ id: g.id, sequence: g.sequence, statut: g.statut, operation: g.operations, sans_machine: false }))) };
    const [phasesRes, machRes, liaisonRes] = await Promise.all([
      supabase.from('phases_standard').select('operation_id, occupe_machine').in('operation_id', opIds),
      supabase.from('machines').select('operation_id').in('operation_id', opIds).eq('actif', true),
      supabase.from('machines_operations').select('operation_id').in('operation_id', opIds),
    ]);
    const phases = phasesRes.error ? [] : (phasesRes.data || []);
    const avecMachine = new Set([...(machRes.error ? [] : machRes.data || []), ...(liaisonRes.error ? [] : liaisonRes.data || [])].map((x) => x.operation_id));
    const sansMachine = (opId) => {
      const ph = phases.filter((p) => p.operation_id === opId);
      if (ph.length) return !ph.some((p) => p.occupe_machine !== false);
      return !avecMachine.has(opId);
    };
    return {
      statusCode: 200,
      body: JSON.stringify(data.map((g) => ({
        id: g.id, sequence: g.sequence, statut: g.statut, operation: g.operations,
        sans_machine: !!(g.operations && sansMachine(g.operations.id)),
      }))),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
