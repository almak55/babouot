// functions/gerer-utilisateurs.js
//
// Gestion des comptes et des rôles (réservé aux administrateurs, voir lib/droits.js).
//
// GET                         -> { utilisateurs: [{ user_id, email, prenom, nom, fonction, role, actif, derniere_connexion, cree_le }],
//                                  roles: [{ id, libelle, description, permissions }], moi: user_id }
// GET ?journal=1[&limite=100][&email=...] -> { journal: [{ cree_le, email, role, fonction, methode, action, cible }] }  (actions qui modifient des données)
// POST { action:'creer', email, mot_de_passe, role, prenom?, nom?, fonction? }   -> crée le compte (e-mail confirmé) et lui attribue le rôle
// POST { action:'mot_de_passe', user_id, mot_de_passe }                           -> réinitialise le mot de passe d'un compte
// PUT  { user_id, role?, actif? }                                                 -> change le rôle et / ou active / désactive le compte
//
// Garde-fou : il doit toujours rester au moins un administrateur actif. Un compte désactivé ne peut plus rien faire
// (ses appels sont refusés même si sa session est encore ouverte) ; il n'est jamais supprimé, pour garder l'historique.

const { getSupabase } = require('./lib/supabaseclient');
const { invaliderCompte } = require('./lib/auth');
const D = require('./lib/droits');

const rep = (code, o) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const texte = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 80);

async function tousLesComptes(sb) {
  const tous = [];
  for (let page = 1; page <= 20; page++) {
    const r = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (r.error) throw r.error;
    const l = (r.data && r.data.users) || [];
    tous.push(...l);
    if (l.length < 200) break;
  }
  return tous;
}
async function nbAdminsActifs(sb, sauf) {
  const r = await sb.from('utilisateurs').select('user_id').eq('role', 'administrateur').eq('actif', true);
  if (r.error) throw r.error;
  return (r.data || []).filter((x) => x.user_id !== sauf).length;
}

