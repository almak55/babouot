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
//   Période : date_fin (optionnelle, incluse) applique le statut à chaque jour de date à date_fin ;
//   fin_inconnue:true l'applique sur 180 jours à partir de date (commentaire « Fin inconnue »,
//   à raccourcir plus tard avec « Réinitialiser » à partir de la date de reprise).
//   motif (optionnel) : texte libre repris dans le commentaire.
//
// DELETE /.netlify/functions/gerer-disponibilite?personnel_id=uuid&date=...
//   -> supprime l'entrée (la personne redevient "disponible" par défaut).
//   date_fin optionnelle : supprime toutes les entrées de date à date_fin incluses.

const { getSupabase } = require('./lib/supabaseclient');

const STATUTS_VALIDES = ['disponible', 'en arrêt', 'absent'];
const JOURS_FIN_INCONNUE = 180;
const JOURS_MAX = 366;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
function ajouteJours(iso, n) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function jours(debut, fin) { const r = []; for (let d = debut; d <= fin; d = ajouteJours(d, 1)) r.push(d); return r; }

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
      const { personnel_id, date, statut, heure_debut, heure_fin, motif, date_fin, fin_inconnue } = body;
      let commentaire = body.commentaire;
      if (!personnel_id || !date || !statut) {
        return { statusCode: 400, body: JSON.stringify({ error: 'personnel_id, date et statut sont requis.' }) };
      }
      if (!STATUTS_VALIDES.includes(statut)) {
        return { statusCode: 400, body: JSON.stringify({ error: `statut invalide. Valeurs acceptées : ${STATUTS_VALIDES.join(', ')}.` }) };
      }
      if ((heure_debut && !heure_fin) || (!heure_debut && heure_fin)) {
        return { statusCode: 400, body: JSON.stringify({ error: 'heure_debut et heure_fin doivent être fournies ensemble.' }) };
      }

      if (!ISO.test(date)) return { statusCode: 400, body: JSON.stringify({ error: 'Date de début invalide.' }) };
      let fin = date;
      if (fin_inconnue) fin = ajouteJours(date, JOURS_FIN_INCONNUE - 1);
      else if (date_fin) {
        if (!ISO.test(date_fin)) return { statusCode: 400, body: JSON.stringify({ error: 'Date de fin invalide.' }) };
        if (date_fin < date) return { statusCode: 400, body: JSON.stringify({ error: 'La date de fin doit être postérieure ou égale à la date de début.' }) };
        fin = date_fin;
      }
      const liste = jours(date, fin);
      if (liste.length > JOURS_MAX) return { statusCode: 400, body: JSON.stringify({ error: `Période trop longue (maximum ${JOURS_MAX} jours). Utilisez « fin inconnue » pour une absence sans date de retour.` }) };
      if (!commentaire) {
        const bouts = [];
        if (motif && String(motif).trim()) bouts.push(String(motif).trim());
        if (fin_inconnue && statut !== 'disponible') bouts.push('fin inconnue');
        commentaire = bouts.join(' - ') || null;
      }
      const lignes = liste.map((d) => ({ personnel_id, date: d, statut, heure_debut: heure_debut || null, heure_fin: heure_fin || null, commentaire: commentaire || null }));
      const { error } = await supabase.from('personnel_planning_jour').upsert(lignes, { onConflict: 'personnel_id,date' });
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ date, date_fin: fin, statut, jours: liste.length, fin_inconnue: !!fin_inconnue }) };
    }

    if (event.httpMethod === 'DELETE') {
      const params = event.queryStringParameters || {};
      const { personnel_id, date, date_fin } = params;
      if (!personnel_id || !date) {
        return { statusCode: 400, body: JSON.stringify({ error: 'personnel_id et date sont requis.' }) };
      }
      let q = supabase.from('personnel_planning_jour').delete().eq('personnel_id', personnel_id);
      q = date_fin ? q.gte('date', date).lte('date', date_fin) : q.eq('date', date);
      const { error } = await q;
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
