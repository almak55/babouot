// functions/alertes-stock.js
//
// GET /.netlify/functions/alertes-stock
//
// Retourne les matières dont la quantité est passée sous le seuil
// d'alerte défini. Le statut distingue :
//   'critique'  : quantité <= 50% du seuil
//   'attention' : quantité <= seuil (mais > 50%)
//
// Réponse : [ { id, nom, quantite, unite, seuil_alerte, statut } ]

const { getSupabase } = require('./lib/supabaseclient');

const handlerProtege = async () => {
  try {
    const supabase = getSupabase();

    const { data: stocks, error } = await supabase
      .from('stocks')
      .select('id, nom, unite, quantite, seuil_alerte');
    if (error) throw error;

    const alertes = stocks
      .filter((s) => s.quantite <= s.seuil_alerte)
      .map((s) => ({
        ...s,
        statut: s.quantite <= s.seuil_alerte * 0.5 ? 'critique' : 'attention',
      }))
      .sort((a, b) => (a.quantite / a.seuil_alerte) - (b.quantite / b.seuil_alerte));

    return { statusCode: 200, body: JSON.stringify(alertes) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
