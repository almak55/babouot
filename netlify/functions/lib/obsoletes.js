// lib/obsoletes.js
//
// Créneaux « fantômes » : une étape déjà terminée ne doit plus laisser de créneaux planifiés
// aujourd'hui ou plus tard (la personne et la machine seraient affichées occupées pour rien).
// Un créneau d'aujourd'hui est conservé si de la production a été saisie ce jour-là sur l'étape
// (elle a bien été travaillée aujourd'hui avant d'être terminée).
// Les jours passés ne sont jamais touchés : c'est l'historique de ce qui s'est déroulé.

const { aujourdhuiParis } = require('./debut-etape');

async function creneauxObsoletes(supabase, aujourdhui) {
  const jour = aujourdhui || aujourdhuiParis();
  const { data: lignes, error } = await supabase.from('planning_jour')
    .select('id, date, statut, gamme_operatoire_id')
    .gte('date', jour).neq('statut', 'annulé').neq('statut', 'terminé');
  if (error) throw error;
  const avecGamme = lignes.filter((l) => l.gamme_operatoire_id);
  if (!avecGamme.length) return [];
  const ids = Array.from(new Set(avecGamme.map((l) => l.gamme_operatoire_id)));
  const [gamRes, prodRes] = await Promise.all([
    supabase.from('gammes_operatoires').select('id, statut').in('id', ids),
    supabase.from('production_jour').select('gamme_operatoire_id, date').in('gamme_operatoire_id', ids).gte('date', jour),
  ]);
  if (gamRes.error) throw gamRes.error;
  if (prodRes.error) throw prodRes.error;
  const terminees = new Set(gamRes.data.filter((g) => g.statut === 'terminé').map((g) => g.id));
  const travaille = new Set(prodRes.data.map((p) => `${p.gamme_operatoire_id}|${p.date}`));
  return avecGamme.filter((l) => terminees.has(l.gamme_operatoire_id) && !travaille.has(`${l.gamme_operatoire_id}|${l.date}`));
}

// Supprime ces créneaux (les liens personnel disparaissent en cascade). Ne lève jamais d'erreur :
// c'est un nettoyage, il ne doit pas empêcher d'afficher le planning.
async function purgerObsoletes(supabase, aujourdhui) {
  try {
    const liste = await creneauxObsoletes(supabase, aujourdhui);
    if (!liste.length) return 0;
    const { error } = await supabase.from('planning_jour').delete().in('id', liste.map((l) => l.id));
    if (error) throw error;
    return liste.length;
  } catch (e) {
    console.warn('purge créneaux obsolètes :', e.message);
    return 0;
  }
}

module.exports = { creneauxObsoletes, purgerObsoletes };
