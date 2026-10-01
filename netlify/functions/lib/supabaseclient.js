// lib/supabaseClient.js
// Client Supabase partagé par toutes les fonctions.
// Variables d'environnement attendues côté Netlify :
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  (clé service_role — jamais exposée au front)

const { createClient } = require('@supabase/supabase-js');

let client = null;

function getSupabase() {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans les variables d\'environnement.');
    }
    client = createClient(url, key);
  }
  return client;
}

module.exports = { getSupabase };
