// functions/reporter-retards.js
//
// POST /.netlify/functions/reporter-retards            { date?: 'AAAA-MM-JJ' }   (date = dernier jour à considérer comme écoulé ; défaut : hier)
//
// Report AUTOMATIQUE des tâches non terminées : toute étape « planifiée » ou « en cours » dont des créneaux sont
// déjà passés et qui n'est pas déclarée terminée voit son travail restant (d'après l'avancement saisi, 0 % si rien n'est
// saisi) replanifié à partir d'aujourd'hui, avec les étapes qui en dépendent (lib/recalage.js, mêmes règles que la
// saisie de production : machines, conducteurs, équipe, calendrier). Idempotent : une étape déjà reportée n'est pas
// reportée une seconde fois. Les créneaux passés sont conservés.
// Peut être appelé par l'application à l'ouverture, ou par un déclencheur planifié (appel sans en-têtes).
//
// Réponse : { date, etapes_examinees, ofs: [{ of_id, numero, retard, applique, retards, nouvelle_fin, delai_tenu, raison }] }

const { getSupabase } = require('./lib/supabaseclient');
const { aujourdhuiParis } = require('./lib/debut-etape');
const { recalerSiRetard } = require('./lib/recalage');
const planifier = require('./planifier-of');

const MAX_OF = 40;
const veille = (iso) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    const body = JSON.parse(event.body || '{}');
    const auj = aujourdhuiParis();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') && body.date < auj ? body.date : veille(auj);
    const supabase = getSupabase();

    // Créneaux écoulés (60 derniers jours) rattachés à une étape de gamme
    const depuis = (() => { const d = new Date(`${auj}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 60); return d.toISOString().slice(0, 10); })();
    const { data: passes, error: eP } = await supabase.from('planning_jour')
      .select('gamme_operatoire_id, date').not('gamme_operatoire_id', 'is', null).lte('date', date).gte('date', depuis).neq('statut', 'annulé');
    if (eP) throw eP;
    const gids = Array.from(new Set(passes.map((p) => p.gamme_operatoire_id)));
    if (!gids.length) return { statusCode: 200, body: JSON.stringify({ date, etapes_examinees: 0, ofs: [] }) };

    const gammes = [];
    for (let i = 0; i < gids.length; i += 150) {
      const { data, error } = await supabase.from('gammes_operatoires').select('id, of_id, statut').in('id', gids.slice(i, i + 150)).in('statut', ['planifié', 'en cours']);
      if (error) throw error;
      gammes.push(...data);
    }
    const parOf = {};
    gammes.forEach((g) => { (parOf[g.of_id] = parOf[g.of_id] || []).push(g.id); });
    const ofIds = Object.keys(parOf).slice(0, MAX_OF);

    const resultats = [];
    for (const ofId of ofIds) {
      const { data: of } = await supabase.from('ordres_fabrication').select('numero, statut').eq('id', ofId).maybeSingle();
      if (of && ['terminé', 'annulé'].includes(of.statut)) continue;
      try {
        const r = await recalerSiRetard(supabase, ofId, date, parOf[ofId], planifier.handler);
        if (r && r.retard) resultats.push({ of_id: ofId, numero: of ? of.numero : '', ...r });
      } catch (e) {
        resultats.push({ of_id: ofId, numero: of ? of.numero : '', retard: true, applique: false, raison: e.message });
      }
    }
    return { statusCode: 200, body: JSON.stringify({ date, etapes_examinees: gammes.length, ofs: resultats }) };
  } catch (err) {
    console.error('reporter-retards error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
