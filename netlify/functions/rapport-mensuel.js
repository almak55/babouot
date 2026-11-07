// functions/rapport-mensuel.js
//
// GET /.netlify/functions/rapport-mensuel?mois=AAAA-MM
//
// Données du rapport mensuel d'activité (Reporting) : situation de l'atelier sur un mois — charge de travail, OF et respect des délais,
// charge par machine et par semaine, livraisons Pléiade, points d'attention. Lecture seule : aucune donnée n'est modifiée.
// Le mois peut être passé (bilan), en cours (avancement) ou à venir (prévisions) : « type » le précise.
//
// Réutilise le calcul de la vue globale de la charge (vue-globale.js) et les niveaux d'avancement des OF (lib/charge.js),
// pour que ce rapport donne les mêmes chiffres que l'écran. Aucun motif d'absence n'est lu ni transmis.

const { getSupabase } = require('./lib/supabaseclient');
const C = require('./lib/charge');
const vueGlobale = require('./vue-globale');   // chemin fixe : indispensable pour que Netlify (esbuild) inclue le module

const rep = (code, o) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
const aujourdhuiParis = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
const ajouterJours = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const arrondi = (x, d = 1) => { const f = Math.pow(10, d); return Math.round(x * f) / f; };
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const jourSem = (iso) => new Date(iso + 'T12:00:00Z').getUTCDay();   // 0 = dimanche
const paquets = (l, n) => { const r = []; for (let i = 0; i < l.length; i += n) r.push(l.slice(i, i + n)); return r; };

