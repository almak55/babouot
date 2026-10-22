// functions/conflits-absence.js
//
// Absences et planning déjà établi : détecte les créneaux où une personne planifiée est absente,
// PROPOSE des remplaçants et mesure l'effet de chaque solution sur le délai. Rien n'est décidé
// automatiquement : c'est la personne qui valide.
//
// GET  ?depuis=AAAA-MM-JJ&jours=14
//      -> { conflits: [ { planning_jour_id, date, heure_debut, heure_fin, of, titre, operation, machine,
//                         gamme_id, absent:{id,nom,statut,motif}, equipe:[{id,nom}], avancement_pct,
//                         remplacants:[{id,nom,deja_travaille,charge}] } ], depuis, jusqu_a }
//
// POST { action: 'remplacer', planning_jour_id, absent_id, remplacant_id, portee?: 'creneau'|'tache' }
//        -> le remplaçant prend la place de l'absent (même créneau, rien d'autre ne bouge)
//      { action: 'apercu' | 'appliquer', option: 'reduit' | 'reporter', planning_jour_id, absent_id }
//        -> replanifie le temps restant de la tâche (et des étapes qui en dépendent)
//           reduit   : sans la personne absente (les autres continuent ; durée recalculée selon l'effectif)
//           reporter : la personne absente reste affectée, la tâche reprend à son retour
//           apercu = simple simulation (fin de la tâche, fin de l'OF, délai respecté ou non)

const { getSupabase } = require('./lib/supabaseclient');
const { aujourdhuiParis } = require('./lib/debut-etape');
const planifierOf = require('./planifier-of');
const { purgerObsoletes } = require('./lib/obsoletes');
const { descendants } = require('./lib/recalage');

