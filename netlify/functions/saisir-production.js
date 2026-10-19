// functions/saisir-production.js
//
// POST /.netlify/functions/saisir-production
// body : {
//   date: 'AAAA-MM-JJ',                 // journée concernée (défaut : aujourd'hui)
//   saisies: [ {
//     gamme_id,
//     quantite?: number,                // produite CE JOUR-LÀ (unité de l'OF : exemplaires)
//     pct?: number,                     // OU avancement cumulé (0-100), pour les opérations sans quantité
//     termine?: boolean,                // l'étape est terminée
//     heures_reelles?, commentaire?
//   } ],
//   recaler?: boolean                   // défaut true : décale automatiquement le planning en cas de retard
// }
//
// Enregistre la production, met à jour l'avancement des étapes et de l'OF, puis,
// pour chaque OF dont une étape est en retard sur le planning, replanifie la part
// restante (et les étapes qui en dépendent) à partir du jour ouvré suivant.

let etapesBloquees = () => ({});
try { ({ etapesBloquees } = require('./lib/dependances')); } catch (e) { console.warn('lib/dependances.js introuvable : contrôle des dépendances désactivé.', e.message); }
const { getSupabase } = require('./lib/supabaseclient');
const { majAvancementOf, recalerSiRetard } = require('./lib/recalage');
const planifier = require('./planifier-of');

const nombre = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

