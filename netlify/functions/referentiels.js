// functions/referentiels.js
//
// GET /.netlify/functions/referentiels
//
// Données de référence nécessaires pour construire des formulaires
// de saisie (listes déroulantes) — plus léger que lecture-planning
// qui charge aussi le planning d'une période.
//
// Réponse :
// { operations: [...], machines: [...], personnel: [...], titres: [...] }

const { getSupabase } = require('./lib/supabaseclient');

exports.handler = async () => {
  try {
    const supabase = getSupabase();

    const [operationsRes, machinesRes, personnelRes, titresRes] = await Promise.all([
      supabase.from('operations').select('id, code, nom, famille').order('ordre_defaut'),
      supabase.from('machines').select('id, code, nom, operation_id').eq('actif', true).order('code'),
      supabase.from('personnel').select('id, nom, poste, role_type').eq('actif', true).order('nom'),
      supabase.from('titres').select('id, nom, client, reference').order('nom'),
    ]);

    for (const r of [operationsRes, machinesRes, personnelRes, titresRes]) {
      if (r.error) throw r.error;
    }
    // Types de production (Pléiade, Cartonné…) : absents tant que la migration 23 n'est pas exécutée.
    const typesRes = await supabase.from('types_production').select('code, libelle').order('ordre');

    return {
      statusCode: 200,
      body: JSON.stringify({
        operations: operationsRes.data,
        machines: machinesRes.data,
        personnel: personnelRes.data,
        titres: titresRes.data,
        types_production: typesRes.error ? [] : typesRes.data,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
