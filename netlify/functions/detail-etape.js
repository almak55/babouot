// functions/detail-etape.js
//
// GET /.netlify/functions/detail-etape?gamme_id=uuid
//
// Détail de ce qui est planifié pour une étape de gamme (lecture seule, ne modifie rien).
// Réponse : {
//   etape: { id, sequence, statut, operation, of_numero, titre },
//   liens: { apres: [{ sequence, operation, mode: 'fin'|'en_ligne'|'progressif'|'debut' }] },
//   resume: { debut: {date, heure}, fin: {date, heure}, minutes, jours, machines: [], personnes: [] },
//   creneaux: [{ id, date, heure_debut, heure_fin, phase, machine, personnes: [], statut, minutes }]
// }

const { getSupabase } = require('./lib/supabaseclient');
const EL = require('./lib/en-ligne');
const PL = require('./lib/planification');

const hm = (t) => { const [h, m] = String(t).slice(0, 5).split(':'); return Number(h) * 60 + Number(m); };
const minutes = (c) => {
  if (!c.heure_debut || !c.heure_fin) return 480;
  const d = hm(c.heure_debut), f = hm(c.heure_fin);
  return Math.max(0, f - d - Math.max(0, Math.min(f, 750) - Math.max(d, 720)));   // pause 12h00-12h30 déduite
};

const handlerProtege = async (event) => {
  try {
    const id = (event.queryStringParameters || {}).gamme_id;
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'gamme_id requis.' }) };
    const supabase = getSupabase();
    const { data: g, error } = await supabase.from('gammes_operatoires')
      .select('id, of_id, sequence, statut, predecesseurs, dependances, operations(code, nom), ordres_fabrication(numero, titres(nom))').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!g) return { statusCode: 404, body: JSON.stringify({ error: 'Étape introuvable.' }) };

    const [lignesRes, autresRes, regles] = await Promise.all([
      supabase.from('planning_jour')
        .select('id, date, heure_debut, heure_fin, phase, statut, machine_id, personnel_id, planning_jour_personnel(personnel_id)')
        .eq('gamme_operatoire_id', id).neq('statut', 'annulé').order('date').order('heure_debut'),
      supabase.from('gammes_operatoires').select('sequence, operations(code, nom)').eq('of_id', g.of_id),
      EL.chargerRegles(supabase),
    ]);
    if (lignesRes.error) throw lignesRes.error;
    if (autresRes.error) throw autresRes.error;
    const lignes = lignesRes.data || [];

    const machIds = Array.from(new Set(lignes.map((l) => l.machine_id).filter(Boolean)));
    const persIds = Array.from(new Set(lignes.flatMap((l) => [l.personnel_id, ...((l.planning_jour_personnel || []).map((x) => x.personnel_id))]).filter(Boolean)));
    const [mRes, pRes] = await Promise.all([
      machIds.length ? supabase.from('machines').select('id, nom').in('id', machIds) : { data: [] },
      persIds.length ? supabase.from('personnel').select('id, nom').in('id', persIds) : { data: [] },
    ]);
    const nomM = Object.fromEntries((mRes.data || []).map((m) => [m.id, m.nom]));
    const nomP = Object.fromEntries((pRes.data || []).map((p) => [p.id, p.nom]));

    const creneaux = lignes.map((l) => {
      const ids = Array.from(new Set([l.personnel_id, ...((l.planning_jour_personnel || []).map((x) => x.personnel_id))].filter(Boolean)));
      return {
        id: l.id, date: l.date, heure_debut: l.heure_debut ? String(l.heure_debut).slice(0, 5) : null, heure_fin: l.heure_fin ? String(l.heure_fin).slice(0, 5) : null,
        phase: l.phase || '', machine: l.machine_id ? (nomM[l.machine_id] || '?') : 'Travail manuel', personnes: ids.map((p) => nomP[p] || '?'), statut: l.statut || '', minutes: minutes(l),
      };
    });

    // Dépendances
    const parSeq = new Map((autresRes.data || []).map((x) => [x.sequence, x]));
    const apres = (Array.isArray(g.predecesseurs) ? g.predecesseurs : []).map((s) => {
      const p = parSeq.get(s); if (!p) return null;
      const lien = (g.dependances || {})[s];
      const c = PL.contraintesLien(lien);
      const enLigne = EL.estEnLigne(regles, g.operations && g.operations.code, p.operations && p.operations.code, lien);
      return { sequence: s, operation: (p.operations && p.operations.nom) || `opération ${s}`, mode: enLigne ? 'en_ligne' : (c.progressif ? 'progressif' : (c.debut && !c.fin ? 'debut' : 'fin')), seuil_pct: c.seuil_pct };
    }).filter(Boolean);

    const premier = creneaux[0], dernier = creneaux[creneaux.length - 1];
    const resume = {
      debut: premier ? { date: premier.date, heure: premier.heure_debut || '08:00' } : null,
      fin: dernier ? { date: dernier.date, heure: dernier.heure_fin || '16:30' } : null,
      minutes: creneaux.reduce((t, c) => t + c.minutes, 0),
      jours: new Set(creneaux.map((c) => c.date)).size,
      machines: Array.from(new Set(creneaux.map((c) => c.machine))),
      personnes: Array.from(new Set(creneaux.flatMap((c) => c.personnes))),
    };
    return {
      statusCode: 200,
      body: JSON.stringify({
        etape: { id: g.id, sequence: g.sequence, statut: g.statut, operation: (g.operations && g.operations.nom) || '', of_numero: g.ordres_fabrication ? g.ordres_fabrication.numero : '', titre: g.ordres_fabrication && g.ordres_fabrication.titres ? g.ordres_fabrication.titres.nom : '' },
        liens: { apres }, resume, creneaux,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

exports.handler = require('./lib/auth').avecAuth(handlerProtege);
