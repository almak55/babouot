// functions/connexion.js
//
// Connexion à l'application (Supabase Auth, e-mail + mot de passe). Seule fonction publique.
//
// POST { email, mot_de_passe }       -> { access_token, refresh_token, expires_at, email }
// POST { refresh_token }             -> renouvelle la session
// POST { action:'lire_profil' }      (Bearer)  -> { email, profil:{prenom,nom,fonction,service,telephone} }
// POST { action:'maj_profil', profil:{...} } (Bearer) -> enregistre le profil (stocké dans les métadonnées du compte Supabase)
// POST { action:'changer_mot_de_passe', mot_de_passe_actuel, nouveau_mot_de_passe }  (en-tête Authorization: Bearer <jeton>)
//                                    -> change le mot de passe de l'utilisateur connecté et renvoie une nouvelle session
//
// Les comptes sont créés dans Supabase (Authentication > Users > Add user) ; l'inscription libre doit être
// désactivée (Authentication > Sign In / Providers > Email > « Allow new users to sign up » décoché).
// Variables Netlify : SUPABASE_URL et SUPABASE_ANON_KEY (clé « anon / publishable », différente de la clé service).

const { createClient } = require('@supabase/supabase-js');

const CHAMPS_PROFIL = ['prenom', 'nom', 'fonction', 'service', 'telephone'];
const profilDe = (user) => {
  const m = (user && user.user_metadata) || {};
  const p = {};
  CHAMPS_PROFIL.forEach((c) => { p[c] = typeof m[c] === 'string' ? m[c] : ''; });
  return p;
};
const rep = (code, o) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return rep(405, { error: 'Méthode non autorisée.' });
    const url = process.env.SUPABASE_URL, cle = process.env.SUPABASE_ANON_KEY;
    if (!url || !cle) return rep(500, { error: 'SUPABASE_ANON_KEY manquante dans les variables Netlify.' });
    const b = JSON.parse(event.body || '{}');
    const sb = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
    if (b.action === 'lire_profil' || b.action === 'maj_profil') {
      const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
      const jeton = String(h).replace(/^Bearer\s+/i, '').trim();
      if (!jeton) return rep(401, { error: 'Connexion requise.' });
      const u = await sb.auth.getUser(jeton);
      const user = u.data && u.data.user;
      if (u.error || !user) return rep(401, { error: 'Session expirée : reconnectez-vous.' });
      if (b.action === 'lire_profil') return rep(200, { email: user.email, profil: profilDe(user) });
      const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!cleService) return rep(500, { error: 'SUPABASE_SERVICE_ROLE_KEY manquante.' });
      const entree = b.profil || {};
      const meta = { ...(user.user_metadata || {}) };
      CHAMPS_PROFIL.forEach((c) => { if (entree[c] !== undefined) meta[c] = String(entree[c]).trim().slice(0, 80); });
      if (!meta.prenom) return rep(400, { error: 'Le prénom est obligatoire.' });
      const admin = createClient(url, cleService, { auth: { persistSession: false, autoRefreshToken: false } });
      const maj = await admin.auth.admin.updateUserById(user.id, { user_metadata: meta });
      if (maj.error) return rep(400, { error: maj.error.message });
      return rep(200, { ok: true, email: user.email, profil: profilDe({ user_metadata: meta }) });
    }
    if (b.action === 'changer_mot_de_passe') {
      const cleService = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!cleService) return rep(500, { error: 'SUPABASE_SERVICE_ROLE_KEY manquante.' });
      const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
      const jeton = String(h).replace(/^Bearer\s+/i, '').trim();
      if (!jeton) return rep(401, { error: 'Connexion requise.' });
      const actuel = String(b.mot_de_passe_actuel || ''), nouveau = String(b.nouveau_mot_de_passe || '');
      if (nouveau.length < 8) return rep(400, { error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
      if (nouveau === actuel) return rep(400, { error: 'Le nouveau mot de passe doit être différent de l\'actuel.' });
      const u = await sb.auth.getUser(jeton);
      const user = u.data && u.data.user;
      if (u.error || !user) return rep(401, { error: 'Session expirée : reconnectez-vous.' });
      const verif = await sb.auth.signInWithPassword({ email: user.email, password: actuel });
      if (verif.error || !verif.data || !verif.data.session) return rep(401, { error: 'Mot de passe actuel incorrect.' });
      const admin = createClient(url, cleService, { auth: { persistSession: false, autoRefreshToken: false } });
      const maj = await admin.auth.admin.updateUserById(user.id, { password: nouveau });
      if (maj.error) return rep(400, { error: maj.error.message });
      const neuf = await sb.auth.signInWithPassword({ email: user.email, password: nouveau });
      const ns = neuf.data && neuf.data.session;
      if (neuf.error || !ns) return rep(200, { ok: true, reconnexion: true });
      return rep(200, { ok: true, access_token: ns.access_token, refresh_token: ns.refresh_token, expires_at: ns.expires_at, email: user.email, profil: profilDe(user) });
    }
    let res;
    if (b.refresh_token) res = await sb.auth.refreshSession({ refresh_token: b.refresh_token });
    else if (b.email && b.mot_de_passe) res = await sb.auth.signInWithPassword({ email: String(b.email).trim(), password: String(b.mot_de_passe) });
    else return rep(400, { error: 'E-mail et mot de passe requis.' });
    const s = res.data && res.data.session;
    if (res.error || !s) return rep(401, { error: b.refresh_token ? 'Session expirée.' : 'E-mail ou mot de passe incorrect.' });
    return rep(200, { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, email: s.user && s.user.email, profil: profilDe(s.user) });
  } catch (err) {
    return rep(500, { error: err.message });
  }
};
