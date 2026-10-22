// lib/auth.js
//
// Protection des fonctions Netlify : exige une connexion Supabase Auth valide
// (en-tête « Authorization: Bearer <jeton> »). Les appels internes d'une fonction à une autre
// (événement fabriqué sans en-têtes) passent sans contrôle ; les appels HTTP réels en ont toujours.
//
// Variable Netlify AUTH_DESACTIVEE=1 : coupe la protection (dépannage uniquement).

const { getSupabase } = require('./supabaseclient');

const refus = (message) => ({
  statusCode: 401,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: message, code: 'auth' }),
});

function avecAuth(handler) {
  return async (event, context) => {
    if (!event || !event.headers || process.env.AUTH_DESACTIVEE === '1') return handler(event, context);
    const entete = event.headers.authorization || event.headers.Authorization || '';
    const jeton = String(entete).replace(/^Bearer\s+/i, '').trim();
    if (!jeton) return refus('Connexion requise.');
    try {
      const { data, error } = await getSupabase().auth.getUser(jeton);
      if (error || !data || !data.user) return refus('Session expirée : reconnectez-vous.');
    } catch (e) {
      return refus('Vérification de la connexion impossible.');
    }
    return handler(event, context);
  };
}

module.exports = { avecAuth };
