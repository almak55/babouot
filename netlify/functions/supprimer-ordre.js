// functions/supprimer-ordre.js
//
// DELETE /.netlify/functions/supprimer-ordre?of_id=uuid
//
// Supprime définitivement un OF et tout ce qui en dépend :
//   - ses étapes de gamme opératoire (cascade automatique)
//   - ses matières déclarées (of_matieres, cascade automatique)
//   - ses affectations au planning (supprimées explicitement ici :
//     planning_jour n'est pas en cascade sur l'OF)
// Les mouvements de stock liés à cet OF sont CONSERVÉS (historique
// comptable des matières) : seul le lien vers l'OF est retiré.
//
// Réponse : { ok: true, numero, affectations_supprimees: number }

const { getSupabase } = require('./lib/supabaseclient');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'DELETE') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser DELETE.' }) };
    }
    const ofId = (event.queryStringParameters || {}).of_id;
    if (!ofId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Paramètre of_id requis.' }) };
    }

    const supabase = getSupabase();

    const { data: of, error: ofError } = await supabase
      .from('ordres_fabrication').select('id, numero').eq('id', ofId).maybeSingle();
    if (ofError) throw ofError;
    if (!of) {
      return { statusCode: 404, body: JSON.stringify({ error: 'OF introuvable (déjà supprimé ?).' }) };
    }

    // 1. Affectations au planning liées à cet OF (par of_id OU via ses étapes de gamme).
    const { data: gammes, error: gammesError } = await supabase
      .from('gammes_operatoires').select('id').eq('of_id', ofId);
    if (gammesError) throw gammesError;
    const gammeIds = gammes.map((g) => g.id);

    let affectationsSupprimees = 0;
    if (gammeIds.length > 0) {
      const { data: supprimees, error: delPlanError } = await supabase
        .from('planning_jour').delete().in('gamme_operatoire_id', gammeIds).select('id');
      if (delPlanError) throw delPlanError;
      affectationsSupprimees += supprimees.length;
    }
    const { data: supprimeesParOf, error: delPlanOfError } = await supabase
      .from('planning_jour').delete().eq('of_id', ofId).select('id');
    if (delPlanOfError) throw delPlanOfError;
    affectationsSupprimees += supprimeesParOf.length;

    // 2. Conserver l'historique des mouvements de stock, en retirant juste le lien vers l'OF.
    const { error: mvtError } = await supabase
      .from('mouvements_stock').update({ of_id: null }).eq('of_id', ofId);
    if (mvtError) throw mvtError;

    // 3. Suppression de l'OF (gammes_operatoires et of_matieres partent en cascade).
    const { error: delOfError } = await supabase
      .from('ordres_fabrication').delete().eq('id', ofId);
    if (delOfError) throw delOfError;

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, numero: of.numero, affectations_supprimees: affectationsSupprimees }),
    };
  } catch (err) {
    console.error('supprimer-ordre error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
