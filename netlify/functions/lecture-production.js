// functions/lecture-production.js
//
// GET /.netlify/functions/lecture-production?date=AAAA-MM-JJ
//     -> tâches planifiées ce jour-là, avec leur avancement et la saisie déjà faite (écran de fin de journée)
// GET /.netlify/functions/lecture-production?of_id=...
//     -> jauges d'un OF : avancement global et par opération, prévu vs réalisé

const { getSupabase } = require('./lib/supabaseclient');
const { avancementOf, dureeCreneau } = require('./lib/recalage');
let etapesBloquees = () => ({});
try { ({ etapesBloquees } = require('./lib/dependances')); } catch (e) { console.warn('lib/dependances.js introuvable.', e.message); }

const hhmm = (t) => (t ? String(t).slice(0, 5) : null);
const nombre = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const SEL_GAMME = 'id, of_id, sequence, statut, avancement_pct, quantite_realisee, parametres, operations(nom), machines(nom), ordres_fabrication(numero, quantite, titres(nom, client))';
const versTache = (g, saisie) => { const of = g.ordres_fabrication || {};
  return { gamme_id: g.id, of_id: g.of_id, of: of.numero || '', titre: (of.titres && of.titres.nom) || '', client: (of.titres && of.titres.client) || '',
    operation: g.operations ? g.operations.nom : '', machine: g.machines ? g.machines.nom : 'Travail manuel', statut: g.statut,
    quantite_totale: nombre(g.parametres && g.parametres.quantite) || of.quantite || null, quantite_realisee: nombre(g.quantite_realisee) || 0,
    avancement_pct: Math.round(Number(g.avancement_pct || 0) * 10) / 10, debut: null, fin: null, personnel: [], personnel_ids: [], saisie: saisie || null, bloquee_par: [] }; };

