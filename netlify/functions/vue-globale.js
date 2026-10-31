// functions/vue-globale.js
//
// Vue globale de la charge de travail (Reporting). Lecture seule : aucune donnée n'est modifiée.
//
// GET ?section=calendrier&debut=AAAA-MM-JJ&fin=AAAA-MM-JJ      (au plus 400 jours)
//   -> { periode, capacite:{machines, personnel}, jours:{ 'AAAA-MM-JJ': { machine_h, pers_h, cap_pers_h, cap_machine_h, charge,
//        creneaux, nb_of, absents, machines_arret, heures_jour (8 | 10 heures sup | 6 samedi travaillé | 0), mode } }, par_machine:[{ id, nom, heures, jours_actifs, par_jour? }],
//        interventions:[…], absences:[{ personnel, date, statut }],
//        creneaux?:[…] }   (liste détaillée des créneaux seulement si la période ne dépasse pas 8 jours)
// GET ?section=of
//   -> { aujourdhui, seuils, of_en_cours:[{ id, numero, titre, client, statut, priorite, delai, avancement, attendu, niveau, raison,
//        fin_prevue, heures_planifiees }], echeances:[…], a_planifier:{ heures, nb_of } }
//
// « Charge d'un jour » = le plus élevé de : heures-personnes planifiées ÷ capacité de l'équipe (présents × 8 h)
// et heures-machines planifiées ÷ capacité du parc (machines actives, hors intervention bloquante, × 8 h). Week-ends : capacité nulle.

const { getSupabase } = require('./lib/supabaseclient');
const C = require('./lib/charge');

const rep = (code, o) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const aujourdhuiParis = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
const ajouterJours = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const arrondi = (x) => Math.round(x * 10) / 10;
const NON_DISPONIBLE = new Set(['absent', 'congé', 'conge', 'formation', 'maladie', 'en arrêt', 'en arret']);