const handlerProtege = async (event) => {
  try {
    const sb = getSupabase();
    const moi = event.utilisateur ? event.utilisateur.id : null;
    const q = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
      if (q.journal) {
        const limite = Math.max(1, Math.min(500, Number(q.limite) || 100));
        let req = sb.from('journal_actions').select('cree_le, email, role, fonction, methode, action, cible').order('cree_le', { ascending: false }).limit(limite);
        if (q.email) req = req.eq('email', String(q.email));
        const r = await req;
        if (r.error) throw r.error;
        return rep(200, { journal: r.data || [] });
      }
      const [comptes, lignes] = await Promise.all([tousLesComptes(sb), sb.from('utilisateurs').select('user_id, email, role, actif, cree_le')]);
      if (lignes.error) throw lignes.error;
      const parId = new Map((lignes.data || []).map((l) => [l.user_id, l]));
      // comptes créés directement dans Supabase : enregistrés avec le rôle le plus restreint
      const manquants = comptes.filter((c) => !parId.has(c.id)).map((c) => ({ user_id: c.id, email: c.email || '', role: D.ROLE_PAR_DEFAUT, actif: true }));
      if (manquants.length) {
        const ins = await sb.from('utilisateurs').upsert(manquants, { onConflict: 'user_id', ignoreDuplicates: true });
        if (ins.error) throw ins.error;
        manquants.forEach((m) => parId.set(m.user_id, { ...m, cree_le: new Date().toISOString() }));
      }
      const utilisateurs = comptes.map((c) => {
        const l = parId.get(c.id) || {}, m = c.user_metadata || {};
        return { user_id: c.id, email: c.email || l.email || '', prenom: m.prenom || '', nom: m.nom || '', fonction: m.fonction || '', role: l.role || D.ROLE_PAR_DEFAUT, actif: l.actif !== false, derniere_connexion: c.last_sign_in_at || null, cree_le: c.created_at || l.cree_le || null };
      }).sort((a, b) => (b.actif - a.actif) || a.email.localeCompare(b.email));
      const roles = D.ROLES_VALIDES.map((id) => ({ id, libelle: D.ROLES[id].libelle, description: D.ROLES[id].description, permissions: D.ROLES[id].permissions }));
      return rep(200, { utilisateurs, roles, moi });
    }

    const b = JSON.parse(event.body || '{}');

    if (event.httpMethod === 'POST' && b.action === 'creer') {
      const email = texte(b.email, 160).toLowerCase(), mdp = String(b.mot_de_passe || ''), role = texte(b.role, 40);
      if (!EMAIL.test(email)) return rep(400, { error: 'Adresse e-mail invalide.' });
      if (mdp.length < 8) return rep(400, { error: 'Le mot de passe doit contenir au moins 8 caractères.' });
      if (!D.ROLES_VALIDES.includes(role)) return rep(400, { error: `Rôle invalide (${D.ROLES_VALIDES.join(', ')}).` });
      const meta = {};
      ['prenom', 'nom', 'fonction'].forEach((k) => { if (texte(b[k])) meta[k] = texte(b[k]); });
      const c = await sb.auth.admin.createUser({ email, password: mdp, email_confirm: true, user_metadata: meta });
      if (c.error) return rep(400, { error: /already|registered|exists/i.test(c.error.message || '') ? 'Un compte existe déjà avec cet e-mail.' : c.error.message });
      const id = c.data.user.id;
      const ins = await sb.from('utilisateurs').upsert({ user_id: id, email, role, actif: true, modifie_le: new Date().toISOString(), modifie_par: event.utilisateur ? event.utilisateur.email : null }, { onConflict: 'user_id' });
      if (ins.error) throw ins.error;
      invaliderCompte(id);
      return rep(200, { ok: true, user_id: id, email, role });
    }

    if (event.httpMethod === 'POST' && b.action === 'mot_de_passe') {
      const mdp = String(b.mot_de_passe || '');
      if (!b.user_id) return rep(400, { error: 'user_id requis.' });
      if (mdp.length < 8) return rep(400, { error: 'Le mot de passe doit contenir au moins 8 caractères.' });
      const r = await sb.auth.admin.updateUserById(String(b.user_id), { password: mdp });
      if (r.error) return rep(400, { error: r.error.message });
      return rep(200, { ok: true });
    }

    if (event.httpMethod === 'PUT') {
      const id = String(b.user_id || '');
      if (!id) return rep(400, { error: 'user_id requis.' });
      const cur = await sb.from('utilisateurs').select('user_id, role, actif').eq('user_id', id).maybeSingle();
      if (cur.error) throw cur.error;
      if (!cur.data) return rep(404, { error: 'Utilisateur introuvable.' });
      const maj = { modifie_le: new Date().toISOString(), modifie_par: event.utilisateur ? event.utilisateur.email : null };
      if (b.role !== undefined) {
        if (!D.ROLES_VALIDES.includes(b.role)) return rep(400, { error: `Rôle invalide (${D.ROLES_VALIDES.join(', ')}).` });
        maj.role = b.role;
      }
      if (b.actif !== undefined) maj.actif = !!b.actif;
      const seraAdminActif = (maj.role !== undefined ? maj.role : cur.data.role) === 'administrateur' && (maj.actif !== undefined ? maj.actif : cur.data.actif);
      if (!seraAdminActif && cur.data.role === 'administrateur' && cur.data.actif && (await nbAdminsActifs(sb, id)) === 0) {
        return rep(400, { error: 'Il doit rester au moins un administrateur actif : désignez-en un autre avant de modifier celui-ci.' });
      }
      const r = await sb.from('utilisateurs').update(maj).eq('user_id', id);
      if (r.error) throw r.error;
      invaliderCompte(id);
      return rep(200, { ok: true, user_id: id, role: maj.role !== undefined ? maj.role : cur.data.role, actif: maj.actif !== undefined ? maj.actif : cur.data.actif });
    }

    return rep(405, { error: 'Méthode non autorisée.' });
  } catch (err) {
    console.error('gerer-utilisateurs error:', err);
    return rep(500, { error: err.message || String(err) });
  }
};

// Accès réservé aux administrateurs (voir lib/auth.js et lib/droits.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