const handlerProtege = async (event) => {
  try {
    const p = event.queryStringParameters || {};
    const supabase = getSupabase();

    if (p.gamme_id) {
      // Une étape et tout l'historique de ses saisies (pour les corriger depuis la fenêtre d'avancement de l'OF).
      const { data: g, error: gE } = await supabase.from('gammes_operatoires')
        .select('id, of_id, sequence, statut, avancement_pct, quantite_realisee, parametres, date_fin_reelle, operations(nom), machines(nom), ordres_fabrication(numero, quantite, titres(nom, client))').eq('id', p.gamme_id).maybeSingle();
      if (gE) throw gE;
      if (!g) return { statusCode: 404, body: JSON.stringify({ error: 'Étape introuvable.' }) };
      const [hRes, tRes, cRes] = await Promise.all([
        supabase.from('production_jour').select('date, quantite, pct_cumule, termine, heures_reelles, commentaire').eq('gamme_operatoire_id', g.id).order('date'),
        supabase.from('gammes_operatoires').select('id, sequence, statut, predecesseurs, dependances, operations(nom)').eq('of_id', g.of_id),
        supabase.from('planning_jour').select('date, heure_debut, heure_fin').eq('gamme_operatoire_id', g.id).neq('statut', 'annulé'),
      ]);
      for (const r of [hRes, tRes, cRes]) if (r.error) throw r.error;
      const of = g.ordres_fabrication || {};
      const dates = cRes.data.map((c) => c.date).sort();
      return { statusCode: 200, body: JSON.stringify({
        tache: { gamme_id: g.id, of_id: g.of_id, of: of.numero || '', titre: (of.titres && of.titres.nom) || '', client: (of.titres && of.titres.client) || '',
          operation: g.operations ? g.operations.nom : '', machine: g.machines ? g.machines.nom : 'Travail manuel', statut: g.statut,
          quantite_totale: nombre(g.parametres && g.parametres.quantite) || of.quantite || null, quantite_realisee: nombre(g.quantite_realisee) || 0,
          avancement_pct: Math.round(Number(g.avancement_pct || 0) * 10) / 10, bloquee_par: etapesBloquees(tRes.data)[g.id] || [],
          debut_prevu: dates[0] || null, fin_prevue: dates[dates.length - 1] || null },
        historique: hRes.data,
      }) };
    }

    if (p.of_id) {
      const av = await avancementOf(supabase, p.of_id);
      if (!av) return { statusCode: 404, body: JSON.stringify({ error: 'OF introuvable.' }) };
      const { data: of } = await supabase.from('ordres_fabrication').select('numero, quantite, delai, statut, titres(nom, client)').eq('id', p.of_id).single();
      const ids = av.calcul.etapes.map((e) => e.gamme_id);
      const [gRes, cRes] = await Promise.all([
        supabase.from('gammes_operatoires').select('id, statut, avancement_pct, quantite_realisee, parametres, date_fin_reelle, machines(nom)').in('id', ids),
        supabase.from('planning_jour').select('gamme_operatoire_id, date, heure_debut, heure_fin').in('gamme_operatoire_id', ids).neq('statut', 'annulé'),
      ]);
      if (gRes.error) throw gRes.error; if (cRes.error) throw cRes.error;
      const aujourdhui = new Date().toISOString().slice(0, 10);
      const etapes = av.calcul.etapes.map((e) => {
        const g = gRes.data.find((x) => x.id === e.gamme_id) || {};
        const cs = cRes.data.filter((c) => c.gamme_operatoire_id === e.gamme_id);
        const total = cs.reduce((s, c) => s + dureeCreneau(c), 0);
        const faitPrevu = cs.filter((c) => c.date <= aujourdhui).reduce((s, c) => s + dureeCreneau(c), 0);
        const dates = cs.map((c) => c.date).sort();
        const pct = g.statut === 'terminé' ? 100 : Number(g.avancement_pct || 0);
        const prevu = g.statut === 'terminé' ? 100 : (total ? Math.round((faitPrevu / total) * 100) : 0);
        return {
          gamme_id: e.gamme_id, sequence: e.sequence, operation: e.operation, statut: g.statut || e.statut,
          machine: g.machines ? g.machines.nom : null,
          avancement_pct: Math.round(pct * 10) / 10, prevu_pct: prevu, en_retard: pct + 2 < prevu,
          quantite_realisee: nombre(g.quantite_realisee) || 0, quantite_totale: nombre(g.parametres && g.parametres.quantite) || (of && of.quantite) || null,
          debut_prevu: dates[0] || null, fin_prevue: dates[dates.length - 1] || null, fin_reelle: g.date_fin_reelle || null,
          poids_h: e.total_h,
        };
      });
      return { statusCode: 200, body: JSON.stringify({ of: { id: p.of_id, ...(of || {}) }, avancement_global: av.tous_termines ? 100 : av.global, etapes }) };
    }

    if (p.chercher !== undefined) {
      // Recherche d'une opération à ajouter à une fiche : par n° d'OF ou titre ; seules les étapes non terminées sont proposées.
      const q = String(p.chercher || '').trim().replace(/[%,()*]/g, ' ').trim();
      if (q.length < 2) return { statusCode: 200, body: JSON.stringify({ resultats: [] }) };
      const [tRes, oNum] = await Promise.all([
        supabase.from('titres').select('id').ilike('nom', `%${q}%`).limit(30),
        supabase.from('ordres_fabrication').select('id').ilike('numero', `%${q}%`).limit(30),
      ]);
      if (tRes.error) throw tRes.error; if (oNum.error) throw oNum.error;
      let ofIds = oNum.data.map((x) => x.id);
      if (tRes.data.length) {
        const oT = await supabase.from('ordres_fabrication').select('id').in('titre_id', tRes.data.map((x) => x.id)).limit(60);
        if (oT.error) throw oT.error;
        ofIds = [...new Set([...ofIds, ...oT.data.map((x) => x.id)])];
      }
      if (!ofIds.length) return { statusCode: 200, body: JSON.stringify({ resultats: [] }) };
      const { data: gs, error: gErr } = await supabase.from('gammes_operatoires').select(SEL_GAMME)
        .in('of_id', ofIds.slice(0, 60)).neq('statut', 'terminé').order('sequence');
      if (gErr) throw gErr;
      const resultats = gs.slice(0, 40).map((g) => versTache(g));
      return { statusCode: 200, body: JSON.stringify({ resultats }) };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || '')) return { statusCode: 400, body: JSON.stringify({ error: 'Paramètre date ou of_id requis.' }) };
    const { data: creneaux, error } = await supabase.from('planning_jour')
      .select('id, heure_debut, heure_fin, phase, gamme_operatoire_id, of_id, personnel_id, machines(nom), operations(nom), ordres_fabrication(numero, quantite, titres(nom, client)), planning_jour_personnel(personnel_id)')
      .eq('date', p.date).neq('statut', 'annulé').not('gamme_operatoire_id', 'is', null).order('heure_debut', { nullsFirst: true });
    if (error) throw error;
    const gids = [...new Set(creneaux.map((c) => c.gamme_operatoire_id))];
    const [gRes, prodRes, persRes, ligRes] = await Promise.all([
      gids.length ? supabase.from('gammes_operatoires').select('id, statut, avancement_pct, quantite_realisee, parametres').in('id', gids) : { data: [] },
      gids.length ? supabase.from('production_jour').select('*').eq('date', p.date).in('gamme_operatoire_id', gids) : { data: [] },
      supabase.from('personnel').select('id, nom, actif, numero_badge').then((r) => (r.error && /numero_badge|actif/.test(r.error.message || '') ? supabase.from('personnel').select('id, nom') : r)),
      supabase.from('production_jour_personne').select('*').eq('date', p.date).then((r) => (r.error ? { data: [], error: null } : r)),   // table absente (migration 47) : saisie globale seulement
    ]);
    const lignesPers = ligRes.data || [];
    for (const r of [gRes, prodRes, persRes]) if (r.error) throw r.error;
    const nom = Object.fromEntries(persRes.data.map((x) => [x.id, x.nom]));
    // Étapes qui attendent la fin d'une étape précédente non terminée : elles ne peuvent pas être déclarées terminées.
    const ofIds = [...new Set(creneaux.map((c) => c.of_id).filter(Boolean))];
    let bloquees = {};
    if (ofIds.length) {
      const { data: toutes, error: gErr } = await supabase.from('gammes_operatoires').select('id, sequence, statut, predecesseurs, dependances, of_id, operations(nom)').in('of_id', ofIds);
      if (gErr) throw gErr;
      ofIds.forEach((id) => { Object.assign(bloquees, etapesBloquees(toutes.filter((g) => g.of_id === id))); });
    }

    const taches = gids.map((gid) => {
      const cs = creneaux.filter((c) => c.gamme_operatoire_id === gid);
      const c0 = cs[0], g = gRes.data.find((x) => x.id === gid) || {};
      const debuts = cs.map((c) => hhmm(c.heure_debut)).filter(Boolean).sort(), fins = cs.map((c) => hhmm(c.heure_fin)).filter(Boolean).sort();
      const pers = [...new Set(cs.flatMap((c) => [c.personnel_id, ...(c.planning_jour_personnel || []).map((l) => l.personnel_id)]).filter(Boolean))];
      const sais = prodRes.data.find((x) => x.gamme_operatoire_id === gid) || null;
      const of = c0.ordres_fabrication || {};
      return {
        gamme_id: gid, of_id: c0.of_id, of: of.numero || '', titre: (of.titres && of.titres.nom) || '', client: (of.titres && of.titres.client) || '',
        operation: (c0.operations && c0.operations.nom) || c0.phase || '', machine: c0.machines ? c0.machines.nom : 'Travail manuel',
        debut: debuts[0] || null, fin: fins[fins.length - 1] || null, personnel: pers.map((id) => nom[id]).filter(Boolean), personnel_ids: pers,
        quantite_totale: nombre(g.parametres && g.parametres.quantite) || of.quantite || null,
        avancement_pct: Math.round(Number(g.avancement_pct || 0) * 10) / 10, quantite_realisee: nombre(g.quantite_realisee) || 0,
        statut: g.statut || '', saisie: sais, bloquee_par: bloquees[gid] || [],
      };
    });
    // Tâches saisies ce jour-là mais non planifiées ce jour-là : elles doivent aussi apparaître pour être corrigées.
    const manquants = [...new Set(lignesPers.map((l) => l.gamme_operatoire_id).filter((id) => !gids.includes(id)))];
    if (manquants.length) {
      const [gx, px] = await Promise.all([
        supabase.from('gammes_operatoires').select(SEL_GAMME).in('id', manquants),
        supabase.from('production_jour').select('*').eq('date', p.date).in('gamme_operatoire_id', manquants),
      ]);
      if (gx.error) throw gx.error;
      (gx.data || []).forEach((g) => taches.push(versTache(g, ((px.data || []).find((x) => x.gamme_operatoire_id === g.id)) || null)));
    }
    // Lignes déjà saisies par personne (y compris pour une tâche d'un autre jour planifiée), pour pré-remplir et corriger.
    const lignesJour = lignesPers.map((l) => ({ gamme_id: l.gamme_operatoire_id, personnel_id: l.personnel_id, quantite: nombre(l.quantite) || 0,
      heures_reglage: nombre(l.heures_reglage), heures_production: nombre(l.heures_production), pct_cumule: nombre(l.pct_cumule), termine: !!l.termine, commentaire: l.commentaire || '' }));
    const personnes = persRes.data.filter((x) => x.actif !== false).map((x) => ({ id: x.id, nom: x.nom, badge: x.numero_badge || '' })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    return { statusCode: 200, body: JSON.stringify({ date: p.date, taches, personnes, lignes: lignesJour }) };
  } catch (e) {
    console.error('lecture-production error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || String(e) }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
