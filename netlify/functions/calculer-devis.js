// functions/calculer-devis.js
//
// POST /.netlify/functions/calculer-devis
// body : { of_id }                   -> devis de départ calculé d'après le chiffrage de l'OF
//        { saisie: {...} }           -> simple recalcul des totaux (sans accès base) après modification
//
// saisie : { parametres?, mo:[{id,operation,heures,cout_horaire}], machine:[...], matieres:[{nom,unite,quantite,prix_unitaire}],
//            autres:[{libelle,cout,vente}], remise_pct, quantite }
// Rien n'est écrit en base (voir gerer-devis pour l'enregistrement).

const { getSupabase } = require('./lib/supabaseclient');
const { construireBase, totaliser } = require('./lib/devis');

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    const body = JSON.parse(event.body || '{}');
    if (body.saisie) return { statusCode: 200, body: JSON.stringify({ resultat: totaliser(body.saisie) }) };
    if (!body.of_id) return { statusCode: 400, body: JSON.stringify({ error: 'of_id requis.' }) };

    const base = await construireBase(getSupabase(), body.of_id);
    if (!base) return { statusCode: 404, body: JSON.stringify({ error: 'OF introuvable.' }) };
    const saisie = {
      parametres: base.parametres, mo: base.mo, machine: base.machine,
      matieres: [], autres: [], remise_pct: 0, quantite: base.of.quantite,
    };
    return { statusCode: 200, body: JSON.stringify({ of: base.of, matieres_disponibles: base.matieres_disponibles, avertissements: base.avertissements, saisie, resultat: totaliser(saisie) }) };
  } catch (e) {
    console.error('calculer-devis error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || String(e) }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