exports.handler = async (event) => {
  const t0 = Date.now();
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    const body = JSON.parse(event.body || '{}');
    const dateGlobale = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : new Date().toISOString().slice(0, 10);
    const date = dateGlobale;
    const saisies = Array.isArray(body.saisies) ? body.saisies : [];
    const recaler = body.recaler !== false;
    if (!saisies.length) return { statusCode: 400, body: JSON.stringify({ error: 'Aucune saisie.' }) };

    const supabase = getSupabase();
    const ids = saisies.map((s) => s.gamme_id).filter(Boolean);
    const { data: gammes, error: gErr } = await supabase.from('gammes_operatoires')
      .select('id, of_id, statut, parametres, operations(nom), ordres_fabrication(numero, quantite)').in('id', ids);
    if (gErr) throw gErr;
    const gammeDe = Object.fromEntries(gammes.map((g) => [g.id, g]));

    const parOf = {};   // of_id -> [gamme_id]
    const resultats = [];
    const valide = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const statutCourant = {};
    for (const s of saisies) {
      const date = valide(s.date) ? s.date : dateGlobale;   // chaque saisie peut viser sa propre journée (correction d'un jour passé)
      const g = gammeDe[s.gamme_id];
      if (!g) { resultats.push({ gamme_id: s.gamme_id, erreur: 'Étape introuvable.' }); continue; }
      const quantite = nombre(s.quantite);
      const pctSaisi = nombre(s.pct);
      if (!s.supprimer && quantite === null && pctSaisi === null && !s.termine) continue;   // rien saisi pour cette ligne
      if (quantite !== null && quantite < 0) { resultats.push({ gamme_id: s.gamme_id, erreur: 'Quantité négative.' }); continue; }
      if (pctSaisi !== null && (pctSaisi < 0 || pctSaisi > 100)) { resultats.push({ gamme_id: s.gamme_id, erreur: 'Avancement entre 0 et 100 %.' }); continue; }

      // Une étape qui attend la fin d'une étape précédente non terminée ne peut pas être déclarée terminée.
      if (s.termine || (pctSaisi !== null && pctSaisi >= 99.99)) {
        const { data: tout, error: tErr } = await supabase.from('gammes_operatoires').select('id, sequence, statut, predecesseurs, dependances, operations(nom)').eq('of_id', g.of_id);
        if (tErr) throw tErr;
        const bloq = etapesBloquees(tout)[g.id];
        if (bloq) { resultats.push({ gamme_id: g.id, operation: g.operations.nom, erreur: `${g.operations.nom} ne peut pas être terminée : elle attend la fin de ${bloq.join(', ')}.` }); continue; }
      }

      const ligne = {
        gamme_operatoire_id: g.id, of_id: g.of_id, date,
        quantite: quantite ?? 0, pct_cumule: pctSaisi, termine: !!s.termine,
        heures_reelles: nombre(s.heures_reelles), commentaire: s.commentaire || null, updated_at: new Date().toISOString(),
      };
      if (s.supprimer) {
        const { error: delErr } = await supabase.from('production_jour').delete().eq('gamme_operatoire_id', g.id).eq('date', date);
        if (delErr) throw delErr;
      } else {
        const { error: upErr } = await supabase.from('production_jour').upsert(ligne, { onConflict: 'gamme_operatoire_id,date' });
        if (upErr) throw upErr;
      }

      // Avancement de l'étape : dernier % saisi à la main (+ quantités produites depuis), sinon cumul / quantité totale.
      const { data: lignes, error: lErr } = await supabase.from('production_jour')
        .select('date, quantite, pct_cumule, termine').eq('gamme_operatoire_id', g.id).order('date');
      if (lErr) throw lErr;
      const totalQte = nombre(g.parametres && g.parametres.quantite) || g.ordres_fabrication.quantite || 0;
      const dernierManuel = lignes.filter((l) => l.pct_cumule !== null).pop();
      let pct;
      if (dernierManuel) {
        const apres = lignes.filter((l) => l.date > dernierManuel.date).reduce((t, l) => t + Number(l.quantite), 0);
        pct = Number(dernierManuel.pct_cumule) + (totalQte ? (apres / totalQte) * 100 : 0);
      } else {
        pct = totalQte ? (lignes.reduce((t, l) => t + Number(l.quantite), 0) / totalQte) * 100 : 0;
      }
      const termine = lignes.some((l) => l.termine) || pct >= 99.99;
      pct = termine ? 100 : Math.max(0, Math.min(100, Math.round(pct * 10) / 10));

      const maj = { avancement_pct: pct, quantite_realisee: Math.round((pct / 100) * totalQte * 100) / 100 };
      const statutAvant = statutCourant[g.id] || g.statut;
      if (termine) { maj.statut = 'terminé'; maj.date_fin_reelle = date; }
      else if (statutAvant === 'terminé') { maj.statut = pct > 0 ? 'en cours' : 'planifié'; maj.date_fin_reelle = null; }   // une correction a ré-ouvert l'étape
      else if (pct > 0 && ['planifié', 'à planifier'].includes(statutAvant)) maj.statut = 'en cours';
      else if (pct === 0 && statutAvant === 'en cours') maj.statut = 'planifié';
      statutCourant[g.id] = maj.statut || statutAvant;
      const { error: mErr } = await supabase.from('gammes_operatoires').update(maj).eq('id', g.id);
      if (mErr) throw mErr;

      // Étape terminée : les créneaux encore prévus après ce jour n'ont plus lieu d'être.
      if (termine) {
        const { error: dErr } = await supabase.from('planning_jour').delete().eq('gamme_operatoire_id', g.id).gt('date', date).neq('statut', 'terminé');
        if (dErr) throw dErr;
      }
      (parOf[g.of_id] ??= []).push(g.id);
      resultats.push({ gamme_id: g.id, operation: g.operations.nom, of: g.ordres_fabrication.numero, avancement_pct: pct, terminee: termine });
    }

    // Correction d'un jour passé : on recale à partir d'aujourd'hui, jamais dans le passé.
    const dateRecalage = [dateGlobale, ...saisies.map((x) => x.date).filter(valide)].reduce((m, d) => (d > m ? d : m), aujourdhui);
    const recalages = [];
    for (const [ofId, gids] of Object.entries(parOf)) {
      const { data: of } = await supabase.from('ordres_fabrication').select('numero').eq('id', ofId).single();
      let recalage = null;
      if (recaler) {
        try { recalage = await recalerSiRetard(supabase, ofId, dateRecalage, gids, planifier.handler); }
        catch (e) { recalage = { retard: true, applique: false, raison: e.message }; }
      }
      const av = await majAvancementOf(supabase, ofId);
      recalages.push({ of_id: ofId, numero: of ? of.numero : '', avancement_of: av ? av.avancement_pct : null, recalage });
    }

    console.log(`saisir-production : ${saisies.length} saisie(s), ${Date.now() - t0} ms`);
    return { statusCode: 200, body: JSON.stringify({ date, etapes: resultats, ofs: recalages }) };
  } catch (e) {
    console.error('saisir-production error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || String(e) }) };
  }
};
