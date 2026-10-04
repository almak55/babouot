// functions/deplanifier-etape.js
//
// POST /.netlify/functions/deplanifier-etape
// body : { gamme_ids: ["uuid", ...] }   étapes précises à déplanifier
//     ou { of_id: "uuid" }              toutes les étapes planifiées de cet OF
//
// Défait la planification : supprime les lignes de planning des étapes
// concernées (et leurs affectations de personnel) et remet les étapes à
// « à planifier ». Elles peuvent alors être replanifiées à la main
// (« Affecter au planning ») ou automatiquement (« Planifier à l'heure »).
//
// Seules les étapes « planifié » sont déplanifiées. Une étape déjà démarrée
// (« en cours ») ou terminée est conservée : son historique ne doit pas
// disparaître. L'opération peut être relancée sans risque en cas d'incident
// (rien n'est fait deux fois).
//
// Réponse : { deplanifiees: [{ gamme_id, sequence }], lignes_supprimees: n,
//             conservees: [{ gamme_id, sequence, raison }] }

const { getSupabase } = require('./lib/supabaseclient');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    }
    const { gamme_ids, of_id } = JSON.parse(event.body || '{}');
    const ids = Array.isArray(gamme_ids) ? gamme_ids.filter(Boolean) : [];
    if (ids.length === 0 && !of_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'gamme_ids ou of_id requis.' }) };
    }

    const supabase = getSupabase();
    let requete = supabase.from('gammes_operatoires').select('id, sequence, statut, of_id');
    requete = ids.length ? requete.in('id', ids) : requete.eq('of_id', of_id);
    const { data: gammes, error: gammesError } = await requete;
    if (gammesError) throw gammesError;
    if (gammes.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Aucune étape trouvée.' }) };
    }

    const aDeplanifier = gammes.filter((g) => g.statut === 'planifié');
    const conservees = gammes
      .filter((g) => g.statut === 'en cours' || g.statut === 'terminé')
      .map((g) => ({ gamme_id: g.id, sequence: g.sequence, raison: g.statut === 'terminé' ? 'étape terminée : conservée' : 'étape en cours : conservée' }));

    if (aDeplanifier.length === 0 && conservees.length > 0) {
      return {
        statusCode: 409,
        body: JSON.stringify({ error: `Impossible : ${conservees.map((c) => `étape ${c.sequence} (${c.raison})`).join(', ')}.`, conservees }),
      };
    }

    let lignesSupprimees = 0;
    if (aDeplanifier.length > 0) {
      const idsAFaire = aDeplanifier.map((g) => g.id);
      // 1) les lignes de planning (les affectations de personnel suivent : suppression en cascade)
      const { data: supprimees, error: delError } = await supabase
        .from('planning_jour').delete().in('gamme_operatoire_id', idsAFaire).select('id');
      if (delError) throw delError;
      lignesSupprimees = supprimees ? supprimees.length : 0;
      // 2) puis le statut. Si cette étape échoue, relancer l'opération termine le travail.
      const { error: majError } = await supabase
        .from('gammes_operatoires').update({ statut: 'à planifier' }).in('id', idsAFaire);
      if (majError) throw majError;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        deplanifiees: aDeplanifier.map((g) => ({ gamme_id: g.id, sequence: g.sequence })),
        lignes_supprimees: lignesSupprimees,
        conservees,
      }),
    };
  } catch (err) {
    console.error('deplanifier-etape error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
