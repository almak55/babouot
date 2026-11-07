// functions/evaluer-refente.js
//
// POST /.netlify/functions/evaluer-refente
// body : { composition, quantite, valeurs?: { passe_pct, feuilles_par_pile, rognage_cahier_mm, marge_feuille_mm, format_fini_l_mm, format_fini_h_mm,
//           refente_cadence_h, refente_manutention_s, refente_mise_en_route_min } }  (valeurs vides = valeurs par défaut)
//   composition : [{ pages, cahiers, feuille?, poses?, disposition?, parage? }] (ou son texte JSON)
//
// Aperçu en direct de la refente au massicot droit dans l'écran de chiffrage : feuilles, piles
// (500 feuilles au maximum), coups de couteau, poses calculées d'après le format de la feuille et le format fini,
// et temps de coupe pour chaque pagination de cahier. N'écrit rien.
// Réponse : voir lib/refente.js (calculer) : { ok, erreurs, lignes, total, temps, quantite_par_cahier, reglages, … }

const { calculer, reglagesDepuis } = require('./lib/refente');

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    const b = JSON.parse(event.body || '{}');
    const valeurs = { ...(b.valeurs || {}) };
    if (b.feuilles_par_pile !== undefined && valeurs.feuilles_par_pile === undefined) valeurs.feuilles_par_pile = b.feuilles_par_pile;
    const r = calculer(b.composition, b.quantite, reglagesDepuis((cle) => valeurs[cle]));
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
