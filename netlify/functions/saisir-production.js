// functions/saisir-production.js
//
// POST /.netlify/functions/saisir-production
// body : {
//   date: 'AAAA-MM-JJ',                 // journée concernée (défaut : aujourd'hui)
//   saisies: [ {
//     gamme_id, personnel_id?,           // personnel_id présent (même null) = ligne de cette personne ; le total de la tâche est la somme des lignes
//     quantite?: number,                // produite CE JOUR-LÀ (unité de l'OF : exemplaires)
//     pct?: number,                     // OU avancement cumulé (0-100), pour les opérations sans quantité
//     termine?: boolean,                // l'étape est terminée
//     heures_reelles?, heures_reglage?, heures_production?, commentaire?
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
const { aujourdhuiParis } = require('./lib/debut-etape');
const { majAvancementOf, recalerSiRetard } = require('./lib/recalage');
const planifier = require('./planifier-of');
const journal = require('./lib/journal');

const nombre = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

// Production saisie PAR PERSONNE : on écrit la ligne de la personne, puis production_jour = somme des lignes de la tâche ce jour-là.
async function ecrirePersonne(supabase, g, date, s, v) {
  const T = 'production_jour_personne';
  const pid = s.personnel_id || null;
  const filtre = (q) => (pid ? q.eq('personnel_id', pid) : q.is('personnel_id', null));
  // Saisie globale antérieure (avant la saisie par personne) : conservée comme ligne « sans personne ».
  const { data: avant, error: aErr } = await supabase.from(T).select('id').eq('gamme_operatoire_id', g.id).eq('date', date).limit(1);
  if (aErr) throw new Error(/production_jour_personne/.test(aErr.message || '') ? 'La table production_jour_personne n\'existe pas : exécutez la migration 47 dans Supabase.' : aErr.message);
  if (!avant.length) {
    const { data: ancien } = await supabase.from('production_jour').select('*').eq('gamme_operatoire_id', g.id).eq('date', date).maybeSingle();
    if (ancien && (Number(ancien.quantite) || ancien.pct_cumule !== null || ancien.termine || ancien.heures_reelles)) {
      const { error: mErr } = await supabase.from(T).insert({ gamme_operatoire_id: g.id, of_id: g.of_id, date, personnel_id: null, quantite: Number(ancien.quantite) || 0,
        heures_reglage: ancien.heures_reglage ?? null, heures_production: ancien.heures_production ?? ancien.heures_reelles ?? null, pct_cumule: ancien.pct_cumule, termine: !!ancien.termine, commentaire: ancien.commentaire || null });
      if (mErr) throw mErr;
    }
  }
  if (s.supprimer) {
    const { error } = await filtre(supabase.from(T).delete().eq('gamme_operatoire_id', g.id).eq('date', date)); if (error) throw error;
  } else {
    const ligne = { gamme_operatoire_id: g.id, of_id: g.of_id, date, personnel_id: pid, quantite: v.quantite ?? 0, heures_reglage: v.hReg, heures_production: v.hProd,
      pct_cumule: v.pct, termine: !!s.termine, commentaire: s.commentaire || null, updated_at: new Date().toISOString() };
    const { data: ex, error: eErr } = await filtre(supabase.from(T).select('id').eq('gamme_operatoire_id', g.id).eq('date', date)).limit(1);
    if (eErr) throw eErr;
    const { error } = ex.length ? await supabase.from(T).update(ligne).eq('id', ex[0].id) : await supabase.from(T).insert(ligne);
    if (error) throw error;
  }
  const { data: toutes, error: tErr } = await supabase.from(T).select('*').eq('gamme_operatoire_id', g.id).eq('date', date);
  if (tErr) throw tErr;
  if (!toutes.length) return { vide: true };
  const somme = (k) => toutes.reduce((t, l) => t + (Number(l[k]) || 0), 0);
  const aucune = (k) => toutes.every((l) => l[k] === null || l[k] === undefined);
  const r2 = (n) => Math.round(n * 100) / 100;
  const hr = aucune('heures_reglage') ? null : r2(somme('heures_reglage')), hp = aucune('heures_production') ? null : r2(somme('heures_production'));
  const pcts = toutes.map((l) => l.pct_cumule).filter((x) => x !== null && x !== undefined).map(Number);
  const coms = [...new Set(toutes.map((l) => (l.commentaire || '').trim()).filter(Boolean))];
  return { vide: false, ligne: {
    gamme_operatoire_id: g.id, of_id: g.of_id, date, quantite: r2(somme('quantite')), pct_cumule: pcts.length ? Math.max(...pcts) : null,
    termine: toutes.some((l) => l.termine), heures_reelles: hr === null && hp === null ? null : r2((hr || 0) + (hp || 0)),
    commentaire: coms.join(' | ') || null, updated_at: new Date().toISOString(), heures_reglage: hr, heures_production: hp } };
}

