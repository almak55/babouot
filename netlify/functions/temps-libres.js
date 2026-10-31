// functions/temps-libres.js
//
// Temps libres du personnel et affectations « de remplissage ».
//
// GET  ?date=AAAA-MM-JJ[&horaires=normal|heures_sup]
//      -> { date, jour_ouvre, motif?, horaires:{debut,fin,pause_debut,pause_fin,plages:[[d,f]]},
//           personnes:[{ id, nom, poste, statut, indisponible, occupe:[{debut,fin,libelle,of,machine,ajout,id}], libres:[{debut,fin,minutes}], libre_total_min }],
//           ajouts:[{ ids, debut, fin, libelle, of, commentaire, personnes:[{id,nom}] }],   // affectations déjà ajoutées depuis cette fenêtre
//           ofs:[{ id, numero, titre, statut }], categories:[...] }
// GET  ?etapes_of=uuid
//      -> { etapes:[{ gamme_id, sequence, operation_id, operation, statut }] }
// POST { action:'affecter_of',    date, heure_debut, heure_fin, personnel_ids:[uuid], of_id, operation_id, commentaire?, horaires? }
//         affecte des personnes libres à une tâche qui figure sur un OF (ex. pose de rhodoïds, réparations d'emboîtage)
// POST { action:'affecter_libre', date, heure_debut, heure_fin, personnel_ids:[uuid], categorie?, libelle, commentaire?, horaires? }
//         affecte des personnes libres à un travail hors planning (tri, réparations d'anciens volumes…)
// POST { action:'supprimer', ids:[uuid] }
//         retire une affectation ajoutée depuis cette fenêtre (jamais un créneau du planning de production)
//
// Les créneaux créés sont de vraies lignes de planning_jour (couleur_code = 'temps_libre', sans étape ni machine) : ils apparaissent
// sur la feuille de placement, la page « Charge », et occupent la personne pour tous les contrôles et pour le calcul du planning.
// La pause déjeuner (12h00-12h30) coupe toujours un créneau en deux : aucune ligne ne l'enjambe.

const { getSupabase } = require('./lib/supabaseclient');
const PL = require('./lib/planification');
const { imposerPause } = require('./lib/horaires');

const MARQUE = 'temps_libre';
const MIN_LIBRE = 15;                                   // un trou plus court n'est pas proposé
const CATEGORIES = ['Tri', 'Réparations (anciens volumes)', 'Rangement atelier', 'Entretien atelier', 'Autre'];
const RESERVE = /nettoy|mise en route|\bMER\b/i;        // mots réservés au planning des machines (voir lib/nettoyage.js)

const rep = (statusCode, obj) => ({ statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(obj) });
const hm = (t) => { const [h, m] = String(t).slice(0, 5).split(':'); return Number(h) * 60 + Number(m); };
const hh = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const dateOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
const heureOk = (h) => /^\d{2}:\d{2}$/.test(String(h || '').slice(0, 5));
const inter = (a, b) => a[0] < b[1] && b[0] < a[1];

