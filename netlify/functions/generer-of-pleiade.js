// functions/generer-of-pleiade.js
//
// Génération automatique d'un OF « Pléiade » à partir de la catégorie du volume.
//
// POST /.netlify/functions/generer-of-pleiade
// body :
// {
//   action: 'apercu' | 'creer',            // défaut : 'apercu' (rien n'est écrit)
//   categorie: 'XXE',                       // code d'une ligne de pleiade_categories
//   titre: "Œuvres complètes", auteur: "Camus",
//   quantite: 3000, delai: "2026-12-10",
//   date_reception?: "2026-10-30",          // réception du papier / des cahiers
//   date_reception_peaux?: "2026-11-05",
//   nb_pages?, nb_cahiers?,
//   simple?: bool,        // Pléiade simple -> étape Refente
//   coffret?: bool,       // volumes en coffret -> pose des jaquettes
//   rhodoides?: bool, etuis?: bool,
//   priorite?: 'normale'|'haute'|'urgente'
//   etapes?: [codes d'étapes du modèle à retenir]  (choix explicite ; sinon étapes déduites des variantes)
// }
//
// Réponse : { valeurs (fiche préremplie), gamme (étapes ordonnées avec dépendances),
//             avertissements, [of_id, numero] si action = 'creer' }

const { getSupabase } = require('./lib/supabaseclient');
const P = require('./lib/pleiade');
const creerOrdre = require('./creer-ordre');

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    }
    const opts = JSON.parse(event.body || '{}');
    const action = opts.action === 'creer' ? 'creer' : 'apercu';
    if (!opts.categorie) return { statusCode: 400, body: JSON.stringify({ error: 'categorie requise.' }) };

    const supabase = getSupabase();
    const ref = await P.chargerReferentiel(supabase);
    const valeurs = P.valeursFiche(ref, opts);
    const gamme = P.construireGamme(ref, opts, valeurs.pave);

    // Opérations inconnues ou sans temps standard : prévenir (planification « non chiffrée »).
    const avertissements = [];
    const codes = gamme.map((g) => g.operation_code);
    const { data: ops, error: opsErr } = await supabase.from('operations').select('id, code').in('code', codes);
    if (opsErr) throw opsErr;
    const connus = new Set(ops.map((o) => o.code));
    const manquantes = codes.filter((c) => !connus.has(c));
    if (manquantes.length) {
      return { statusCode: 400, body: JSON.stringify({ error: `Opération(s) absente(s) de la base : ${manquantes.join(', ')}. Exécutez la migration 28.` }) };
    }
    const { data: phases } = await supabase.from('phases_standard').select('operation_id');
    const avecTemps = new Set((phases || []).map((p) => p.operation_id));
    ops.filter((o) => !avecTemps.has(o.id)).forEach((o) => {
      const g = gamme.find((x) => x.operation_code === o.code);
      avertissements.push(`« ${g.libelle} » n'a pas encore de temps standard : la planification sera « non chiffrée » tant qu'il n'est pas saisi.`);
    });
    if (!valeurs.couleur_tete && valeurs.categorie !== 'ALBUM') avertissements.push('Couleur de tête non définie pour cette catégorie.');
    if (valeurs.categorie === 'ALBUM') avertissements.push('Album : tranchefile et signets « à définir » dans le tableau de référence.');

    const reponse = { valeurs, gamme, avertissements, etapes_possibles: P.etapesPossibles(ref, opts, valeurs.pave) };
    if (action === 'apercu') return { statusCode: 200, body: JSON.stringify(reponse) };

    if (!opts.titre || !opts.quantite) {
      return { statusCode: 400, body: JSON.stringify({ error: 'titre et quantite requis pour créer l\'OF.' }) };
    }

    // Création de l'OF via creer-ordre (numérotation, caractéristiques, dates), puis dépendances.
    const res = await creerOrdre.handler({
      httpMethod: 'POST',
      body: JSON.stringify({
        titre: {
          nom: opts.titre, client: valeurs.client, reference: opts.reference || null,
          format: valeurs.format_bloc || null,
        },
        quantite: Number(opts.quantite),
        delai: opts.delai || null,
        priorite: opts.priorite || 'normale',
        date_reception: opts.date_reception || null,
        rang_priorite: opts.rang_priorite || null,
        type_production: 'pleiade',
        caracteristiques: P.caracteristiquesOf(valeurs, opts),
        operations: codes,
      }),
    });
    const corps = JSON.parse(res.body);
    if (res.statusCode !== 200) return res;

    const lignes = corps.gammes_operatoires;
    const idOp = Object.fromEntries(ops.map((o) => [o.id, o.code]));
    for (const g of gamme) {
      const ligne = lignes.find((l) => l.sequence === g.sequence);
      const { error } = await supabase.from('gammes_operatoires')
        .update({ predecesseurs: g.predecesseurs, dependances: g.dependances }).eq('id', ligne.id);
      if (error) throw error;
    }
    return { statusCode: 200, body: JSON.stringify({ ...reponse, of_id: corps.of_id, numero: corps.numero }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