const handlerProtege = async (event) => {
  const t0 = Date.now();
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    const body = JSON.parse(event.body || '{}');
    const aujourdhuiP = aujourdhuiParis();
    // Une production ne peut pas être saisie pour un jour à venir : la date est ramenée à aujourd'hui.
    const borne = (d) => (d > aujourdhuiP ? aujourdhuiP : d);
    const dateGlobale = borne(/^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : aujourdhuiP);
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
    const aujourdhui = aujourdhuiP;
    const statutCourant = {};
    for (const s of saisies) {
      const date = borne(valide(s.date) ? s.date : dateGlobale);   // chaque saisie peut viser sa propre journée (correction d'un jour passé)
      const g = gammeDe[s.gamme_id];
      if (!g) { resultats.push({ gamme_id: s.gamme_id, erreur: 'Étape introuvable.' }); continue; }
      const quantite = nombre(s.quantite);
      const pctSaisi = nombre(s.pct);
      const parPersonne = Object.prototype.hasOwnProperty.call(s, 'personnel_id');
      const hReg = nombre(s.heures_reglage), hProd = nombre(s.heures_production);
      const seulementHeures = parPersonne && (hReg !== null || hProd !== null);
      if (!s.supprimer && quantite === null && pctSaisi === null && !s.termine && !seulementHeures) continue;   // rien saisi pour cette ligne
      if (quantite !== null && quantite < 0) { resultats.push({ gamme_id: s.gamme_id, erreur: 'Quantité négative.' }); continue; }
      if (pctSaisi !== null && (pctSaisi < 0 || pctSaisi > 100)) { resultats.push({ gamme_id: s.gamme_id, erreur: 'Avancement entre 0 et 100 %.' }); continue; }

      // Une étape qui attend la fin d'une étape précédente non terminée ne peut pas être déclarée terminée.
      if (s.termine || (pctSaisi !== null && pctSaisi >= 99.99)) {
        const { data: tout, error: tErr } = await supabase.from('gammes_operatoires').select('id, sequence, statut, predecesseurs, dependances, operations(nom)').eq('of_id', g.of_id);
        if (tErr) throw tErr;
        const bloq = etapesBloquees(tout)[g.id];
        if (bloq) { resultats.push({ gamme_id: g.id, operation: g.operations.nom, erreur: `${g.operations.nom} ne peut pas être terminée : elle attend la fin de ${bloq.join(', ')}.` }); continue; }
      }

      let ligne = {
        gamme_operatoire_id: g.id, of_id: g.of_id, date,
        quantite: quantite ?? 0, pct_cumule: pctSaisi, termine: !!s.termine,
        heures_reelles: nombre(s.heures_reelles), commentaire: s.commentaire || null, updated_at: new Date().toISOString(),
      };
      // Réglage et production comptés séparément (temps standards) ; heures_reelles = total si non fourni.
      let ligneDetail = { ...ligne, heures_reglage: hReg, heures_production: hProd };
      if (ligne.heures_reelles === null && (hReg !== null || hProd !== null)) { ligne.heures_reelles = Math.round(((hReg || 0) + (hProd || 0)) * 100) / 100; ligneDetail.heures_reelles = ligne.heures_reelles; }
      let effacer = !!s.supprimer;
      if (parPersonne) {   // une ligne par personne ; le total de la tâche est recalculé
        const agr = await ecrirePersonne(supabase, g, date, s, { quantite, pct: pctSaisi, hReg, hProd });
        if (agr.vide) effacer = true;
        else { effacer = false; ligneDetail = agr.ligne; ligne = { ...agr.ligne }; delete ligne.heures_reglage; delete ligne.heures_production; }
      }
      if (effacer) {
        const { error: delErr } = await supabase.from('production_jour').delete().eq('gamme_operatoire_id', g.id).eq('date', date);
        if (delErr) throw delErr;
      } else {
        let { error: upErr } = await supabase.from('production_jour').upsert(ligneDetail, { onConflict: 'gamme_operatoire_id,date' });
        // Migration 46 pas encore exécutée : on enregistre sans le détail réglage / production.
        if (upErr && /heures_reglage|heures_production/.test(upErr.message || '')) ({ error: upErr } = await supabase.from('production_jour').upsert(ligne, { onConflict: 'gamme_operatoire_id,date' }));
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

      // Journal de traçabilité : chaque saisie (et chaque correction) est conservée, même si la ligne de production est modifiée ensuite.
      const fmtH = (h) => (h === null || h === undefined ? null : `${String(h).replace('.', ',')} h`);
      const morceauxJ = [s.supprimer ? 'saisie supprimée' : null, quantite !== null && !s.supprimer ? `${quantite} ex.` : null, pctSaisi !== null && !s.supprimer ? `avancement ${pctSaisi} %` : null,
        hReg !== null ? `réglage ${fmtH(hReg)}` : null, hProd !== null ? `production ${fmtH(hProd)}` : null].filter(Boolean);
      await journal.noter(supabase, g.of_id, 'saisie',
        `${g.operations.nom} — ${date} : ${morceauxJ.join(', ') || 'saisie'}${s.commentaire ? ' — « ' + String(s.commentaire).slice(0, 160) + ' »' : ''}.`,
        { gamme_id: g.id, sequence: null, operation: g.operations.nom, date, quantite, pct: pctSaisi, heures_reglage: hReg, heures_production: hProd, heures_reelles: nombre(s.heures_reelles), personnel_id: parPersonne ? (s.personnel_id || null) : null, termine: !!s.termine, supprime: !!s.supprimer, commentaire: s.commentaire || null, avancement_etape: pct });
      if (termine && statutAvant !== 'terminé') await journal.noter(supabase, g.of_id, 'etape_terminee', `${g.operations.nom} terminée le ${date}.`, { gamme_id: g.id, operation: g.operations.nom, date });

      // Étape terminée : les créneaux encore prévus après ce jour n'ont plus lieu d'être.
      if (termine) {
        const { error: dErr } = await supabase.from('planning_jour').delete().eq('gamme_operatoire_id', g.id).gt('date', date).neq('statut', 'terminé');
        if (dErr) throw dErr;
      }
      (parOf[g.of_id] ??= []).push(g.id);
      resultats.push({ gamme_id: g.id, operation: g.operations.nom, of: g.ordres_fabrication.numero, avancement_pct: pct, terminee: termine });
    }

    // Correction d'un jour passé : on recale à partir d'aujourd'hui, jamais dans le passé.
    const dateRecalage = [dateGlobale, ...saisies.map((x) => x.date).filter(valide).map(borne)].reduce((m, d) => (d > m ? d : m), aujourdhui);
    const recalages = [];
    for (const [ofId, gids] of Object.entries(parOf)) {
      const { data: of } = await supabase.from('ordres_fabrication').select('numero').eq('id', ofId).single();
      let recalage = null;
      if (recaler) {
        try { recalage = await recalerSiRetard(supabase, ofId, dateRecalage, gids, planifier.handler); }
        catch (e) { recalage = { retard: true, applique: false, raison: e.message }; }
      }
      if (recalage && recalage.retard) {
        await journal.noter(supabase, ofId, 'recalage',
          recalage.applique
            ? `Retard constaté sur ${(recalage.retards || []).map((r) => r.operation).join(', ')} : planning recalé${recalage.nouvelle_fin ? ', nouvelle fin ' + String(recalage.nouvelle_fin).slice(0, 10) : ''}${recalage.delai_tenu === false ? ' — délai NON tenu' : (recalage.delai_tenu === true ? ' — délai tenu' : '')}.`
            : `Retard constaté sur ${(recalage.retards || []).map((r) => r.operation).join(', ')} : recalage impossible (${recalage.raison || 'raison inconnue'}).`,
          { retards: recalage.retards || [], applique: !!recalage.applique, ancienne_fin: recalage.ancienne_fin || null, nouvelle_fin: recalage.nouvelle_fin || null, delai: recalage.delai || null, delai_tenu: recalage.delai_tenu ?? null, retard_delai_min: recalage.retard_delai_min || 0, raison: recalage.raison || null });
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

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
