// functions/jour-debut-etape.js
//
// GET /.netlify/functions/jour-debut-etape?gamme_id=uuid[&aujourdhui=AAAA-MM-JJ]
//
// Jour de début automatique d'une étape, déduit de ses dépendances (voir lib/debut-etape.js).
// Réponse : { date, libelle, raison, bloques: ["Pliure", ...] }
//   bloques : opérations dont dépend l'étape et qui ne sont pas encore planifiées.

const { getSupabase } = require('./lib/supabaseclient');
const { jourDebutSuggere, aujourdhuiParis } = require('./lib/debut-etape');

const handlerProtege = async (event) => {
  try {
    const q = event.queryStringParameters || {};
    if (!q.gamme_id) return { statusCode: 400, body: JSON.stringify({ error: 'gamme_id requis.' }) };
    const auj = /^\d{4}-\d{2}-\d{2}$/.test(q.aujourdhui || '') ? q.aujourdhui : aujourdhuiParis();
    const r = await jourDebutSuggere(getSupabase(), q.gamme_id, auj);
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
