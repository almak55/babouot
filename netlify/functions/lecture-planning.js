// functions/lecture-planning.js
//
// GET /.netlify/functions/lecture-planning?date_debut=2026-09-21&date_fin=2026-09-27
//
// Un seul appel consolidé plutôt que 5 appels séparés (machines,
// personnel, ordres, stocks, planning) : le front n'a besoin que
// d'une requête pour construire l'écran de planification.
//
// Réponse :
// {
//   machines: [...],
//   personnel: [...],
//   ordres: [...],
//   stocks: [...],
//   planning: [...]   // créneaux planning_jour de la période demandée
// }

const { getSupabase } = require('./lib/supabaseClient');

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const dateDebut = params.date_debut;
    const dateFin = params.date_fin;
    if (!dateDebut || !dateFin) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Paramètres date_debut et date_fin requis.' }),
      };
    }

    const supabase = getSupabase();

    const [machinesRes, personnelRes, ordresRes, stocksRes, planningRes] = await Promise.all([
      supabase.from('machines').select('id, code, nom').eq('actif', true).order('code'),
      supabase.from('personnel').select('id, nom, poste, role_type').eq('actif', true).order('nom'),
      supabase.from('ordres_fabrication')
        .select('id, numero, quantite, delai, priorite, statut, titres(nom, client)')
        .in('statut', ['planifié', 'en cours', 'en pause']),
      supabase.from('stocks').select('id, nom, unite, quantite, seuil_alerte'),
      supabase.from('planning_jour')
        .select('id, date, machine_id, personnel_id, of_id, operation_id, statut')
        .gte('date', dateDebut).lte('date', dateFin),
    ]);

    for (const r of [machinesRes, personnelRes, ordresRes, stocksRes, planningRes]) {
      if (r.error) throw r.error;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        machines: machinesRes.data,
        personnel: personnelRes.data,
        ordres: ordresRes.data,
        stocks: stocksRes.data,
        planning: planningRes.data,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
