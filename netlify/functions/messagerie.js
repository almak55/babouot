// functions/messagerie.js
//
// Messagerie interne : conversations (« fils ») sur un sujet de production, entre les comptes de connexion.
//
// GET  ?action=utilisateurs                 -> { utilisateurs: [{ id, nom, email, fonction }] }   (comptes de connexion actifs)
// GET  ?action=sujets                       -> { of:[{id,libelle}], titre:[…], machine:[…], stock:[…], planning_annuel:[…] }
// GET  ?action=liste[&clos=1]               -> { fils: [{ id, objet, sujet_type, sujet_libelle, clos, non_lu, dernier_message_at,
//                                                          dernier_apercu, dernier_auteur, participants:[nom] }] }   (mes conversations)
// GET  ?action=non_lus                      -> { non_lus: n }                  (conversations non lues : pastille de l'écran)
// GET  ?action=fil&id=uuid                  -> { fil, participants, messages }  et marque la conversation comme lue
// POST { action:'creer', sujet_type, sujet_id?, objet, destinataires:[id…], message, mail? }   -> { id, mail }
// POST { action:'repondre', fil_id, message, mail? }                          -> { ok, mail }
// POST { action:'ajouter', fil_id, destinataires:[id…], mail? }               -> { ok, mail }
// POST { action:'cloturer', fil_id, clos:true|false }                         -> { ok }
//
// Une personne ne voit que les conversations dont elle est participante. L'auteur est toujours le compte
// connecté (jamais lu dans la requête). Notifications par e-mail : voir lib/mail.js (facultatives).

const { getSupabase } = require('./lib/supabaseclient');
const { envoyerMails, configuration } = require('./lib/mail');

const TYPES = {
  of: 'Ordre de fabrication', titre: 'Titre', machine: 'Machine', stock: 'Matière / stock',
  planning_annuel: 'Planning annuel', general: 'Général',
};
const rep = (code, o) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
const erreur = (code, message) => rep(code, { error: message });
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const texte = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const EST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nomDe(user) {
  const m = (user && user.user_metadata) || {};
  const n = [m.prenom, m.nom].filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()).join(' ');
  return n || String((user && user.email) || '').split('@')[0] || 'Utilisateur';
}

async function utilisateurCourant(supabase, event) {
  const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const jeton = String(h).replace(/^Bearer\s+/i, '').trim();
  if (!jeton) return null;
  const { data, error } = await supabase.auth.getUser(jeton);
  return error || !data || !data.user ? null : data.user;
}