// Plages de travail du jour (en minutes depuis minuit) ; pause 12h00-12h30 toujours exclue.
async function horairesDuJour(supabase, date, mode) {
  const { data } = await supabase.from('calendrier_travail').select('*');
  const ligne = (data || []).find((c) => c.code === (mode === 'heures_sup' ? 'heures_sup' : 'normal'));
  const base = ligne ? imposerPause(ligne) : { heure_debut: mode === 'heures_sup' ? '07:00' : '08:00', heure_fin: mode === 'heures_sup' ? '17:30' : '16:30', pause_debut: '12:00', pause_minutes: 30 };
  const cal = { debut: String(base.heure_debut).slice(0, 5), fin: String(base.heure_fin).slice(0, 5), pause_debut: '12:00', pause_minutes: 30, samedi_debut: '06:00', samedi_fin: '12:00' };
  const jour = PL.enMinutes(date, '00:00');
  const dow = new Date(jour * 60000).getUTCDay();
  if (dow === 0) return { ouvert: false, motif: 'dimanche' };
  const ferie = PL.libelleFerie(date);
  if (ferie) return { ouvert: false, motif: `jour férié (${ferie})` };
  if (dow === 6) {   // le samedi n'est travaillé qu'exceptionnellement : on ne l'ouvre que si du travail y est déjà planifié
    const { data: deja, error } = await supabase.from('planning_jour').select('id').eq('date', date).neq('statut', 'annulé').limit(1);
    if (error) throw error;
    if (!deja || !deja.length) return { ouvert: false, motif: 'samedi non travaillé (aucun travail planifié ce jour-là)' };
  }
  const plages = PL.fenetresDuJour(jour, cal).map(([a, b]) => [a - jour, b - jour]);
  if (!plages.length) return { ouvert: false, motif: 'jour non travaillé' };
  const sansPause = dow === 6;
  return { ouvert: true, plages, debut: plages[0][0], fin: plages[plages.length - 1][1], pause_debut: sansPause ? null : 720, pause_fin: sansPause ? null : 750, dow };
}

// Retire de chaque plage les intervalles occupés (liste triée de [d,f]).
function soustraire(plages, occupes) {
  let res = plages.map((p) => [p[0], p[1]]);
  for (const o of occupes) {
    const suite = [];
    for (const p of res) {
      if (!inter(p, o)) { suite.push(p); continue; }
      if (p[0] < o[0]) suite.push([p[0], o[0]]);
      if (o[1] < p[1]) suite.push([o[1], p[1]]);
    }
    res = suite;
  }
  return res.filter((p) => p[1] - p[0] > 0).sort((a, b) => a[0] - b[0]);
}

// Lit tout ce qu'il faut pour savoir qui est occupé quand, ce jour-là.
async function etatDuJour(supabase, date) {
  const [persRes, planRes, absRes] = await Promise.all([
    supabase.from('personnel').select('id, nom, poste').eq('actif', true).order('nom'),
    supabase.from('planning_jour')
      .select('id, heure_debut, heure_fin, phase, statut, machine_id, personnel_id, of_id, operation_id, couleur_code, commentaire, machines(nom), operations(nom), ordres_fabrication(numero), planning_jour_personnel(personnel_id)')
      .eq('date', date).neq('statut', 'annulé'),
    supabase.from('personnel_planning_jour').select('personnel_id, statut, heure_debut, heure_fin, commentaire').eq('date', date),
  ]);
  for (const r of [persRes, planRes, absRes]) if (r.error) throw r.error;
  const equipe = (l) => Array.from(new Set([...(l.personnel_id ? [l.personnel_id] : []), ...((l.planning_jour_personnel || []).map((x) => x.personnel_id))]));
  const lignes = (planRes.data || []).map((l) => ({
    id: l.id, d: l.heure_debut ? hm(l.heure_debut) : null, f: l.heure_fin ? hm(l.heure_fin) : null,
    phase: l.phase || '', operation: (l.operations && l.operations.nom) || '', machine: l.machines ? l.machines.nom : '',
    of: (l.ordres_fabrication && l.ordres_fabrication.numero) || '', ajout: l.couleur_code === MARQUE, commentaire: l.commentaire || '',
    equipe: equipe(l),
  }));
  const abs = {}; (absRes.data || []).forEach((a) => { abs[a.personnel_id] = a; });
  return { personnel: persRes.data || [], lignes, abs };
}

const INDISPO = (s) => s && !['présent', 'disponible'].includes(String(s).toLowerCase());

