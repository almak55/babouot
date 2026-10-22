// functions/gerer-disponibilite.js
//
// GET /.netlify/functions/gerer-disponibilite?personnel_id=uuid&date_debut=...&date_fin=...
//   -> liste des entrées de disponibilité déclarées sur la période
//      (les jours sans entrée sont implicitement "disponible").
//
// POST /.netlify/functions/gerer-disponibilite
//   body : { personnel_id, date, statut, heure_debut?, heure_fin? }
//   statut : 'disponible' | 'en arrêt' | 'absent'
//   heure_debut/heure_fin (format "HH:MM", optionnels) : à ne fournir
//   que pour une disponibilité partielle ("disponible de x à y").
//   -> crée ou remplace l'entrée du jour pour cette personne.
//
// DELETE /.netlify/functions/gerer-disponibilite?personnel_id=uuid&date=...
//   -> supprime l'entrée (la personne redevient "disponible" par défaut).

const { getSupabase } = require('./lib/supabaseclient');

const STATUTS_VALIDES = ['disponible', 'en arrêt', 'absent'];

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();

    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      const { personnel_id, date_debut, date_fin } = params;
      if (!personnel_id || !date_debut || !date_fin) {
        return { statusCode: 400, body: JSON.stringify({ error: 'personnel_id, date_debut et date_fin sont requis.' }) };
      }
      const { data, error } = await supabase
        .from('personnel_planning_jour')
        .select('date, statut, heure_debut, heure_fin, commentaire')
        .eq('personnel_id', personnel_id)
        .gte('date', date_debut).lte('date', date_fin)
        .order('date');
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { personnel_id, date, statut, heure_debut, heure_fin, commentaire } = body;
      if (!personnel_id || !date || !statut) {
        return { statusCode: 400, body: JSON.stringify({ error: 'personnel_id, date et statut sont requis.' }) };
      }
      if (!STATUTS_VALIDES.includes(statut)) {
        return { statusCode: 400, body: JSON.stringify({ error: `statut invalide. Valeurs acceptées : ${STATUTS_VALIDES.join(', ')}.` }) };
      }
      if ((heure_debut && !heure_fin) || (!heure_debut && heure_fin)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'heure_debut et heure_fin doivent être fournies ensemble.' }) };
      }

      const { data, error } = await supabase
        .from('personnel_planning_jour')
        .upsert(
          { personnel_id, date, statut, heure_debut: heure_debut || null, heure_fin: heure_fin || null, commentaire: commentaire || null },
          { onConflict: 'personnel_id,date' }
        )
        .select('date, statut, heure_debut, heure_fin')
        .single();
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'DELETE') {
      const params = event.queryStringParameters || {};
      const { personnel_id, date } = params;
      if (!personnel_id || !date) {
        return { statusCode: 400, body: JSON.stringify({ error: 'personnel_id et date sont requis.' }) };
      }
      const { error } = await supabase
        .from('personnel_planning_jour').delete()
        .eq('personnel_id', personnel_id).eq('date', date);
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
  } catch (err) {
    console.error('gerer-disponibilite error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