// Lit toutes les lignes d'une requête paginée (PostgREST limite chaque réponse à 1000 lignes).
async function toutLire(construire) {
  const out = [];
  for (let page = 0; page < 30; page++) {
    const { data, error } = await construire(page * 1000, page * 1000 + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
const paquets = (liste, n) => { const r = []; for (let i = 0; i < liste.length; i += n) r.push(liste.slice(i, i + n)); return r; };

async function sectionCalendrier(supabase, debut, fin) {
  const [machinesRes, personnelRes] = await Promise.all([
    supabase.from('machines').select('id, nom').eq('actif', true).order('nom'),
    supabase.from('personnel').select('id, nom').eq('actif', true),
  ]);
  if (machinesRes.error) throw machinesRes.error;
  if (personnelRes.error) throw personnelRes.error;
  const machines = machinesRes.data, personnel = personnelRes.data;
  const nomPers = Object.fromEntries(personnel.map((p) => [p.id, p.nom]));

  const planning = await toutLire((a, b) => supabase.from('planning_jour')
    .select('id, date, heure_debut, heure_fin, phase, machine_id, personnel_id, of_id, statut, planning_jour_personnel(personnel_id)')
    .gte('date', debut).lte('date', fin).order('date').range(a, b));
  const dispo = await toutLire((a, b) => supabase.from('personnel_planning_jour')
    .select('personnel_id, date, statut').gte('date', debut).lte('date', fin).range(a, b));
  let interventions = [];
  try {
    const { data, error } = await supabase.from('maintenance_machine').select('*').neq('statut', 'terminé');
    if (!error) interventions = (data || []).filter((m) => m.date_debut <= fin && (!m.date_fin || m.date_fin >= debut));
  } catch (e) { /* table absente : pas d'interventions */ }
  const nomMachine = Object.fromEntries(machines.map((m) => [m.id, m.nom]));

  // Jours de la période
  const jours = {};
  for (let d = debut; d <= fin; d = ajouterJours(d, 1)) {
    jours[d] = { machine_h: 0, pers_h: 0, creneaux: 0, ofs: new Set(), absents: 0, machines_arret: 0 };
  }
  const absences = [];
  dispo.forEach((x) => {
    if (!jours[x.date] || !NON_DISPONIBLE.has(String(x.statut || '').toLowerCase())) return;
    if (!nomPers[x.personnel_id]) return;
    jours[x.date].absents += 1;
    absences.push({ personnel: nomPers[x.personnel_id], date: x.date, statut: x.statut });
  });
  const arretJour = {};   // machine bloquée par une intervention, jour par jour
  interventions.filter((m) => m.bloquant !== false).forEach((m) => {
    for (let d = m.date_debut > debut ? m.date_debut : debut; d <= fin && (!m.date_fin || d <= m.date_fin); d = ajouterJours(d, 1)) {
      (arretJour[d] ??= new Set()).add(m.machine_id);
    }
  });
  const parMachine = Object.fromEntries(machines.map((m) => [m.id, { id: m.id, nom: m.nom, heures: 0, jours: new Set(), par_jour: {} }]));
  const detail = [];
  const listeJour = {};   // créneaux de chaque jour : sert à savoir si le jour est en heures sup ou si le samedi est ouvert
  const matrice = (Date.parse(fin) - Date.parse(debut)) / 86400000 <= 7;
  planning.forEach((c) => {
    const j = jours[c.date]; if (!j) return;
    const h = C.heuresCreneau(c);
    const ids = (c.planning_jour_personnel || []).map((l) => l.personnel_id);
    const pers = ids.length ? ids : (c.personnel_id ? [c.personnel_id] : []);
    j.creneaux += 1; if (c.of_id) j.ofs.add(c.of_id);
    (listeJour[c.date] ??= []).push(c);
    j.pers_h += h * pers.length;
    if (c.machine_id) {
      j.machine_h += h;
      const pm = parMachine[c.machine_id];
      if (pm) { pm.heures += h; pm.jours.add(c.date); if (matrice) pm.par_jour[c.date] = (pm.par_jour[c.date] || 0) + h; }
    }
    if (matrice) detail.push({ id: c.id, date: c.date, heure_debut: c.heure_debut ? String(c.heure_debut).slice(0, 5) : null, heure_fin: c.heure_fin ? String(c.heure_fin).slice(0, 5) : null,
      phase: c.phase || null, machine_id: c.machine_id || null, machine: c.machine_id ? (nomMachine[c.machine_id] || '?') : null, of_id: c.of_id || null, statut: c.statut,
      personnel: pers.map((p) => nomPers[p]).filter(Boolean), heures: arrondi(h) });
  });

  // Capacités et charge de chaque jour
  Object.entries(jours).forEach(([d, j]) => {
    const hj = C.heuresOuvertes(d, listeJour[d]);   // 8 h (lun-ven), 10 h (heures sup), 6 h (samedi travaillé), 0 sinon
    const ouvre = hj > 0;
    j.heures_jour = hj;
    j.mode = hj === 10 ? 'heures_sup' : (hj === 6 ? 'samedi' : (hj === 8 ? 'normal' : 'ferme'));
    j.machines_arret = ouvre ? (arretJour[d] ? Array.from(arretJour[d]).filter((id) => nomMachine[id]).length : 0) : 0;
    j.cap_pers_h = ouvre ? Math.max(0, personnel.length - j.absents) * hj : 0;
    j.cap_machine_h = ouvre ? Math.max(0, machines.length - j.machines_arret) * hj : 0;
    j.charge = C.chargeJour(j);
    j.nb_of = j.ofs.size; delete j.ofs;
    j.machine_h = arrondi(j.machine_h); j.pers_h = arrondi(j.pers_h);
  });

  // Noms des OF (liste détaillée seulement)
  if (detail.length) {
    const ids = Array.from(new Set(detail.map((x) => x.of_id).filter(Boolean)));
    const noms = {};
    for (const lot of paquets(ids, 40)) {
      const { data, error } = await supabase.from('ordres_fabrication').select('id, numero, titres(nom)').in('id', lot);
      if (error) throw error;
      (data || []).forEach((o) => { noms[o.id] = { numero: o.numero, titre: o.titres ? o.titres.nom : '' }; });
    }
    detail.forEach((x) => { const o = noms[x.of_id]; x.of_numero = o ? o.numero : null; x.titre = o ? o.titre : ''; });
  }

  return {
    periode: { debut, fin },
    capacite: { machines: machines.length, personnel: personnel.length, heures_jour: C.HEURES_JOUR },
    jours,
    par_machine: Object.values(parMachine).map((m) => ({ id: m.id, nom: m.nom, heures: arrondi(m.heures), jours_actifs: m.jours.size, ...(matrice ? { par_jour: Object.fromEntries(Object.entries(m.par_jour).map(([d, h]) => [d, arrondi(h)])) } : {}) }))
      .sort((a, b) => b.heures - a.heures || a.nom.localeCompare(b.nom, 'fr')),
    interventions: interventions.map((m) => ({ machine: nomMachine[m.machine_id] || '?', type: m.type, date_debut: m.date_debut, date_fin: m.date_fin, bloquant: m.bloquant !== false, description: m.description || '' })),
    absences,
    ...(matrice ? { creneaux: detail.sort((a, b) => (a.date + (a.heure_debut || '')).localeCompare(b.date + (b.heure_debut || ''))) } : {}),
  };
}

async function sectionOf(supabase) {
  const aujourdhui = aujourdhuiParis();
  const { data: ordres, error } = await supabase.from('ordres_fabrication')
    .select('*, titres(nom, client)').in('statut', ['en attente de validation', 'validé', 'en cours', 'en pause']);
  if (error) throw error;
  const ids = ordres.map((o) => o.id);

  const gammes = [], creneaux = [];
  for (const lot of paquets(ids, 40)) {
    const g = await toutLire((a, b) => supabase.from('gammes_operatoires').select('of_id, statut, duree_estimee_min').in('of_id', lot).range(a, b));
    gammes.push(...g);
    const c = await toutLire((a, b) => supabase.from('planning_jour').select('of_id, date, heure_debut, heure_fin').in('of_id', lot).range(a, b));
    creneaux.push(...c);
  }
  const gParOf = {}, cParOf = {};
  gammes.forEach((g) => { (gParOf[g.of_id] ??= []).push(g); });
  creneaux.forEach((c) => { (cParOf[c.of_id] ??= []).push({ date: c.date, heures: C.heuresCreneau(c) }); });

  const complet = ordres.map((o) => {
    const gs = gParOf[o.id] || [];
    const faites = gs.filter((g) => g.statut === 'terminé').length;
    const avancement = Number(o.avancement_pct) > 0 ? Math.round(Number(o.avancement_pct)) : (gs.length ? Math.round((faites / gs.length) * 100) : 0);
    const delai = o.delai ? String(o.delai).slice(0, 10) : null;
    const n = C.niveauOf({ avancement, delai, creneaux: cParOf[o.id] || [], cree_le: o.created_at }, aujourdhui);
    return {
      id: o.id, numero: o.numero, titre: o.titres ? o.titres.nom : '', client: o.titres ? o.titres.client : '', statut: o.statut, priorite: o.priorite,
      quantite: o.quantite, delai, avancement, attendu: n.attendu, niveau: n.niveau, raison: n.raison, fin_prevue: n.fin_prevue, heures_planifiees: n.heures_planifiees,
    };
  });
  const ordreNiveau = { rouge: 0, orange: 1, vert: 2 };
  const tri = (a, b) => ordreNiveau[a.niveau] - ordreNiveau[b.niveau] || String(a.delai || '9999').localeCompare(String(b.delai || '9999')) || a.numero.localeCompare(b.numero);
  const horizon = ajouterJours(aujourdhui, 14);

  // Charge en attente : étapes pas encore planifiées, à leur durée estimée (chiffrage).
  const aPlanifier = gammes.filter((g) => g.statut === 'à planifier');
  const ofAvecReste = new Set(aPlanifier.map((g) => g.of_id));
  return {
    aujourdhui, seuils: C.SEUILS,
    of_en_cours: complet.filter((o) => o.statut === 'en cours' || o.statut === 'en pause').sort(tri),
    echeances: complet.filter((o) => o.delai && o.delai >= aujourdhui && o.delai <= horizon && o.avancement < 100).sort((a, b) => a.delai.localeCompare(b.delai) || tri(a, b)),
    a_planifier: { heures: arrondi(aPlanifier.reduce((s, g) => s + (Number(g.duree_estimee_min) || 0), 0) / 60), nb_of: ofAvecReste.size, etapes: aPlanifier.length },
  };
}

const handlerProtege = async (event) => {
  try {
    const q = event.queryStringParameters || {};
    const supabase = getSupabase();
    if (q.section === 'of') return rep(200, await sectionOf(supabase));
    if (!q.section || q.section === 'calendrier') {
      if (!ISO.test(q.debut || '') || !ISO.test(q.fin || '')) return rep(400, { error: 'Paramètres debut et fin requis (AAAA-MM-JJ).' });
      if (q.fin < q.debut) return rep(400, { error: 'La date de fin précède la date de début.' });
      if ((Date.parse(q.fin) - Date.parse(q.debut)) / 86400000 > 400) return rep(400, { error: 'Période trop longue (400 jours au plus).' });
      return rep(200, await sectionCalendrier(supabase, q.debut, q.fin));
    }
    return rep(400, { error: 'Section inconnue.' });
  } catch (err) {
    return rep(500, { error: err.message });
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