// Occupations d'une personne ce jour-là : [{ d, f, libelle, id, ajout, of, machine }] ; `jourEntier` si absence sans horaire ou créneau sans horaire.
function occupationsDe(pid, etat) {
  const occ = []; let jourEntier = null;
  const a = etat.abs[pid];
  if (a && INDISPO(a.statut)) {
    if (a.heure_debut && a.heure_fin) occ.push({ d: hm(a.heure_debut), f: hm(a.heure_fin), libelle: String(a.statut).toUpperCase(), id: null, ajout: false, of: '', machine: '' });
    else jourEntier = String(a.statut);
  }
  for (const l of etat.lignes) {
    if (!l.equipe.includes(pid)) continue;
    if (l.d === null || l.f === null) { jourEntier = jourEntier || 'créneau sans horaire'; continue; }
    occ.push({ d: l.d, f: l.f, libelle: l.operation || l.phase || 'Tâche', id: l.id, ajout: l.ajout, of: l.of, machine: l.machine });
  }
  return { occ: occ.sort((x, y) => x.d - y.d), jourEntier };
}

async function lireJour(supabase, date, mode) {
  const h = await horairesDuJour(supabase, date, mode);
  if (!h.ouvert) return { date, jour_ouvre: false, motif: h.motif, personnes: [], ajouts: [], ofs: [], categories: CATEGORIES };
  const etat = await etatDuJour(supabase, date);
  const nomDe = Object.fromEntries(etat.personnel.map((p) => [p.id, p.nom]));
  const personnes = etat.personnel.map((p) => {
    const { occ, jourEntier } = occupationsDe(p.id, etat);
    const libres = jourEntier ? [] : soustraire(h.plages, occ.map((o) => [o.d, o.f])).filter((x) => x[1] - x[0] >= MIN_LIBRE);
    return {
      id: p.id, nom: p.nom, poste: p.poste || '', statut: etat.abs[p.id] ? etat.abs[p.id].statut : 'présent',
      indisponible: jourEntier,
      occupe: occ.map((o) => ({ debut: hh(o.d), fin: hh(o.f), libelle: o.libelle, of: o.of, machine: o.machine, ajout: o.ajout, id: o.id })),
      libres: libres.map((x) => ({ debut: hh(x[0]), fin: hh(x[1]), minutes: x[1] - x[0] })),
      libre_total_min: libres.reduce((t, x) => t + (x[1] - x[0]), 0),
    };
  });
  // Affectations ajoutées depuis cette fenêtre, regroupées (une tâche coupée par la pause = une seule ligne).
  const brutes = etat.lignes.filter((l) => l.ajout && l.d !== null).sort((a, b) => a.d - b.d);
  const ajouts = [];
  for (const l of brutes) {
    const cle = `${l.phase}|${l.of}|${l.commentaire}|${l.equipe.slice().sort().join(',')}`;
    const prec = ajouts.find((x) => x.cle === cle && h.pause_debut !== null && x.f === h.pause_debut && l.d === h.pause_fin);
    if (prec) { prec.ids.push(l.id); prec.f = l.f; continue; }
    ajouts.push({ cle, ids: [l.id], d: l.d, f: l.f, libelle: l.phase, of: l.of, commentaire: l.commentaire, personnes: l.equipe.map((id) => ({ id, nom: nomDe[id] || '?' })) });
  }
  const ofsRes = await supabase.from('ordres_fabrication').select('id, numero, statut, titres(nom, client)').in('statut', ['en attente de validation', 'validé', 'en cours', 'en pause']).order('numero');
  if (ofsRes.error) throw ofsRes.error;
  return {
    date, jour_ouvre: true,
    horaires: { debut: hh(h.debut), fin: hh(h.fin), pause_debut: h.pause_debut === null ? null : hh(h.pause_debut), pause_fin: h.pause_fin === null ? null : hh(h.pause_fin), plages: h.plages.map((p) => [hh(p[0]), hh(p[1])]) },
    personnes,
    ajouts: ajouts.map((x) => ({ ids: x.ids, debut: hh(x.d), fin: hh(x.f), libelle: x.libelle, of: x.of, commentaire: x.commentaire, personnes: x.personnes })),
    ofs: (ofsRes.data || []).map((o) => ({ id: o.id, numero: o.numero, statut: o.statut, titre: (o.titres && o.titres.nom) || '', client: (o.titres && o.titres.client) || '' })),
    categories: CATEGORIES,
  };
}

