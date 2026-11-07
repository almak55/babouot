// lib/auth.js
//
// Protection des fonctions Netlify :
//   1. exige une connexion Supabase Auth valide (en-tête « Authorization: Bearer <jeton> ») ;
//   2. vérifie que le compte est actif et que son RÔLE autorise l'action demandée (voir lib/droits.js) ;
//   3. journalise les actions qui modifient des données (table journal_actions : qui, quoi, quand).
//
// Les appels internes d'une fonction à une autre (événement fabriqué sans en-têtes) passent sans contrôle ;
// les appels HTTP réels en ont toujours.
//
// Variables Netlify (dépannage uniquement) :
//   AUTH_DESACTIVEE=1    coupe toute la protection
//   ROLES_DESACTIVES=1   garde la connexion obligatoire mais ignore les rôles (tout compte connecté peut tout faire)
//
// Tant que la migration 59 (table utilisateurs) n'est pas passée, tout compte connecté est traité comme administrateur
// (comportement d'avant les rôles) : aucun blocage au déploiement.

const { getSupabase } = require('./supabaseclient');
const D = require('./droits');

const refus = (message, code, statut) => ({
  statusCode: statut || 401,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: message, code: code || 'auth' }),
});

const TABLE_ABSENTE = (e) => !!e && (['42P01', 'PGRST205', 'PGRST200'].includes(e.code) || /does not exist|schema cache|could not find the table/i.test(e.message || ''));

const cache = new Map();           // user_id -> { t, compte }
const DUREE_CACHE_MS = 10000;
const invaliderCompte = (userId) => { if (userId) cache.delete(userId); else cache.clear(); };

// Compte applicatif (rôle, actif) d'un utilisateur Supabase ; le crée au premier passage.
// Premier compte rencontré alors qu'aucun administrateur n'existe : il devient administrateur (amorçage).
async function compteDe(sb, user) {
  const c = cache.get(user.id);
  if (c && Date.now() - c.t < DUREE_CACHE_MS) return c.compte;
  const lu = await sb.from('utilisateurs').select('user_id, email, role, actif').eq('user_id', user.id).maybeSingle();
  if (lu.error) {
    if (TABLE_ABSENTE(lu.error)) return { user_id: user.id, email: user.email, role: 'administrateur', actif: true, compat: true };
    throw lu.error;
  }
  let compte = lu.data;
  if (!compte) {
    const admins = await sb.from('utilisateurs').select('user_id').eq('role', 'administrateur').eq('actif', true).limit(1);
    if (admins.error) throw admins.error;
    const role = admins.data && admins.data.length ? D.ROLE_PAR_DEFAUT : 'administrateur';
    const ins = await sb.from('utilisateurs').upsert({ user_id: user.id, email: user.email || '', role, actif: true }, { onConflict: 'user_id', ignoreDuplicates: true }).select('user_id, email, role, actif');
    if (ins.error) throw ins.error;
    compte = (ins.data && ins.data[0]) || { user_id: user.id, email: user.email, role, actif: true };
  }
  cache.set(user.id, { t: Date.now(), compte });
  return compte;
}

// Informations d'accès renvoyées au navigateur (connexion, profil).
async function infosAcces(user) {
  if (process.env.ROLES_DESACTIVES === '1') return { role: 'administrateur', role_libelle: D.ROLES.administrateur.libelle, droits: D.PERMISSIONS.slice(), actif: true };
  const compte = await compteDe(getSupabase(), user);
  const r = D.ROLES[compte.role] || D.ROLES[D.ROLE_PAR_DEFAUT];
  return { role: compte.role, role_libelle: r.libelle, droits: r.permissions.slice(), actif: compte.actif !== false };
}

const CHAMPS_CIBLE = ['user_id', 'of_id', 'gamme_id', 'personnel_id', 'machine_id', 'planning_jour_id', 'date', 'date_debut', 'id', 'code', 'statut', 'titre', 'email', 'role', 'actif'];
function cibleDe(event, corps) {
  const q = event.queryStringParameters || {};
  const o = {};
  CHAMPS_CIBLE.forEach((k) => {
    const v = corps && corps[k] !== undefined ? corps[k] : q[k];
    if (v !== undefined && v !== null && typeof v !== 'object') o[k] = String(v).slice(0, 80);
  });
  return o;
}

async function journaliser(sb, compte, nom, event, action, corps, statut) {
  try {
    await sb.from('journal_actions').insert({
      user_id: compte.user_id, email: compte.email || null, role: compte.role, fonction: nom, methode: event.httpMethod, action: action || null,
      cible: cibleDe(event, corps), statut,
    });
  } catch (e) { /* le journal ne doit jamais bloquer le travail */ }
}

function avecAuth(handler) {
  return async (event, context) => {
    if (!event || !event.headers || process.env.AUTH_DESACTIVEE === '1') return handler(event, context);
    const entete = event.headers.authorization || event.headers.Authorization || '';
    const jeton = String(entete).replace(/^Bearer\s+/i, '').trim();
    if (!jeton) return refus('Connexion requise.');
    let user;
    try {
      const { data, error } = await getSupabase().auth.getUser(jeton);
      if (error || !data || !data.user) return refus('Session expirée : reconnectez-vous.');
      user = data.user;
    } catch (e) {
      return refus('Vérification de la connexion impossible.');
    }
    if (process.env.ROLES_DESACTIVES === '1') return handler(event, context);

    const nom = D.nomFonction(event);
    const methode = String(event.httpMethod || 'GET').toUpperCase();
    let corps = null, action;
    if (methode !== 'GET' && methode !== 'HEAD' && event.body) {
      try { corps = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body); } catch (e) { corps = null; }
      if (corps && typeof corps === 'object' && typeof corps.action === 'string') action = corps.action;
    }
    const sb = getSupabase();
    let compte;
    try { compte = await compteDe(sb, user); } catch (e) { return refus('Vérification des droits impossible : ' + (e.message || e), 'droits', 503); }
    if (compte.actif === false) return refus('Votre compte est désactivé. Contactez un administrateur.', 'desactive', 403);
    if (!D.autorise(compte.role, nom, methode, action)) {
      const role = D.ROLES[compte.role] || D.ROLES[D.ROLE_PAR_DEFAUT];
      const besoin = D.exigence(nom, methode, action).map((p) => D.LIBELLES_PERMISSIONS[p] || p).join(' ou ');
      return refus(`Action non autorisée pour votre rôle « ${role.libelle} » (il faut le droit de ${besoin}). Demandez à un administrateur de modifier votre rôle si nécessaire.`, 'droits', 403);
    }
    event.utilisateur = { id: user.id, email: user.email, role: compte.role };
    const reponse = await handler(event, context);
    if (nom !== 'messagerie' && !D.estLecture(nom, methode, action) && reponse && reponse.statusCode < 400 && !compte.compat) {
      await journaliser(sb, compte, nom, event, action, corps, reponse.statusCode);
    }
    return reponse;
  };
}

module.exports = { avecAuth, compteDe, infosAcces, invaliderCompte, TABLE_ABSENTE };