// Tous les comptes de connexion actifs.
async function comptes(supabase) {
  const tous = [];
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = (data && data.users) || [];
    tous.push(...users);
    if (users.length < 200) break;
  }
  const maintenant = Date.now();
  return tous
    .filter((u) => u.email && !(u.banned_until && Date.parse(u.banned_until) > maintenant))
    .map((u) => ({ id: u.id, email: u.email, nom: nomDe(u), fonction: ((u.user_metadata || {}).fonction || '').toString() }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

// Libellé lisible d'un sujet ; null si l'objet n'existe pas.
async function libelleSujet(supabase, type, id) {
  if (type === 'general') return '';
  if (!id) return null;
  const un = async (req) => { const { data, error } = await req; if (error) throw error; return data; };
  if (type === 'of') {
    const o = await un(supabase.from('ordres_fabrication').select('numero, titres(nom)').eq('id', id).maybeSingle());
    return o ? `${o.numero}${o.titres && o.titres.nom ? ' — ' + o.titres.nom : ''}` : null;
  }
  if (type === 'titre') {
    const t = await un(supabase.from('titres').select('nom, client').eq('id', id).maybeSingle());
    return t ? `${t.nom}${t.client ? ' (' + t.client + ')' : ''}` : null;
  }
  if (type === 'machine') { const m = await un(supabase.from('machines').select('nom').eq('id', id).maybeSingle()); return m ? m.nom : null; }
  if (type === 'stock') { const s = await un(supabase.from('stocks').select('nom').eq('id', id).maybeSingle()); return s ? s.nom : null; }
  if (type === 'planning_annuel') {
    const l = await un(supabase.from('pleiade_annuel').select('titre, mois').eq('id', id).maybeSingle());
    return l ? `${l.titre}${l.mois ? ' (' + l.mois + ')' : ''}` : null;
  }
  return null;
}

async function listeSujets(supabase) {
  const sur = async (req, f) => { try { const { data, error } = await req; if (error) throw error; return (data || []).map(f); } catch (e) { return []; } };
  const [of, titre, machine, stock, planning] = await Promise.all([
    sur(supabase.from('ordres_fabrication').select('id, numero, statut, titres(nom)').neq('statut', 'annulé').order('numero', { ascending: false }).limit(300),
      (o) => ({ id: o.id, libelle: `${o.numero}${o.titres && o.titres.nom ? ' — ' + o.titres.nom : ''}` })),
    sur(supabase.from('titres').select('id, nom, client').order('nom').limit(500), (t) => ({ id: t.id, libelle: `${t.nom}${t.client ? ' (' + t.client + ')' : ''}` })),
    sur(supabase.from('machines').select('id, nom').eq('actif', true).order('nom'), (m) => ({ id: m.id, libelle: m.nom })),
    sur(supabase.from('stocks').select('id, nom').order('nom').limit(300), (s) => ({ id: s.id, libelle: s.nom })),
    sur(supabase.from('pleiade_annuel').select('id, titre, mois, statut').neq('statut', 'fait').order('ordre').limit(400), (l) => ({ id: l.id, libelle: `${l.titre}${l.mois ? ' (' + l.mois + ')' : ''}` })),
  ]);
  return { of, titre, machine, stock, planning_annuel: planning };
}

const plusRecent = (a, b) => Date.parse(a) > Date.parse(b);
const estNonLu = (fil, part) => !part.lu_jusqua || plusRecent(fil.dernier_message_at, part.lu_jusqua);

// Mails de notification (un par destinataire).
function preparerMails({ destinataires, auteur, fil, corps, ajout }) {
  const site = String(process.env.SITE_URL || process.env.URL || '').replace(/\/+$/, '');
  const lien = site ? `${site}/?fil=${fil.id}` : '';
  const sujetMail = `[Babouot] ${fil.sujet_libelle ? fil.sujet_libelle + ' — ' : ''}${fil.objet}`.slice(0, 200);
  const intro = ajout ? `${auteur} vous a ajouté(e) à une conversation` : `${auteur} vous a écrit`;
  const sur = fil.sujet_libelle ? ` à propos de ${TYPES[fil.sujet_type] ? TYPES[fil.sujet_type].toLowerCase() : 'sujet'} « ${fil.sujet_libelle} »` : '';
  return destinataires.map((d) => ({
    email: d.email, nom: d.nom, sujet: sujetMail,
    texte: `Bonjour ${d.nom},\n\n${intro}${sur} :\nObjet : ${fil.objet}\n\n${corps ? corps + '\n\n' : ''}${lien ? 'Ouvrir la conversation : ' + lien + '\n' : 'Connectez-vous à l\'application Babouot, onglet Messagerie, pour répondre.\n'}`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:560px">
      <p>Bonjour ${esc(d.nom)},</p>
      <p><strong>${esc(auteur)}</strong> ${ajout ? 'vous a ajouté(e) à une conversation' : 'vous a écrit'}${esc(sur)}.</p>
      <p style="margin:0 0 4px;color:#666">Objet : <strong style="color:#222">${esc(fil.objet)}</strong></p>
      ${corps ? `<div style="border-left:3px solid #1aa38a;background:#f3f6f6;padding:10px 14px;margin:10px 0;white-space:pre-wrap">${esc(corps)}</div>` : ''}
      ${lien ? `<p><a href="${esc(lien)}" style="display:inline-block;background:#1aa38a;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px">Ouvrir la conversation</a></p>`
        : '<p>Connectez-vous à l\'application Babouot, onglet <strong>Messagerie</strong>, pour répondre.</p>'}
      <p style="color:#888;font-size:12px">Message automatique de l'application de planification — ne répondez pas à cet e-mail.</p></div>`,
  }));
}

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();
    const moi = await utilisateurCourant(supabase, event);
    if (!moi) return rep(401, { error: 'Connexion requise.', code: 'auth' });
    const monNom = nomDe(moi);
    const q = event.queryStringParameters || {};
    const post = event.httpMethod === 'POST';
    const b = post ? JSON.parse(event.body || '{}') : {};
    const action = post ? b.action : (q.action || 'liste');

    // ---------- lectures ----------
    if (!post) {
      if (action === 'utilisateurs') return rep(200, { utilisateurs: (await comptes(supabase)).filter((u) => u.id !== moi.id) });
      if (action === 'sujets') return rep(200, await listeSujets(supabase));

      if (action === 'non_lus') {
        const { data: parts, error } = await supabase.from('messagerie_participants').select('fil_id, lu_jusqua').eq('user_id', moi.id);
        if (error) throw error;
        if (!parts.length) return rep(200, { non_lus: 0 });
        const { data: fils, error: e2 } = await supabase.from('messagerie_fils').select('id, dernier_message_at, clos').in('id', parts.map((p) => p.fil_id));
        if (e2) throw e2;
        const n = fils.filter((f) => !f.clos && estNonLu(f, parts.find((p) => p.fil_id === f.id))).length;
        return rep(200, { non_lus: n });
      }

      if (action === 'liste') {
        const { data: parts, error } = await supabase.from('messagerie_participants').select('fil_id, lu_jusqua').eq('user_id', moi.id);
        if (error) throw error;
        if (!parts.length) return rep(200, { fils: [] });
        let req = supabase.from('messagerie_fils').select('*').in('id', parts.map((p) => p.fil_id)).order('dernier_message_at', { ascending: false }).limit(100);
        if (q.clos !== '1') req = req.eq('clos', false);
        const { data: fils, error: e2 } = await req;
        if (e2) throw e2;
        if (!fils.length) return rep(200, { fils: [] });
        const ids = fils.map((f) => f.id);
        const [{ data: tous, error: e3 }, { data: msgs, error: e4 }] = await Promise.all([
          supabase.from('messagerie_participants').select('fil_id, user_id, nom').in('fil_id', ids),
          supabase.from('messagerie_messages').select('fil_id, corps, auteur_nom, created_at').in('fil_id', ids).order('created_at', { ascending: false }).limit(1000),
        ]);
        if (e3) throw e3;
        if (e4) throw e4;
        return rep(200, {
          fils: fils.map((f) => {
            const dernier = msgs.find((m) => m.fil_id === f.id);
            return {
              id: f.id, objet: f.objet, sujet_type: f.sujet_type, sujet_id: f.sujet_id, sujet_libelle: f.sujet_libelle, clos: f.clos,
              cree_par_nom: f.cree_par_nom, dernier_message_at: f.dernier_message_at,
              non_lu: estNonLu(f, parts.find((p) => p.fil_id === f.id)),
              dernier_apercu: dernier ? String(dernier.corps).slice(0, 140) : '', dernier_auteur: dernier ? dernier.auteur_nom : '',
              participants: tous.filter((p) => p.fil_id === f.id).map((p) => p.nom),
            };
          }),
        });
      }

      if (action === 'fil') {
        if (!EST_UUID.test(String(q.id || ''))) return erreur(400, 'Conversation invalide.');
        const { data: moiPart, error } = await supabase.from('messagerie_participants').select('fil_id').eq('fil_id', q.id).eq('user_id', moi.id).maybeSingle();
        if (error) throw error;
        if (!moiPart) return erreur(404, 'Conversation introuvable.');
        const [{ data: fil }, { data: participants }, { data: messages }] = await Promise.all([
          supabase.from('messagerie_fils').select('*').eq('id', q.id).maybeSingle(),
          supabase.from('messagerie_participants').select('user_id, nom, email, lu_jusqua').eq('fil_id', q.id),
          supabase.from('messagerie_messages').select('id, auteur_id, auteur_nom, corps, created_at').eq('fil_id', q.id).order('created_at', { ascending: true }),
        ]);
        if (!fil) return erreur(404, 'Conversation introuvable.');
        const { error: eLu } = await supabase.from('messagerie_participants').update({ lu_jusqua: fil.dernier_message_at }).eq('fil_id', q.id).eq('user_id', moi.id);
        if (eLu) throw eLu;
        return rep(200, { fil, moi: moi.id, participants: (participants || []).map((p) => ({ user_id: p.user_id, nom: p.nom })), messages: messages || [] });
      }
      return erreur(400, 'Action inconnue.');
    }

    // ---------- écritures ----------
    const verifierParticipant = async (filId) => {
      if (!EST_UUID.test(String(filId || ''))) return { err: erreur(400, 'Conversation invalide.') };
      const [{ data: part }, { data: fil }] = await Promise.all([
        supabase.from('messagerie_participants').select('fil_id').eq('fil_id', filId).eq('user_id', moi.id).maybeSingle(),
        supabase.from('messagerie_fils').select('*').eq('id', filId).maybeSingle(),
      ]);
      if (!part || !fil) return { err: erreur(404, 'Conversation introuvable.') };
      return { fil };
    };
    const choisirDestinataires = async (ids, exclus) => {
      const demandes = Array.from(new Set((Array.isArray(ids) ? ids : []).map(String))).filter((x) => x !== moi.id && !exclus.includes(x));
      if (!demandes.length) return { liste: [] };
      const tous = await comptes(supabase);
      const liste = demandes.map((id) => tous.find((u) => u.id === id));
      if (liste.some((x) => !x)) return { err: erreur(400, 'Un destinataire n\'a pas de compte de connexion actif.') };
      return { liste };
    };
    const resumeMail = async (mails, voulu) => (voulu === false ? { configure: configuration().configure, envoyes: 0, echecs: [], desactive: true } : envoyerMails(mails));

    if (action === 'creer') {
      const type = String(b.sujet_type || 'general');
      if (!TYPES[type]) return erreur(400, 'Type de sujet inconnu.');
      const objet = texte(b.objet, 120), corps = texte(b.message, 5000);
      if (!objet) return erreur(400, 'L\'objet est obligatoire.');
      if (!corps) return erreur(400, 'Le message est vide.');
      const dest = await choisirDestinataires(b.destinataires, []);
      if (dest.err) return dest.err;
      if (!dest.liste.length) return erreur(400, 'Choisissez au moins un destinataire.');
      const sujetId = type === 'general' ? null : String(b.sujet_id || '');
      let libelle;
      try { libelle = await libelleSujet(supabase, type, sujetId); } catch (e) { return erreur(400, 'Sujet invalide.'); }
      if (libelle === null) return erreur(400, 'Le sujet choisi est introuvable.');

      const maintenant = new Date().toISOString();
      const { data: fil, error } = await supabase.from('messagerie_fils').insert({
        sujet_type: type, sujet_id: sujetId, sujet_libelle: libelle || null, objet, cree_par: moi.id, cree_par_nom: monNom,
        created_at: maintenant, dernier_message_at: maintenant,
      }).select().single();
      if (error) throw error;
      try {
        const { error: e1 } = await supabase.from('messagerie_participants').insert([
          { fil_id: fil.id, user_id: moi.id, nom: monNom, email: moi.email, lu_jusqua: maintenant },
          ...dest.liste.map((d) => ({ fil_id: fil.id, user_id: d.id, nom: d.nom, email: d.email, lu_jusqua: null })),
        ]);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from('messagerie_messages').insert({ fil_id: fil.id, auteur_id: moi.id, auteur_nom: monNom, corps, created_at: maintenant });
        if (e2) throw e2;
      } catch (e) {
        await supabase.from('messagerie_fils').delete().eq('id', fil.id);   // rien de demi-créé
        throw e;
      }
      const mail = await resumeMail(preparerMails({ destinataires: dest.liste, auteur: monNom, fil, corps, ajout: false }), b.mail);
      return rep(200, { id: fil.id, mail });
    }

    if (action === 'repondre') {
      const v = await verifierParticipant(b.fil_id);
      if (v.err) return v.err;
      const corps = texte(b.message, 5000);
      if (!corps) return erreur(400, 'Le message est vide.');
      const maintenant = new Date().toISOString();
      const { error: e1 } = await supabase.from('messagerie_messages').insert({ fil_id: v.fil.id, auteur_id: moi.id, auteur_nom: monNom, corps, created_at: maintenant });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('messagerie_fils').update({ dernier_message_at: maintenant, clos: false }).eq('id', v.fil.id);   // une réponse rouvre la conversation
      if (e2) throw e2;
      const { error: e3 } = await supabase.from('messagerie_participants').update({ lu_jusqua: maintenant }).eq('fil_id', v.fil.id).eq('user_id', moi.id);
      if (e3) throw e3;
      const { data: autres, error: e4 } = await supabase.from('messagerie_participants').select('user_id, nom, email').eq('fil_id', v.fil.id);
      if (e4) throw e4;
      const mail = await resumeMail(preparerMails({ destinataires: autres.filter((p) => p.user_id !== moi.id), auteur: monNom, fil: v.fil, corps, ajout: false }), b.mail);
      return rep(200, { ok: true, mail });
    }

    if (action === 'ajouter') {
      const v = await verifierParticipant(b.fil_id);
      if (v.err) return v.err;
      const { data: existants, error } = await supabase.from('messagerie_participants').select('user_id').eq('fil_id', v.fil.id);
      if (error) throw error;
      const dest = await choisirDestinataires(b.destinataires, existants.map((p) => p.user_id));
      if (dest.err) return dest.err;
      if (!dest.liste.length) return erreur(400, 'Aucune nouvelle personne à ajouter.');
      const { error: e1 } = await supabase.from('messagerie_participants').insert(dest.liste.map((d) => ({ fil_id: v.fil.id, user_id: d.id, nom: d.nom, email: d.email, lu_jusqua: null })));
      if (e1) throw e1;
      const mail = await resumeMail(preparerMails({ destinataires: dest.liste, auteur: monNom, fil: v.fil, corps: '', ajout: true }), b.mail);
      return rep(200, { ok: true, ajoutes: dest.liste.length, mail });
    }

    if (action === 'cloturer') {
      const v = await verifierParticipant(b.fil_id);
      if (v.err) return v.err;
      const { error } = await supabase.from('messagerie_fils').update({ clos: b.clos !== false }).eq('id', v.fil.id);
      if (error) throw error;
      return rep(200, { ok: true });
    }
    return erreur(400, 'Action inconnue.');
  } catch (err) {
    const manquante = /messagerie_|relation .* does not exist|schema cache/i.test(err.message || '');
    return erreur(500, manquante ? `${err.message} — exécutez d'abord la migration 50 dans Supabase.` : err.message);
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
