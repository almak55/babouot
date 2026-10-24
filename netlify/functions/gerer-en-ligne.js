// functions/gerer-en-ligne.js
//
// Opérations « en ligne » (voir lib/en-ligne.js).
//
// GET    -> { liaisons: [{ operation_code, operation, avec_operation_code, avec, commentaire }] }
// POST   body { operation_code, avec_operation_code, commentaire? } -> ajoute le couple
// DELETE ?operation_code=X&avec_operation_code=Y                    -> retire le couple

const { getSupabase } = require('./lib/supabaseclient');
const rep = (statusCode, obj) => ({ statusCode, body: JSON.stringify(obj) });
const MIGRATION = 'Table liaisons_en_ligne absente : exécutez migration_34_en_ligne.sql dans Supabase.';

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();
    const m = event.httpMethod;

    if (m === 'GET') {
      const [l, o] = await Promise.all([
        supabase.from('liaisons_en_ligne').select('operation_code, avec_operation_code, commentaire'),
        supabase.from('operations').select('code, nom'),
      ]);
      if (l.error) return rep(500, { error: /liaisons_en_ligne/.test(l.error.message) ? MIGRATION : l.error.message });
      if (o.error) throw o.error;
      const nom = Object.fromEntries(o.data.map((x) => [x.code, x.nom]));
      const liaisons = l.data.map((x) => ({
        operation_code: x.operation_code, operation: nom[x.operation_code] || x.operation_code,
        avec_operation_code: x.avec_operation_code, avec: nom[x.avec_operation_code] || x.avec_operation_code, commentaire: x.commentaire,
      })).sort((a, b) => a.operation.localeCompare(b.operation, 'fr') || a.avec.localeCompare(b.avec, 'fr'));
      return rep(200, { liaisons });
    }

    if (m === 'POST') {
      const b = JSON.parse(event.body || '{}');
      const { operation_code, avec_operation_code } = b;
      if (!operation_code || !avec_operation_code) return rep(400, { error: 'Les deux opérations sont requises.' });
      if (operation_code === avec_operation_code) return rep(400, { error: 'Une opération ne peut pas être en ligne avec elle-même.' });
      const { data: ops, error: e1 } = await supabase.from('operations').select('code').in('code', [operation_code, avec_operation_code]);
      if (e1) throw e1;
      if (ops.length < 2) return rep(400, { error: 'Opération inconnue.' });
      const inverse = await supabase.from('liaisons_en_ligne').select('operation_code').eq('operation_code', avec_operation_code).eq('avec_operation_code', operation_code);
      if (inverse.error) return rep(500, { error: /liaisons_en_ligne/.test(inverse.error.message) ? MIGRATION : inverse.error.message });
      if ((inverse.data || []).length) return rep(409, { error: 'Le couple inverse existe déjà : deux opérations ne peuvent pas dépendre l\'une de l\'autre.' });
      const { error } = await supabase.from('liaisons_en_ligne').upsert({ operation_code, avec_operation_code, commentaire: b.commentaire || null }, { onConflict: 'operation_code,avec_operation_code' });
      if (error) throw error;
      return rep(201, { ok: true });
    }

    if (m === 'DELETE') {
      const q = event.queryStringParameters || {};
      if (!q.operation_code || !q.avec_operation_code) return rep(400, { error: 'operation_code et avec_operation_code requis.' });
      const { error } = await supabase.from('liaisons_en_ligne').delete().eq('operation_code', q.operation_code).eq('avec_operation_code', q.avec_operation_code);
      if (error) throw error;
      return rep(200, { ok: true });
    }
    return rep(405, { error: 'Méthode non autorisée.' });
  } catch (err) {
    return rep(500, { error: err.message });
  }
};

exports.handler = require('./lib/auth').avecAuth(handlerProtege);
