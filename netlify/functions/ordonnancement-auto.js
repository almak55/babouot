// functions/ordonnancement-auto.js
//
// Fonction planifiée (scheduled function) : relance automatiquement
// la logique d'ordonnancement chaque matin avant l'ouverture de
// l'atelier. Netlify l'appelle seul, sans requête HTTP du front.
//
// Déclaration requise dans netlify.toml (voir fichier fourni) :
//   [[functions]]
//     name = "ordonnancement-auto"
//     schedule = "0 5 * * 1-5"   # 5h00 UTC = 7h00 Paris (heure d'été),
//                                 # du lundi au vendredi
//
// La logique elle-même reste dans ordonnancement.js : cette fonction
// l'appelle en interne pour éviter de dupliquer le code.

const { handler: ordonnancementHandler } = require('./ordonnancement');

exports.handler = async () => {
  const fauxEvent = {
    body: JSON.stringify({
      date_debut: new Date().toISOString().slice(0, 10),
      horizon_jours: 14,
    }),
  };
  const resultat = await ordonnancementHandler(fauxEvent);
  // Les fonctions planifiées n'ont pas besoin de retourner une réponse
  // HTTP à un client, mais la conserver facilite le suivi dans les
  // logs Netlify.
  console.log('Ordonnancement automatique exécuté :', resultat.body);
  return resultat;
};
