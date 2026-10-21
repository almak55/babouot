// functions/gerer-pleiade.js
//
// Référentiel Pléiade modifiable depuis l'écran.
//
// GET                      -> { categories, modele, parametres }
// POST   { code?, libelle, ordre?, tete?, gardes?, cuir?, tranchefile?, signets?, piece?, piece_ref?, notes? }
//        création d'une catégorie (code déduit du libellé si absent)
// PUT    { code, ...champs }   modification d'une catégorie
// DELETE ?code=...             désactive la catégorie (actif=false) ; ?code=...&definitif=1 la supprime
// PUT    { parametre: 'client', valeur: 'Gallimard' }   modification d'un paramètre

const { getSupabase } = require('./lib/supabaseclient');

const CHAMPS = ['libelle', 'ordre', 'tete', 'gardes', 'cuir', 'tranchefile', 'signets', 'piece', 'piece_ref', 'notes', 'actif'];
const propre = (b) => {
  const o = {};
  CHAMPS.forEach((k) => {
    if (b[k] === undefined) return;
    o[k] = (typeof b[k] === 'string') ? (b[k].trim() === '' ? null : b[k].trim()) : b[k];
  });
  return o;
};
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);
const rep = (code, obj) => ({ statusCode: code, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    const m = event.httpMethod;
    if (m === 'GET') {
      const [c, g, p] = await Promise.all([
        supabase.from('pleiade_categories').select('*').order('ordre'),
        supabase.from('pleiade_gamme_modele').select('*').order('ordre'),
        supabase.from('pleiade_parametres').select('*'),
      ]);
      for (const r of [c, g, p]) if (r.error) throw r.error;
      return rep(200, { categories: c.data, modele: g.data, parametres: p.data });
    }
    const body = JSON.parse(event.body || '{}');
    if (m === 'POST') {
      if (!body.libelle || !String(body.libelle).trim()) return rep(400, { error: 'libelle requis.' });
      const code = body.code ? slug(body.code) : slug(body.libelle);
      if (!code) return rep(400, { error: 'Code invalide.' });
      const { data: existe } = await supabase.from('pleiade_categories').select('code').eq('code', code);
      if (existe && existe.length) return rep(409, { error: `La catégorie « ${code} » existe déjà.` });
      const { error } = await supabase.from('pleiade_categories').insert({ ordre: 500, ...propre(body), code });
      if (error) throw error;
      return rep(200, { code });
    }
    if (m === 'PUT') {
      if (body.parametre) {
        const { error } = await supabase.from('pleiade_parametres').update({ valeur: body.valeur == null ? null : String(body.valeur) }).eq('cle', body.parametre);
        if (error) throw error;
        return rep(200, { ok: true });
      }
      if (!body.code) return rep(400, { error: 'code requis.' });
      const maj = propre(body);
      if (!Object.keys(maj).length) return rep(400, { error: 'Rien à modifier.' });
      if (maj.libelle === null) return rep(400, { error: 'libelle ne peut pas être vide.' });
      const { error } = await supabase.from('pleiade_categories').update(maj).eq('code', body.code);
      if (error) throw error;
      return rep(200, { ok: true });
    }
    if (m === 'DELETE') {
      const q = event.queryStringParameters || {};
      if (!q.code) return rep(400, { error: 'code requis.' });
      const op = q.definitif ? supabase.from('pleiade_categories').delete().eq('code', q.code)
        : supabase.from('pleiade_categories').update({ actif: false }).eq('code', q.code);
      const { error } = await op;
      if (error) throw error;
      return rep(200, { ok: true });
    }
    return rep(405, { error: 'Méthode non autorisée.' });
  } catch (err) {
    return rep(500, { error: err.message });
  }
};
