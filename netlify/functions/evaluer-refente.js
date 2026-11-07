// functions/evaluer-refente.js
//
// POST /.netlify/functions/evaluer-refente
// body : { composition, quantite, feuilles_par_pile? }
//   composition : [{ pages, cahiers, poses, disposition?, parage? }] (ou son texte JSON)
//
// Aperçu en direct de la refente au massicot droit dans l'écran de chiffrage : feuilles, piles
// (500 feuilles au maximum), coups de couteau pour chaque pagination de cahier. N'écrit rien.
// Réponse : { ok, erreurs, lignes: [...], total: { feuilles, piles, coups, morceaux }, pile_max, cahiers_par_exemplaire }

const { calculer } = require('./lib/refente');

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    const b = JSON.parse(event.body || '{}');
    const r = calculer(b.composition, b.quantite, b.feuilles_par_pile);
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