const hm = (t) => { const [h, m] = String(t).slice(0, 5).split(':'); return Number(h) * 60 + Number(m); };
const plusJours = (dateStr, n) => { const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const bornes = (l) => [l.heure_debut ? hm(l.heure_debut) : 0, l.heure_fin ? hm(l.heure_fin) : 1440];

// Une entrée de disponibilité empêche-t-elle de travailler sur [s, e] ?
function indisponible(abs, s, e) {
  if (!abs) return false;
  if (abs.statut === 'absent' || abs.statut === 'en arrêt') return true;
  if (abs.heure_debut && abs.heure_fin) return s < hm(abs.heure_debut) || e > hm(abs.heure_fin);
  return false;
}

async function calculerConflits(supabase, depuis, jours) {
  const jusquA = plusJours(depuis, jours);
  const [lignesRes, absRes, persRes] = await Promise.all([
    supabase.from('planning_jour')
      .select('id, date, heure_debut, heure_fin, statut, machine_id, personnel_id, of_id, operation_id, gamme_operatoire_id')
      .gte('date', depuis).lte('date', jusquA).neq('statut', 'annulé').neq('statut', 'terminé'),
    supabase.from('personnel_planning_jour').select('personnel_id, date, statut, heure_debut, heure_fin, commentaire').gte('date', depuis).lte('date', jusquA),
    supabase.from('personnel').select('id, nom').eq('actif', true),
  ]);
  for (const r of [lignesRes, absRes, persRes]) if (r.error) throw r.error;
  const lignes = lignesRes.data;
  const ids = lignes.map((l) => l.id);
  const liensRes = ids.length ? await supabase.from('planning_jour_personnel').select('planning_jour_id, personnel_id').in('planning_jour_id', ids) : { data: [] };
  if (liensRes.error) throw liensRes.error;

  const nom = Object.fromEntries(persRes.data.map((p) => [p.id, p.nom]));
  const absDe = new Map(absRes.data.map((a) => [`${a.personnel_id}|${a.date}`, a]));
  const equipeDe = (l) => Array.from(new Set([l.personnel_id, ...liensRes.data.filter((x) => x.planning_jour_id === l.id).map((x) => x.personnel_id)].filter(Boolean)));

  // Créneaux touchés
  const touches = [];
  lignes.forEach((l) => {
    const [s, e] = bornes(l);
    equipeDe(l).forEach((pid) => { if (indisponible(absDe.get(`${pid}|${l.date}`), s, e)) touches.push({ l, pid }); });
  });
  if (!touches.length) return { conflits: [], depuis, jusqu_a: jusquA, lignes, absDe, equipeDe, nom };

  const opIds = Array.from(new Set(touches.map((t) => t.l.operation_id).filter(Boolean)));
  const gIds = Array.from(new Set(touches.map((t) => t.l.gamme_operatoire_id).filter(Boolean)));
  const ofIds = Array.from(new Set(touches.map((t) => t.l.of_id).filter(Boolean)));
  const machIds = Array.from(new Set(touches.map((t) => t.l.machine_id).filter(Boolean)));
  const [opsRes, compRes, pmRes, gamRes, ofRes, machRes, histRes] = await Promise.all([
    opIds.length ? supabase.from('operations').select('id, nom').in('id', opIds) : { data: [] },
    supabase.from('personnel_competences').select('personnel_id, operation_id'),
    supabase.from('personnel_machines').select('personnel_id, machine_id'),
    gIds.length ? supabase.from('gammes_operatoires').select('id, avancement_pct').in('id', gIds) : { data: [] },
    ofIds.length ? supabase.from('ordres_fabrication').select('id, numero, delai, titres(nom, client)').in('id', ofIds) : { data: [] },
    machIds.length ? supabase.from('machines').select('id, nom').in('id', machIds) : { data: [] },
    gIds.length ? supabase.from('planning_jour').select('gamme_operatoire_id, personnel_id').in('gamme_operatoire_id', gIds) : { data: [] },
  ]);
  for (const r of [opsRes, compRes, pmRes, gamRes, ofRes, machRes, histRes]) if (r.error) throw r.error;

  const opNom = Object.fromEntries(opsRes.data.map((o) => [o.id, o.nom]));
  const gam = Object.fromEntries(gamRes.data.map((g) => [g.id, g]));
  const ofs = Object.fromEntries(ofRes.data.map((o) => [o.id, o]));
  const machNom = Object.fromEntries(machRes.data.map((m) => [m.id, m.nom]));
  const charge = new Map();
  lignes.forEach((l) => equipeDe(l).forEach((p) => charge.set(p, (charge.get(p) || 0) + 1)));
  // Qui a déjà travaillé sur cette tâche (créneaux existants, y compris passés)
  const dejaSurTache = (gid) => new Set([
    ...histRes.data.filter((x) => x.gamme_operatoire_id === gid).map((x) => x.personnel_id).filter(Boolean),
    ...lignes.filter((l) => l.gamme_operatoire_id === gid).flatMap(equipeDe),
  ]);

  const conflits = touches.map(({ l, pid }) => {
    const [s, e] = bornes(l);
    const a = absDe.get(`${pid}|${l.date}`);
    const equipe = equipeDe(l);
    const competents = new Set([
      ...compRes.data.filter((c) => c.operation_id === l.operation_id).map((c) => c.personnel_id),
      ...(l.machine_id ? pmRes.data.filter((c) => c.machine_id === l.machine_id).map((c) => c.personnel_id) : []),
    ]);
    const deja = dejaSurTache(l.gamme_operatoire_id);
    const remplacants = persRes.data
      .filter((p) => competents.has(p.id) && !equipe.includes(p.id) && !indisponible(absDe.get(`${p.id}|${l.date}`), s, e))
      .filter((p) => !lignes.some((x) => x.id !== l.id && x.date === l.date && equipeDe(x).includes(p.id)
        && (() => { const [s2, e2] = bornes(x); return s2 < e && s < e2; })()))
      .map((p) => ({ id: p.id, nom: p.nom, deja_travaille: deja.has(p.id), charge: charge.get(p.id) || 0 }))
      .sort((x, y) => (y.deja_travaille - x.deja_travaille) || (x.charge - y.charge) || x.nom.localeCompare(y.nom, 'fr'));
    const of = ofs[l.of_id] || {};
    return {
      planning_jour_id: l.id, date: l.date,
      heure_debut: l.heure_debut ? String(l.heure_debut).slice(0, 5) : null, heure_fin: l.heure_fin ? String(l.heure_fin).slice(0, 5) : null,
      of_id: l.of_id, of: of.numero || null, delai: of.delai || null,
      titre: of.titres ? of.titres.nom : null, client: of.titres ? of.titres.client : null,
      operation: opNom[l.operation_id] || '', machine: l.machine_id ? (machNom[l.machine_id] || null) : null,
      gamme_id: l.gamme_operatoire_id, avancement_pct: Number((gam[l.gamme_operatoire_id] || {}).avancement_pct || 0),
      absent: { id: pid, nom: nom[pid] || '?', statut: a.statut, motif: a.commentaire || null },
      equipe: equipe.map((id) => ({ id, nom: nom[id] || '?' })),
      remplacants,
    };
  }).sort((x, y) => x.date.localeCompare(y.date) || String(x.heure_debut).localeCompare(String(y.heure_debut)));
  return { conflits, depuis, jusqu_a: jusquA, lignes, absDe, equipeDe, nom };
}

// Replanifie (ou simule) le temps restant d'une tâche touchée par une absence.
async function replanifier(supabase, c, option, appliquer) {
  const equipeIds = c.equipe.map((p) => p.id);
  const gens = option === 'reduit' ? equipeIds.filter((id) => id !== c.absent.id) : equipeIds;
  // Étapes à reprendre : la tâche + celles qui en dépendent (comme pour un retard de production).
  const { data: gammes, error } = await supabase.from('gammes_operatoires')
    .select('id, sequence, statut, avancement_pct, predecesseurs').eq('of_id', c.of_id);
  if (error) throw error;
  const cible = gammes.find((g) => g.id === c.gamme_id);
  if (!cible) throw new Error('Tâche introuvable.');
  const reprise = [cible, ...descendants(gammes, cible.sequence).filter((d) => d.statut !== 'terminé')];
  const restant = {};
  reprise.forEach((g) => { const pct = Number(g.avancement_pct || 0); if (pct > 0) restant[g.id] = Math.max(0, 1 - pct / 100); });
  const debut = `${c.date}T00:00`;
  const aujourdhui = aujourdhuiParis();
  const depart = c.date < aujourdhui ? `${aujourdhui}T00:00` : debut;
  const rep = await planifierOf.handler({
    httpMethod: 'POST',
    body: JSON.stringify({
      of_id: c.of_id, mode: 'avant', appliquer,
      etapes_a_replanifier: reprise.map((g) => g.id), restant, depuis: debut, debut_souhaite: depart, maintenant: depart,
      etapes_imposees: gens.length ? [{ gamme_id: c.gamme_id, personnel_ids: gens }] : [],
    }),
  });
  const data = JSON.parse(rep.body);
  if (rep.statusCode !== 200) return { ok: false, erreur: data.error || 'Replanification impossible', bloquants: data.bloquants || [] };
  const t = data.etapes.find((e) => e.gamme_id === c.gamme_id) || {};
  return {
    ok: true, option, appliquee: !!data.applique,
    tache: { debut: t.debut || null, fin: t.fin || null, personnes: gens.map((id) => (c.equipe.find((p) => p.id === id) || {}).nom).filter(Boolean) },
    of: { fin: data.resume.fin, delai: data.resume.delai, respecte_delai: data.resume.respecte_delai, retard_min: data.resume.retard_min },
  };
}

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();
    await purgerObsoletes(supabase);

    if (event.httpMethod === 'GET') {
      const q = event.queryStringParameters || {};
      const depuis = /^\d{4}-\d{2}-\d{2}$/.test(q.depuis || '') ? q.depuis : aujourdhuiParis();
      const jours = Math.min(60, Math.max(1, Number(q.jours) || 14));
      const r = await calculerConflits(supabase, depuis, jours);
      return { statusCode: 200, body: JSON.stringify({ conflits: r.conflits, depuis: r.depuis, jusqu_a: r.jusqu_a }) };
    }
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };

    const b = JSON.parse(event.body || '{}');
    const { action, planning_jour_id, absent_id } = b;
    if (!planning_jour_id || !absent_id) return { statusCode: 400, body: JSON.stringify({ error: 'planning_jour_id et absent_id requis.' }) };
    const { data: ligne, error: le } = await supabase.from('planning_jour').select('date').eq('id', planning_jour_id).maybeSingle();
    if (le) throw le;
    if (!ligne) return { statusCode: 404, body: JSON.stringify({ error: 'Créneau introuvable.' }) };
    const r = await calculerConflits(supabase, ligne.date, 0);
    const c = r.conflits.find((x) => x.planning_jour_id === planning_jour_id && x.absent.id === absent_id);
    if (!c) return { statusCode: 409, body: JSON.stringify({ error: 'Ce créneau n\'est plus en conflit (l\'absence a peut-être été modifiée).' }) };

    if (action === 'remplacer') {
      const { remplacant_id, portee = 'creneau' } = b;
      if (!remplacant_id) return { statusCode: 400, body: JSON.stringify({ error: 'remplacant_id requis.' }) };
      // Tous les créneaux concernés : ce créneau, ou tous ceux de la tâche où la personne est absente.
      let cibles = [c];
      if (portee === 'tache') {
        const tous = await calculerConflits(supabase, ligne.date, 60);
        cibles = tous.conflits.filter((x) => x.gamme_id === c.gamme_id && x.absent.id === absent_id);
      }
      const faits = []; const ignores = [];
      for (const x of cibles) {
        const dispo = x.remplacants.some((p) => p.id === remplacant_id);
        if (!dispo) { ignores.push({ date: x.date, raison: 'remplaçant non disponible ce jour-là' }); continue; }
        const { error: d1 } = await supabase.from('planning_jour_personnel').delete().eq('planning_jour_id', x.planning_jour_id).eq('personnel_id', absent_id);
        if (d1) throw d1;
        const { error: i1 } = await supabase.from('planning_jour_personnel').insert({ planning_jour_id: x.planning_jour_id, personnel_id: remplacant_id });
        if (i1) throw i1;
        // Référent du créneau (compatibilité) : le remplaçant prend la place de l'absent.
        const { error: u1 } = await supabase.from('planning_jour').update({ personnel_id: remplacant_id }).eq('id', x.planning_jour_id).eq('personnel_id', absent_id);
        if (u1) throw u1;
        faits.push({ date: x.date });
      }
      if (!faits.length) return { statusCode: 409, body: JSON.stringify({ error: 'Ce remplaçant n\'est pas disponible sur ce créneau.', ignores }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true, remplaces: faits, ignores }) };
    }

    if (action === 'apercu' || action === 'appliquer') {
      if (!['reduit', 'reporter'].includes(b.option)) return { statusCode: 400, body: JSON.stringify({ error: 'option invalide (reduit | reporter).' }) };
      const res = await replanifier(supabase, c, b.option, action === 'appliquer');
      return { statusCode: res.ok ? 200 : 409, body: JSON.stringify(res.ok ? res : { error: res.erreur, bloquants: res.bloquants }) };
    }
    return { statusCode: 400, body: JSON.stringify({ error: 'action inconnue.' }) };
  } catch (err) {
    console.error('conflits-absence error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
