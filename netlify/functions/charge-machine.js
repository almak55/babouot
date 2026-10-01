// functions/charge-machine.js
//
// GET /.netlify/functions/charge-machine?date_debut=2026-09-21&date_fin=2026-09-27
//
// Calcule, pour chaque machine, le nombre de créneaux occupés sur la
// période demandée rapporté au nombre de créneaux théoriquement
// disponibles (1 créneau = 1 jour ouvré pour une machine, cohérent
// avec la granularité "jour" du planning papier actuel).
//
// Réponse :
// [
//   { machine_id, code, nom, creneaux_occupes, creneaux_disponibles, charge_pct }
// ]

const { getSupabase } = require('./lib/supabaseclient');

exports.handler = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const dateDebut = params.date_debut;
    const dateFin = params.date_fin;

    if (!dateDebut || !dateFin) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Paramètres date_debut et date_fin requis (format YYYY-MM-DD).' }),
      };
    }

    const supabase = getSupabase();

    const { data: machines, error: machinesError } = await supabase
      .from('machines')
      .select('id, code, nom')
      .eq('actif', true);
    if (machinesError) throw machinesError;

    const { data: creneaux, error: creneauxError } = await supabase
      .from('planning_jour')
      .select('machine_id, date, statut')
      .gte('date', dateDebut)
      .lte('date', dateFin);
    if (creneauxError) throw creneauxError;

    // Nombre de jours ouvrés dans la période (on exclut samedi/dimanche
    // par défaut — à ajuster si l'atelier tourne le week-end).
    const joursOuvres = countJoursOuvres(dateDebut, dateFin);

    const resultat = machines.map((m) => {
      const occupes = creneaux.filter(
        (c) => c.machine_id === m.id && c.statut !== 'annulé'
      ).length;
      const chargePct = joursOuvres > 0
        ? Math.round((occupes / joursOuvres) * 100)
        : 0;
      return {
        machine_id: m.id,
        code: m.code,
        nom: m.nom,
        creneaux_occupes: occupes,
        creneaux_disponibles: joursOuvres,
        charge_pct: chargePct,
      };
    });

    return { statusCode: 200, body: JSON.stringify(resultat) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

function countJoursOuvres(dateDebut, dateFin) {
  let count = 0;
  const d = new Date(dateDebut + 'T00:00:00Z');
  const fin = new Date(dateFin + 'T00:00:00Z');
  while (d <= fin) {
    const jour = d.getUTCDay(); // 0 = dimanche, 6 = samedi
    if (jour !== 0 && jour !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}