async function toutLire(construire) {
  const out = [];
  for (let page = 0; page < 40; page++) {
    const { data, error } = await construire(page * 1000, page * 1000 + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
async function facultatif(promesse) { try { const r = await promesse; return r.error ? null : (r.data || []); } catch (e) { return null; } }

// Résultat d'une autre fonction appelée en interne (événement sans en-têtes : pas de nouveau contrôle d'accès).
async function appelInterne(module, params) {
  const r = await module.handler({ httpMethod: 'GET', queryStringParameters: params });
  const corps = JSON.parse(r.body || '{}');
  if (r.statusCode >= 400) throw new Error(corps.error || `Erreur ${r.statusCode} (vue-globale)`);
  return corps;
}

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'GET') return rep(405, { error: 'Méthode non autorisée.' });
    const mois = (event.queryStringParameters || {}).mois || '';
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) return rep(400, { error: 'Paramètre mois requis (AAAA-MM).' });
    const supabase = getSupabase();
    const aujourdhui = aujourdhuiParis();
    const [an, mm] = mois.split('-').map(Number);
    const debut = `${mois}-01`;
    const fin = ajouterJours(`${an + (mm === 12 ? 1 : 0)}-${String(mm === 12 ? 1 : mm + 1).padStart(2, '0')}-01`, -1);
    const moisCourant = aujourdhui.slice(0, 7);
    const type = mois < moisCourant ? 'passe' : (mois === moisCourant ? 'en_cours' : 'prevision');

    // ---------- 1. Charge (même calcul que la vue globale) ----------
    const [cal, secOf] = await Promise.all([
      appelInterne(vueGlobale, { section: 'calendrier', debut, fin }),
      appelInterne(vueGlobale, { section: 'of' }).catch(() => null),
    ]);
    const jours = Object.keys(cal.jours).sort().map((d) => {
      const j = cal.jours[d];
      return { date: d, ouvert: j.heures_jour > 0, mode: j.mode, heures_jour: j.heures_jour, charge: j.charge, machine_h: j.machine_h, pers_h: j.pers_h,
        cap_machine_h: j.cap_machine_h, cap_pers_h: j.cap_pers_h, nb_of: j.nb_of, absents: j.absents, machines_arret: j.machines_arret, passe: d < aujourdhui };
    });
    const ouverts = jours.filter((j) => j.ouvert);
    const somme = (l, k) => l.reduce((s, j) => s + (Number(j[k]) || 0), 0);
    const tauxDe = (h, cap) => (cap > 0 ? h / cap : null);
    const totaux = {
      machine_h: arrondi(somme(ouverts, 'machine_h')), pers_h: arrondi(somme(ouverts, 'pers_h')),
      cap_machine_h: arrondi(somme(ouverts, 'cap_machine_h')), cap_pers_h: arrondi(somme(ouverts, 'cap_pers_h')),
    };
    totaux.taux_machines = tauxDe(totaux.machine_h, totaux.cap_machine_h);
    totaux.taux_personnel = tauxDe(totaux.pers_h, totaux.cap_pers_h);
    const taux = [totaux.taux_machines, totaux.taux_personnel].filter((x) => x !== null);
    totaux.charge = taux.length ? Math.max(...taux) : null;
    const chargesJour = ouverts.map((j) => j.charge).filter((x) => x !== null);
    const nbJoursOuvres = ouverts.filter((j) => jourSem(j.date) >= 1 && jourSem(j.date) <= 5).length;
    const stats = {
      jours_ouvres: nbJoursOuvres,
      jours_ecoules: ouverts.filter((j) => j.date < aujourdhui && jourSem(j.date) >= 1 && jourSem(j.date) <= 5).length,
      jours_surcharge: chargesJour.filter((x) => x > 1).length,
      jours_charge_forte: chargesJour.filter((x) => x >= 0.9 && x <= 1).length,
      jours_heures_sup: ouverts.filter((j) => j.mode === 'heures_sup').length,
      samedis_travailles: ouverts.filter((j) => j.mode === 'samedi').length,
      charge_max: chargesJour.length ? Math.max(...chargesJour) : null,
    };
    // semaines (lundi-dimanche, limitées au mois)
    const semaines = [];
    jours.forEach((j) => {
      const dec = (jourSem(j.date) + 6) % 7;                    // 0 = lundi
      const lundi = ajouterJours(j.date, -dec);
      let s = semaines.find((x) => x.lundi === lundi);
      if (!s) { s = { lundi, debut: j.date, fin: j.date, machine_h: 0, pers_h: 0, cap_machine_h: 0, cap_pers_h: 0 }; semaines.push(s); }
      s.fin = j.date; if (j.ouvert) { s.machine_h += j.machine_h; s.pers_h += j.pers_h; s.cap_machine_h += j.cap_machine_h; s.cap_pers_h += j.cap_pers_h; }
    });
    semaines.forEach((s) => {
      const t = [tauxDe(s.machine_h, s.cap_machine_h), tauxDe(s.pers_h, s.cap_pers_h)].filter((x) => x !== null);
      s.charge = t.length ? Math.max(...t) : null; s.passee = s.fin < aujourdhui;
      ['machine_h', 'pers_h', 'cap_machine_h', 'cap_pers_h'].forEach((k) => { s[k] = arrondi(s[k]); });
    });
    // machines
    const capMachine = somme(ouverts.filter((j) => jourSem(j.date) >= 1 && jourSem(j.date) <= 5), 'heures_jour');
    const machines = (cal.par_machine || []).filter((m) => m.heures > 0).map((m) => ({ nom: m.nom, heures: m.heures, jours_actifs: m.jours_actifs, capacite_h: capMachine, taux: capMachine > 0 ? m.heures / capMachine : null }))
      .sort((a, b) => b.heures - a.heures);
    const machinesInactives = (cal.par_machine || []).filter((m) => !(m.heures > 0)).length;
    const interventions = (cal.interventions || []).map((i) => ({ machine: i.machine, type: i.type, date_debut: i.date_debut, date_fin: i.date_fin, bloquant: i.bloquant }));
    const absentsJours = (cal.absences || []).length;
    const absentsMax = jours.reduce((m, j) => Math.max(m, j.absents || 0), 0);
    // capacité encore disponible (jours à venir du mois)
    const aVenir = ouverts.filter((j) => j.date >= aujourdhui);
    const libre = {
      jours_ouvres: aVenir.filter((j) => jourSem(j.date) >= 1 && jourSem(j.date) <= 5).length,
      pers_h: arrondi(Math.max(0, somme(aVenir, 'cap_pers_h') - somme(aVenir, 'pers_h'))),
      machine_h: arrondi(Math.max(0, somme(aVenir, 'cap_machine_h') - somme(aVenir, 'machine_h'))),
      cap_pers_h: arrondi(somme(aVenir, 'cap_pers_h')), cap_machine_h: arrondi(somme(aVenir, 'cap_machine_h')),
    };

    // ---------- 2. OF du mois ----------
    const planningMois = await toutLire((a, b) => supabase.from('planning_jour')
      .select('of_id, date, heure_debut, heure_fin, machine_id, personnel_id, planning_jour_personnel(personnel_id)').gte('date', debut).lte('date', fin).range(a, b));
    const heuresOf = {};   // heures du mois par OF : machine et personnes
    planningMois.forEach((c) => {
      if (!c.of_id) return;
      const h = C.heuresCreneau(c);
      const ids = (c.planning_jour_personnel || []).map((l) => l.personnel_id);
      const nb = (ids.length ? ids.length : (c.personnel_id ? 1 : 0));
      const x = (heuresOf[c.of_id] ??= { machine_h: 0, pers_h: 0 });
      if (c.machine_id) x.machine_h += h;
      x.pers_h += h * nb;
    });
    const idsMois = new Set(Object.keys(heuresOf));
    const echeances = await toutLire((a, b) => supabase.from('ordres_fabrication').select('id').gte('delai', debut).lte('delai', fin).neq('statut', 'annulé').range(a, b));
    echeances.forEach((o) => idsMois.add(o.id));
    const termines = await toutLire((a, b) => supabase.from('gammes_operatoires').select('of_id').eq('statut', 'terminé').gte('date_fin_reelle', debut).lte('date_fin_reelle', fin).range(a, b));
    termines.forEach((g) => idsMois.add(g.of_id));

    const ids = Array.from(idsMois).filter(Boolean);
    const ordres = [], gammes = [], creneaux = [];
    for (const lot of paquets(ids, 40)) {
      const { data, error } = await supabase.from('ordres_fabrication').select('*, titres(nom, client)').in('id', lot);
      if (error) throw error;
      ordres.push(...(data || []));
      gammes.push(...await toutLire((a, b) => supabase.from('gammes_operatoires').select('of_id, statut, date_fin_reelle, duree_estimee_min').in('of_id', lot).range(a, b)));
      creneaux.push(...await toutLire((a, b) => supabase.from('planning_jour').select('of_id, date, heure_debut, heure_fin').in('of_id', lot).range(a, b)));
    }
    const gParOf = {}, cParOf = {};
    gammes.forEach((g) => { (gParOf[g.of_id] ??= []).push(g); });
    creneaux.forEach((c) => { (cParOf[c.of_id] ??= []).push({ date: String(c.date).slice(0, 10), heures: C.heuresCreneau(c) }); });
    const types = await facultatif(supabase.from('types_production').select('code, libelle'));
    const libelleType = Object.fromEntries((types || []).map((t) => [t.code, t.libelle]));

    const ofs = ordres.filter((o) => o.statut !== 'annulé').map((o) => {
      const gs = gParOf[o.id] || [];
      const faites = gs.filter((g) => g.statut === 'terminé').length;
      const avancement = o.statut === 'terminé' ? 100 : (Number(o.avancement_pct) > 0 ? Math.round(Number(o.avancement_pct)) : (gs.length ? Math.round((faites / gs.length) * 100) : 0));
      const delai = o.delai ? String(o.delai).slice(0, 10) : null;
      const fait = o.statut === 'terminé' || (gs.length > 0 && faites === gs.length) || avancement >= 100;
      const finReelle = fait ? (gs.map((g) => g.date_fin_reelle).filter(Boolean).map((d) => String(d).slice(0, 10)).sort().pop() || null) : null;
      const n = C.niveauOf({ avancement: fait ? 100 : avancement, delai, creneaux: cParOf[o.id] || [], cree_le: o.created_at }, aujourdhui);
      const h = heuresOf[o.id] || { machine_h: 0, pers_h: 0 };
      let situation;                                                      // ce que le patron doit voir d'un coup d'œil
      if (fait) situation = (delai && finReelle && finReelle > delai) ? 'livre_retard' : 'livre';
      else if (n.niveau === 'rouge') situation = 'retard';
      else if (n.niveau === 'orange') situation = 'risque';
      else situation = 'ok';
      const ecartJours = (!fait && delai && n.fin_prevue) ? C.ecartJours(n.fin_prevue, delai) : (fait && delai && finReelle ? C.ecartJours(finReelle, delai) : null);
      return {
        id: o.id, numero: o.numero, titre: o.titres ? o.titres.nom : '', client: o.titres ? o.titres.client : '', type_production: o.type_production || null,
        type_libelle: libelleType[o.type_production] || (o.type_production ? o.type_production : 'Autres'), quantite: o.quantite, priorite: o.priorite, statut: o.statut,
        delai, delai_dans_mois: !!(delai && delai >= debut && delai <= fin), avancement, fait, fin_reelle: finReelle, fin_prevue: n.fin_prevue, ecart_jours: ecartJours,
        situation, raison: n.raison, machine_h: arrondi(h.machine_h), pers_h: arrondi(h.pers_h), heures_planifiees_total: n.heures_planifiees, dans_planning_mois: !!heuresOf[o.id],
      };
    });
    const ordreSit = { retard: 0, risque: 1, ok: 2, livre_retard: 3, livre: 4 };
    ofs.sort((a, b) => ordreSit[a.situation] - ordreSit[b.situation] || String(a.delai || '9999').localeCompare(String(b.delai || '9999')) || a.numero.localeCompare(b.numero));

    const echeancesMois = ofs.filter((o) => o.delai_dans_mois);
    const compte = (l, f) => l.filter(f).length;
    const synthese = {
      nb_of_mois: ofs.length,
      echeances: echeancesMois.length,
      livres: compte(echeancesMois, (o) => o.situation === 'livre'),
      livres_retard: compte(echeancesMois, (o) => o.situation === 'livre_retard'),
      ok: compte(echeancesMois, (o) => o.situation === 'ok'),
      risque: compte(echeancesMois, (o) => o.situation === 'risque'),
      retard: compte(echeancesMois, (o) => o.situation === 'retard'),
      termines_dans_mois: compte(ofs, (o) => o.fait && o.fin_reelle && o.fin_reelle >= debut && o.fin_reelle <= fin),
      retard_tous: compte(ofs, (o) => o.situation === 'retard'),
      risque_tous: compte(ofs, (o) => o.situation === 'risque'),
    };
    const livresTotal = synthese.livres + synthese.livres_retard;
    synthese.taux_delais = livresTotal ? synthese.livres / livresTotal : null;
    // avancement de la production pondéré par les heures planifiées (OF du planning du mois)
    const pond = ofs.filter((o) => o.dans_planning_mois && o.heures_planifiees_total > 0);
    const poids = pond.reduce((s, o) => s + o.heures_planifiees_total, 0);
    const avancementMois = poids > 0 ? pond.reduce((s, o) => s + o.avancement * o.heures_planifiees_total, 0) / poids / 100 : null;
    const tempsEcoule = type === 'passe' ? 1 : (type === 'prevision' ? 0 : (stats.jours_ouvres ? stats.jours_ecoules / stats.jours_ouvres : 0));
    // répartition par type de travail
    const parTypeMap = {};
    ofs.filter((o) => o.dans_planning_mois).forEach((o) => {
      const t = (parTypeMap[o.type_libelle] ??= { type: o.type_libelle, nb_of: 0, machine_h: 0, pers_h: 0 });
      t.nb_of += 1; t.machine_h += o.machine_h; t.pers_h += o.pers_h;
    });
    const parType = Object.values(parTypeMap).map((t) => ({ ...t, machine_h: arrondi(t.machine_h), pers_h: arrondi(t.pers_h) })).sort((a, b) => b.pers_h - a.pers_h);

    // ---------- 3. Production saisie (mois écoulé) ----------
    let realise = null;
    if (type !== 'prevision') {
      const saisies = await facultatif(supabase.from('production_jour').select('date, heures_reelles, of_id').gte('date', debut).lte('date', fin).limit(5000));
      if (saisies) realise = {
        heures: arrondi(saisies.reduce((s, x) => s + (Number(x.heures_reelles) || 0), 0)), jours_saisis: new Set(saisies.map((x) => x.date)).size,
        nb_of: new Set(saisies.map((x) => x.of_id).filter(Boolean)).size,
      };
    }

    // ---------- 4. Livraisons Pléiade (planning annuel) ----------
    let pleiade = null;
    const pl = await facultatif(supabase.from('pleiade_annuel').select('statut, quantite, mois').eq('mois', mois));
    if (pl) {
      const q = (x) => Number(x.quantite) || 0;
      const g = (f) => pl.filter(f);
      pleiade = {
        titres: pl.length, exemplaires: pl.reduce((s, x) => s + q(x), 0),
        faits: g((x) => x.statut === 'fait').length, faits_ex: g((x) => x.statut === 'fait').reduce((s, x) => s + q(x), 0),
        en_cours: g((x) => ['of_cree', 'a_coudre', 'a_emboiter'].includes(x.statut)).length, en_cours_ex: g((x) => ['of_cree', 'a_coudre', 'a_emboiter'].includes(x.statut)).reduce((s, x) => s + q(x), 0),
        a_lancer: g((x) => x.statut === 'a_produire').length, a_lancer_ex: g((x) => x.statut === 'a_produire').reduce((s, x) => s + q(x), 0),
      };
    }

    // ---------- 5. Verdict et messages clés (courts) ----------
    const messages = [];
    let feu = 'vert';
    const monte = (n) => { if (n === 'rouge') feu = 'rouge'; else if (n === 'orange' && feu === 'vert') feu = 'orange'; };
    if (synthese.retard) { monte('rouge'); messages.push({ niveau: 'rouge', texte: `${synthese.retard} OF en retard sur délai ce mois-ci` }); }
    else if (synthese.retard_tous) { monte('orange'); messages.push({ niveau: 'orange', texte: `${synthese.retard_tous} OF en retard (échéance hors du mois)` }); }
    if (synthese.risque) { monte('orange'); messages.push({ niveau: 'orange', texte: `${synthese.risque} OF à risque pour leur délai` }); }
    if (stats.jours_surcharge >= 3) { monte('rouge'); messages.push({ niveau: 'rouge', texte: `${stats.jours_surcharge} jours en surcharge (> 100 %)` }); }
    else if (stats.jours_surcharge >= 1) { monte('orange'); messages.push({ niveau: 'orange', texte: `${stats.jours_surcharge} jour${stats.jours_surcharge > 1 ? 's' : ''} en surcharge (> 100 %)` }); }
    if (totaux.charge !== null && totaux.charge >= 0.9 && !stats.jours_surcharge) { monte('orange'); messages.push({ niveau: 'orange', texte: `Charge élevée : ${Math.round(totaux.charge * 100)} % de la capacité` }); }
    if (stats.jours_heures_sup || stats.samedis_travailles) messages.push({ niveau: 'orange', texte: `Heures supplémentaires prévues : ${stats.jours_heures_sup} jour(s), ${stats.samedis_travailles} samedi(s)` });
    const arrets = interventions.filter((i) => i.bloquant);
    if (arrets.length) messages.push({ niveau: 'orange', texte: `${arrets.length} machine(s) immobilisée(s) par une intervention : ${Array.from(new Set(arrets.map((i) => i.machine))).slice(0, 3).join(', ')}` });
    if (secOf && secOf.a_planifier && secOf.a_planifier.heures > 0) messages.push({ niveau: 'info', texte: `${secOf.a_planifier.nb_of} OF avec des étapes pas encore planifiées (${Math.round(secOf.a_planifier.heures)} h)` });
    if (!messages.length) messages.push({ niveau: 'vert', texte: 'Rien à signaler : charge maîtrisée et délais tenus' });

    return rep(200, {
      mois, type, libelle: `${MOIS_FR[mm - 1]} ${an}`, aujourdhui, periode: { debut, fin }, genere_le: new Date().toISOString(),
      feu, messages: messages.slice(0, 6), stats, totaux, avancement: { temps_ecoule: tempsEcoule, production: avancementMois },
      capacite: { machines: cal.capacite ? cal.capacite.machines : null, personnel: cal.capacite ? cal.capacite.personnel : null },
      jours, semaines, machines, machines_inactives: machinesInactives, interventions, absences: { jours_personnes: absentsJours, max_par_jour: absentsMax }, libre,
      synthese, ofs, par_type: parType, realise, pleiade, a_planifier: secOf ? secOf.a_planifier : null,
    });
  } catch (e) {
    console.error('rapport-mensuel error:', e);
    return rep(500, { error: e.message || String(e) });
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
