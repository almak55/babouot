// functions/connexion.js
//
// Connexion à l'application (Supabase Auth, e-mail + mot de passe). Seule fonction publique.
//
// POST { email, mot_de_passe }       -> { access_token, refresh_token, expires_at, email }
// POST { refresh_token }             -> renouvelle la session
//
// Les comptes sont créés dans Supabase (Authentication > Users > Add user) ; l'inscription libre doit être
// désactivée (Authentication > Sign In / Providers > Email > « Allow new users to sign up » décoché).
// Variables Netlify : SUPABASE_URL et SUPABASE_ANON_KEY (clé « anon / publishable », différente de la clé service).

const { createClient } = require('@supabase/supabase-js');

const rep = (code, o) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return rep(405, { error: 'Méthode non autorisée.' });
    const url = process.env.SUPABASE_URL, cle = process.env.SUPABASE_ANON_KEY;
    if (!url || !cle) return rep(500, { error: 'SUPABASE_ANON_KEY manquante dans les variables Netlify.' });
    const b = JSON.parse(event.body || '{}');
    const sb = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
    let res;
    if (b.refresh_token) res = await sb.auth.refreshSession({ refresh_token: b.refresh_token });
    else if (b.email && b.mot_de_passe) res = await sb.auth.signInWithPassword({ email: String(b.email).trim(), password: String(b.mot_de_passe) });
    else return rep(400, { error: 'E-mail et mot de passe requis.' });
    const s = res.data && res.data.session;
    if (res.error || !s) return rep(401, { error: b.refresh_token ? 'Session expirée.' : 'E-mail ou mot de passe incorrect.' });
    return rep(200, { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, email: s.user && s.user.email });
  } catch (err) {
    return rep(500, { error: err.message });
  }
};
