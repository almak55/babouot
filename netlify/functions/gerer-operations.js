// functions/gerer-operations.js
//
// Catalogue des opérations (ajout manuel).
//
// GET    -> { operations: [{ id, code, nom, famille, ordre_defaut, utilisee }] }
// POST   body { nom, famille?, apres_code? }  -> crée l'opération (code déduit du nom)
//        apres_code : place la nouvelle opération juste après celle-ci dans l'ordre par défaut
//        (sinon : à la fin).
// PUT    body { code, nom?, famille?, apres_code? }  -> modifie nom, famille, position (le code ne change pas)
// DELETE ?code=XXX                            -> supprime, sauf si l'opération est déjà utilisée

const { getSupabase } = require('./lib/supabaseclient');

function codeDepuisNom(nom) {
  return String(nom).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
}
const rep = (statusCode, obj) => ({ statusCode, body: JSON.stringify(obj) });

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();
    const methode = event.httpMethod;

    if (methode === 'GET') {
      const { data, error } = await supabase.from('operations')
        .select('id, code, nom, famille, ordre_defaut').order('ordre_defaut', { nullsFirst: false }).order('nom');
      if (error) throw error;
      const utilisees = new Set();
      for (const t of ['gammes_operatoires', 'machines_operations', 'personnel_competences', 'phases_standard']) {
        const r = await supabase.from(t).select('operation_id');
        if (!r.error) (r.data || []).forEach((x) => utilisees.add(x.operation_id));
      }
      return rep(200, { operations: data.map((o) => ({ ...o, utilisee: utilisees.has(o.id) })) });
    }

    const body = methode === 'DELETE' ? {} : JSON.parse(event.body || '{}');

    if (methode === 'POST') {
      const nom = String(body.nom || '').trim();
      if (!nom) return rep(400, { error: 'Le nom de l\'opération est requis.' });
      const code = codeDepuisNom(body.code || nom);
      if (!code) return rep(400, { error: 'Nom invalide : utilisez des lettres ou des chiffres.' });

      const { data: existe } = await supabase.from('operations').select('id').eq('code', code).maybeSingle();
      if (existe) return rep(409, { error: `Une opération avec le code « ${code} » existe déjà.` });

      const { data: toutes, error: e1 } = await supabase.from('operations').select('code, ordre_defaut');
      if (e1) throw e1;
      const max = Math.max(0, ...toutes.map((o) => o.ordre_defaut || 0));
      let ordre = max + 10;
      if (body.apres_code) {
        const ref = toutes.find((o) => o.code === body.apres_code);
        if (ref && ref.ordre_defaut != null) {
          ordre = ref.ordre_defaut + 1;
          // décale celles qui suivent pour libérer la place
          const suivantes = toutes.filter((o) => o.ordre_defaut != null && o.ordre_defaut >= ordre);
          for (const o of suivantes) {
            const r = await supabase.from('operations').update({ ordre_defaut: o.ordre_defaut + 1 }).eq('code', o.code);
            if (r.error) throw r.error;
          }
        }
      }
      const { data, error } = await supabase.from('operations')
        .insert({ code, nom, famille: String(body.famille || '').trim() || null, ordre_defaut: ordre })
        .select('id, code, nom, famille, ordre_defaut').single();
      if (error) throw error;
      return rep(201, data);
    }

    if (methode === 'PUT') {
      if (!body.code) return rep(400, { error: 'code requis.' });
      const maj = {};
      if (body.nom !== undefined) {
        const nom = String(body.nom).trim();
        if (!nom) return rep(400, { error: 'Le nom ne peut pas être vide.' });
        maj.nom = nom;
      }
      if (body.famille !== undefined) maj.famille = String(body.famille).trim() || null;
      // Repositionnement : apres_code = code de l'opération précédente, '__debut' = en première place
      if (body.apres_code !== undefined && body.apres_code !== null && body.apres_code !== '__garder') {
        const { data: toutes, error: e1 } = await supabase.from('operations').select('code, ordre_defaut');
        if (e1) throw e1;
        const triees = toutes.slice().sort((x, y) => (x.ordre_defaut ?? 1e9) - (y.ordre_defaut ?? 1e9));
        const autres = triees.filter((o) => o.code !== body.code);
        let idx = 0;
        if (body.apres_code === '') idx = autres.length;                       // à la fin
        else if (body.apres_code !== '__debut') {
          const i = autres.findIndex((o) => o.code === body.apres_code);
          idx = i >= 0 ? i + 1 : autres.length;
        }
        autres.splice(idx, 0, { code: body.code });
        for (let i = 0; i < autres.length; i++) {
          const ordre = (i + 1) * 10;
          const ancien = toutes.find((o) => o.code === autres[i].code);
          if (ancien && ancien.ordre_defaut === ordre) continue;
          const r = await supabase.from('operations').update({ ordre_defaut: ordre }).eq('code', autres[i].code);
          if (r.error) throw r.error;
        }
      }
      const { data, error } = await supabase.from('operations').update(maj).eq('code', body.code)
        .select('id, code, nom, famille, ordre_defaut').single();
      if (error) throw error;
      return rep(200, data);
    }

    if (methode === 'DELETE') {
      const code = (event.queryStringParameters || {}).code;
      if (!code) return rep(400, { error: 'code requis.' });
      const { data: op } = await supabase.from('operations').select('id, nom').eq('code', code).maybeSingle();
      if (!op) return rep(404, { error: 'Opération introuvable.' });
      const { error } = await supabase.from('operations').delete().eq('id', op.id);
      if (error) {
        return rep(409, { error: `« ${op.nom} » est déjà utilisée (gammes, machines, personnel ou temps standards) et ne peut pas être supprimée.` });
      }
      return rep(200, { ok: true });
    }

    return rep(405, { error: 'Méthode non autorisée.' });
  } catch (err) {
    return rep(500, { error: err.message });
  }
};

exports.handler = require('./lib/auth').avecAuth(handlerProtege);