// Crée les créneaux (coupés à la pause) et les liens personnel. Retourne { ids }.
async function creer(supabase, b, mode, champs) {
  if (!dateOk(b.date)) return rep(400, { error: 'Date invalide.' });
  if (!heureOk(b.heure_debut) || !heureOk(b.heure_fin)) return rep(400, { error: 'Heures de début et de fin requises.' });
  const d = hm(b.heure_debut), f = hm(b.heure_fin);
  if (!(f > d)) return rep(400, { error: 'L\'heure de fin doit être après l\'heure de début.' });
  const ids = Array.from(new Set((Array.isArray(b.personnel_ids) ? b.personnel_ids : []).filter(Boolean)));
  if (!ids.length) return rep(400, { error: 'Choisissez au moins une personne.' });
  if (RESERVE.test(champs.phase || '')) return rep(400, { error: 'Les mots « nettoyage » et « mise en route » sont réservés au planning des machines : écrivez par exemple « Entretien atelier ».' });

  const h = await horairesDuJour(supabase, b.date, b.horaires === 'heures_sup' ? 'heures_sup' : mode);
  if (!h.ouvert) return rep(400, { error: `Ce jour n'est pas travaillé (${h.motif}).` });
  if (d < h.debut || f > h.fin) return rep(400, { error: `Horaires de l'atelier ce jour-là : ${hh(h.debut)}–${hh(h.fin)}${h.pause_debut === null ? '' : ` (pause ${hh(h.pause_debut)}–${hh(h.pause_fin)})`}.` });
  // Coupé par la pause : une ligne avant, une ligne après.
  const pieces = h.plages.map((p) => [Math.max(p[0], d), Math.min(p[1], f)]).filter((p) => p[1] - p[0] > 0);
  if (!pieces.length) return rep(400, { error: 'Ce créneau tombe entièrement dans la pause.' });

  const etat = await etatDuJour(supabase, b.date);
  const nomDe = Object.fromEntries(etat.personnel.map((p) => [p.id, p.nom]));
  const conflits = [];
  for (const pid of ids) {
    if (!nomDe[pid]) { conflits.push({ personne: pid, motif: 'personne inconnue ou inactive' }); continue; }
    const { occ, jourEntier } = occupationsDe(pid, etat);
    if (jourEntier) { conflits.push({ personne: nomDe[pid], motif: `indisponible (${jourEntier})` }); continue; }
    const gene = occ.find((o) => pieces.some((p) => inter(p, [o.d, o.f])));
    if (gene) conflits.push({ personne: nomDe[pid], motif: `déjà occupé(e) de ${hh(gene.d)} à ${hh(gene.f)} (${gene.libelle}${gene.of ? ' · ' + gene.of : ''})` });
  }
  if (conflits.length) return rep(409, { error: 'Au moins une personne n\'est pas libre sur ce créneau : ' + conflits.map((c) => `${c.personne} — ${c.motif}`).join(' ; '), conflits });

  const lignes = pieces.map((p) => ({
    date: b.date, heure_debut: hh(p[0]), heure_fin: hh(p[1]), phase: champs.phase, of_id: champs.of_id || null, operation_id: champs.operation_id || null,
    machine_id: null, gamme_operatoire_id: null, personnel_id: ids[0], statut: 'planifié', couleur_code: MARQUE, commentaire: champs.commentaire || null,
  }));
  const { data: crees, error } = await supabase.from('planning_jour').insert(lignes).select('id');
  if (error) throw error;
  const liens = []; crees.forEach((c) => ids.forEach((pid) => liens.push({ planning_jour_id: c.id, personnel_id: pid })));
  const { error: lErr } = await supabase.from('planning_jour_personnel').insert(liens);
  if (lErr) { await supabase.from('planning_jour').delete().in('id', crees.map((c) => c.id)); throw lErr; }
  const minutes = pieces.reduce((t, p) => t + (p[1] - p[0]), 0);
  return rep(200, { ok: true, ids: crees.map((c) => c.id), lignes: pieces.length, minutes_travail: minutes, personnes: ids.length });
}

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();
    const q = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
      if (q.etapes_of) {
        const { data, error } = await supabase.from('gammes_operatoires').select('id, sequence, statut, operation_id, operations(nom)').eq('of_id', q.etapes_of).order('sequence');
        if (error) throw error;
        return rep(200, { etapes: (data || []).map((g) => ({ gamme_id: g.id, sequence: g.sequence, operation_id: g.operation_id, operation: (g.operations && g.operations.nom) || '', statut: g.statut })) });
      }
      if (!dateOk(q.date)) return rep(400, { error: 'Paramètre date (AAAA-MM-JJ) requis.' });
      return rep(200, await lireJour(supabase, q.date, q.horaires === 'heures_sup' ? 'heures_sup' : 'normal'));
    }

    if (event.httpMethod !== 'POST') return rep(405, { error: 'Méthode non autorisée.' });
    let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return rep(400, { error: 'Corps de requête invalide.' }); }
    const mode = b.horaires === 'heures_sup' ? 'heures_sup' : 'normal';

    if (b.action === 'affecter_of') {
      if (!b.of_id) return rep(400, { error: 'Choisissez un OF.' });
      const { data: of, error } = await supabase.from('ordres_fabrication').select('id, numero').eq('id', b.of_id).maybeSingle();
      if (error) throw error;
      if (!of) return rep(404, { error: 'OF introuvable.' });
      if (!b.operation_id) return rep(400, { error: 'Choisissez la tâche de l\'OF.' });
      const { data: g, error: gErr } = await supabase.from('gammes_operatoires').select('id, operations(nom)').eq('of_id', b.of_id).eq('operation_id', b.operation_id);
      if (gErr) throw gErr;
      if (!g || !g.length) return rep(400, { error: 'Cette tâche ne figure pas sur cet OF.' });
      const nom = (g[0].operations && g[0].operations.nom) || 'Tâche';
      return await creer(supabase, b, mode, { phase: nom, of_id: of.id, operation_id: b.operation_id, commentaire: String(b.commentaire || '').trim().slice(0, 300) });
    }

    if (b.action === 'affecter_libre') {
      const libelle = String(b.libelle || '').trim();
      const categorie = String(b.categorie || '').trim();
      const phase = (libelle || categorie).slice(0, 80);
      if (!phase) return rep(400, { error: 'Indiquez le travail à faire (catégorie ou libellé).' });
      if (categorie === 'Autre' && !libelle) return rep(400, { error: 'Précisez le travail (libellé) pour la catégorie « Autre ».' });
      const complet = libelle && categorie && categorie !== 'Autre' && libelle.toLowerCase() !== categorie.toLowerCase() ? `${categorie} — ${libelle}` : phase;
      return await creer(supabase, b, mode, { phase: complet.slice(0, 120), commentaire: String(b.commentaire || '').trim().slice(0, 300) });
    }

    if (b.action === 'supprimer') {
      const ids = (Array.isArray(b.ids) ? b.ids : [b.id]).filter(Boolean);
      if (!ids.length) return rep(400, { error: 'Aucune affectation indiquée.' });
      const { data: lignes, error } = await supabase.from('planning_jour').select('id, couleur_code').in('id', ids);
      if (error) throw error;
      if (!lignes || lignes.length !== ids.length || lignes.some((l) => l.couleur_code !== MARQUE)) return rep(400, { error: 'Seules les affectations ajoutées depuis « Temps libres » peuvent être supprimées ici.' });
      const d1 = await supabase.from('planning_jour_personnel').delete().in('planning_jour_id', ids); if (d1.error) throw d1.error;
      const d2 = await supabase.from('planning_jour').delete().in('id', ids); if (d2.error) throw d2.error;
      return rep(200, { ok: true, supprimees: ids.length });
    }

    return rep(400, { error: 'Action inconnue.' });
  } catch (e) {
    return rep(500, { error: e.message || String(e) });
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
