// lib/mail.js
//
// Envoi des notifications par e-mail de la messagerie interne, via l'API HTTPS d'un service d'envoi
// (aucune dépendance à installer). Deux services sont pris en charge ; le premier configuré est utilisé :
//
//   Brevo   : BREVO_API_KEY   (clé API v3)        — l'adresse expéditrice doit être validée dans Brevo
//   Resend  : RESEND_API_KEY                      — le domaine de l'adresse expéditrice doit être validé dans Resend
//
//   MAIL_EXPEDITEUR      adresse expéditrice (ex. planning@votre-domaine.fr)   [obligatoire]
//   MAIL_EXPEDITEUR_NOM  nom affiché (défaut : « Ateliers Babouot »)
//
// Sans configuration, la messagerie fonctionne normalement : seules les notifications par e-mail sont ignorées.

const DELAI_MS = 6500;   // les fonctions Netlify s'arrêtent vers 10 s : on n'attend jamais plus longtemps

function configuration() {
  const expediteur = (process.env.MAIL_EXPEDITEUR || '').trim();
  const nom = (process.env.MAIL_EXPEDITEUR_NOM || 'Ateliers Babouot').trim();
  let fournisseur = null;
  if ((process.env.BREVO_API_KEY || '').trim()) fournisseur = 'brevo';
  else if ((process.env.RESEND_API_KEY || '').trim()) fournisseur = 'resend';
  return { fournisseur, expediteur, nom, configure: !!(fournisseur && expediteur) };
}

async function appeler(url, options) {
  const ctrl = new AbortController();
  const minuterie = setTimeout(() => ctrl.abort(), DELAI_MS);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal });
    if (r.ok) return { ok: true };
    let detail = '';
    try { const j = await r.json(); detail = j.message || j.error || (j.error && j.error.message) || ''; } catch (e) { /* corps non JSON */ }
    return { ok: false, erreur: `HTTP ${r.status}${detail ? ' — ' + String(detail).slice(0, 160) : ''}` };
  } catch (e) {
    return { ok: false, erreur: e.name === 'AbortError' ? 'délai dépassé' : e.message };
  } finally {
    clearTimeout(minuterie);
  }
}

// Envoie un mail à une personne. mail = { email, nom, sujet, html, texte }
async function envoyerUn(cfg, mail) {
  if (cfg.fournisseur === 'brevo') {
    return appeler('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY.trim(), 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { name: cfg.nom, email: cfg.expediteur }, to: [{ email: mail.email, name: mail.nom || undefined }], subject: mail.sujet, htmlContent: mail.html, textContent: mail.texte }),
    });
  }
  return appeler('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `${cfg.nom} <${cfg.expediteur}>`, to: [mail.email], subject: mail.sujet, html: mail.html, text: mail.texte }),
  });
}

// Envoie plusieurs mails (un par destinataire). Ne lève jamais d'erreur.
// Retour : { configure, envoyes, echecs: [{ email, erreur }] }
async function envoyerMails(mails) {
  const cfg = configuration();
  if (!cfg.configure) return { configure: false, envoyes: 0, echecs: [] };
  const liste = mails.filter((m) => m && m.email).slice(0, 30);
  const res = await Promise.all(liste.map(async (m) => {
    try { return { m, r: await envoyerUn(cfg, m) }; } catch (e) { return { m, r: { ok: false, erreur: e.message } }; }
  }));
  return {
    configure: true,
    envoyes: res.filter((x) => x.r.ok).length,
    echecs: res.filter((x) => !x.r.ok).map((x) => ({ email: x.m.email, erreur: x.r.erreur })),
  };
}

module.exports = { envoyerMails, configuration };
