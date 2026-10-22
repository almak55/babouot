// functions/gerer-devis.js
//
// GET    ?of_id=...  -> devis enregistrés pour cet OF        GET ?id=...  -> un devis        GET -> les 50 derniers
// POST   { id?, of_id?, client, titre, quantite, statut?, notes?, saisie }  -> crée (numéro DEV-AAAA-NNNN) ou met à jour
// DELETE ?id=...

const { getSupabase } = require('./lib/supabaseclient');
const { totaliser } = require('./lib/devis');

const STATUTS = ['brouillon', 'envoyé', 'accepté', 'refusé'];

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();
    const p = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
      if (p.id) {
        const { data, error } = await supabase.from('devis').select('*').eq('id', p.id).maybeSingle();
        if (error) throw error;
        if (!data) return { statusCode: 404, body: JSON.stringify({ error: 'Devis introuvable.' }) };
        return { statusCode: 200, body: JSON.stringify(data) };
      }
      let q = supabase.from('devis').select('id, numero, of_id, client, titre, quantite, statut, total_ht, created_at, updated_at').order('created_at', { ascending: false }).limit(50);
      if (p.of_id) q = q.eq('of_id', p.of_id);
      const { data, error } = await q;
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ devis: data }) };
    }

    if (event.httpMethod === 'DELETE') {
      if (!p.id) return { statusCode: 400, body: JSON.stringify({ error: 'id requis.' }) };
      const { error } = await supabase.from('devis').delete().eq('id', p.id);
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ supprime: true }) };
    }

    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
    const b = JSON.parse(event.body || '{}');
    if (!b.saisie) return { statusCode: 400, body: JSON.stringify({ error: 'saisie requise.' }) };
    if (b.statut && !STATUTS.includes(b.statut)) return { statusCode: 400, body: JSON.stringify({ error: `Statut invalide (${STATUTS.join(', ')}).` }) };
    const resultat = totaliser(b.saisie);
    const ligne = {
      of_id: b.of_id || null, client: b.client || null, titre: b.titre || null, quantite: Number(resultat.quantite) || null,
      contenu: resultat, total_ht: resultat.totaux.ht, notes: b.notes || null, updated_at: new Date().toISOString(),
    };
    if (b.statut) ligne.statut = b.statut;

    if (b.id) {
      const { error } = await supabase.from('devis').update(ligne).eq('id', b.id);
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ id: b.id, resultat }) };
    }
    const annee = new Date().getFullYear();
    const { data: existants, error: nErr } = await supabase.from('devis').select('numero').like('numero', `DEV-${annee}-%`);
    if (nErr) throw nErr;
    const suivant = existants.reduce((m, d) => Math.max(m, Number(String(d.numero).split('-')[2]) || 0), 0) + 1;
    const numero = `DEV-${annee}-${String(suivant).padStart(4, '0')}`;
    const { data, error } = await supabase.from('devis').insert({ ...ligne, numero }).select('id, numero').single();
    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ id: data.id, numero: data.numero, resultat }) };
  } catch (e) {
    console.error('gerer-devis error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || String(e) }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
