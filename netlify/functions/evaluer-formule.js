// functions/evaluer-formule.js
//
// POST /.netlify/functions/evaluer-formule
// body : { formule, valeurs?: { variable: valeur } }
//
// Sert à l'aperçu en direct dans l'écran de saisie d'une phase : vérifie la
// formule, liste les caractéristiques qu'elle utilise et, si on fournit des
// valeurs, calcule le résultat (en heures). N'écrit rien.
//
// Réponse :
// { ok, erreur?, variables: [{ cle, libelle, type, unite, connue }],
//   inconnues: [cle], manquantes: [cle], valeur_h: number|null }

const { getSupabase } = require('./lib/supabaseclient');
const { analyser, evaluer } = require('./lib/formules');

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    const { formule, valeurs = {} } = JSON.parse(event.body || '{}');

    const a = analyser(formule);
    if (!a.ok) return { statusCode: 200, body: JSON.stringify({ ok: false, erreur: a.erreur, variables: [], inconnues: [], manquantes: [], valeur_h: null }) };

    const { data: catalogue, error } = await getSupabase().from('caracteristiques_produit').select('cle, libelle, type, unite');
    if (error) throw error;
    const parCle = Object.fromEntries(catalogue.map((c) => [c.cle, c]));

    const variables = a.variables.map((cle) => (cle === 'quantite'
      ? { cle, libelle: 'Quantité (exemplaires)', type: 'nombre', unite: null, connue: true }
      : { cle, libelle: parCle[cle] ? parCle[cle].libelle : cle, type: parCle[cle] ? parCle[cle].type : 'nombre', unite: parCle[cle] ? parCle[cle].unite : null, connue: !!parCle[cle] }));
    const inconnues = variables.filter((v) => !v.connue).map((v) => v.cle);

    let valeurH = null; let manquantes = a.variables.filter((v) => !(v in valeurs) || String(valeurs[v]).trim() === '');
    let erreur = null;
    if (inconnues.length) {
      erreur = `Caractéristique inconnue : ${inconnues.map((x) => `« ${x} »`).join(', ')}. Créez-la dans « Caractéristiques produit ».`;
    } else {
      const types = Object.fromEntries(variables.map((v) => [v.cle, v.type]));
      const r = evaluer(formule, valeurs, types);
      if (!r.ok) erreur = r.erreur; else { valeurH = r.valeur === null ? null : Math.round(r.valeur * 10000) / 10000; manquantes = r.manquantes; }
    }
    return { statusCode: 200, body: JSON.stringify({ ok: !erreur, erreur, variables, inconnues, manquantes, valeur_h: valeurH }) };
  } catch (err) {
    console.error('evaluer-formule error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
