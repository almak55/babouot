// functions/feuille-journaliere.js
//
// GET /.netlify/functions/feuille-journaliere?date=2026-10-12
//
// Données de la feuille journalière de placement du personnel :
// pour chaque personne, ses créneaux du jour (horaires, machine, OF, titre,
// client, quantité, opération, équipe) + absents + créneaux sans personne.

const { getSupabase } = require('./lib/supabaseclient');
const { purgerObsoletes } = require('./lib/obsoletes');

const hhmm = (t) => (t ? String(t).slice(0, 5) : null);

const handlerProtege = async (event) => {
  try {
    const date = (event.queryStringParameters || {}).date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Paramètre date (AAAA-MM-JJ) requis.' }) };
    }
    const supabase = getSupabase();
    await purgerObsoletes(supabase);   // créneaux restants d'étapes déjà terminées
    const debug = (event.queryStringParameters || {}).debug === '1';

    const [persRes, planRes, dispoRes, catRes, compRes, persMachRes] = await Promise.all([
      supabase.from('personnel').select('id, nom, poste, numero_badge').eq('actif', true).order('nom').then((r) => (r.error && /numero_badge/.test(r.error.message || '') ? supabase.from('personnel').select('id, nom, poste').eq('actif', true).order('nom') : r)),
      supabase.from('planning_jour')
        .select('id, heure_debut, heure_fin, phase, statut, machine_id, personnel_id, of_id, operation_id, machines(code, nom), operations(nom), ordres_fabrication(numero, quantite, delai, priorite, caracteristiques, titres(nom, client)), planning_jour_personnel(personnel_id)')
        .eq('date', date).order('heure_debut', { nullsFirst: true }),
      supabase.from('personnel_planning_jour').select('personnel_id, statut, heure_debut, heure_fin, commentaire').eq('date', date),
      supabase.from('caracteristiques_produit').select('cle, libelle, unite'),
      debug ? supabase.from('personnel_competences').select('personnel_id, operation_id') : { data: [] },
      debug ? supabase.from('personnel_machines').select('personnel_id, machine_id') : { data: [] },
    ]);
    for (const r of [persRes, planRes, dispoRes, catRes, compRes, persMachRes]) if (r.error) throw r.error;

    const cat = Object.fromEntries(catRes.data.map((c) => [c.cle, c]));
    const nomDe = Object.fromEntries(persRes.data.map((p) => [p.id, p.nom]));

    const creneaux = planRes.data.map((c) => {
      const of = c.ordres_fabrication || {};
      const ids = (c.planning_jour_personnel || []).map((l) => l.personnel_id);
      const personnel_ids = Array.from(new Set([...(c.personnel_id ? [c.personnel_id] : []), ...ids]));
      const carac = Object.entries(of.caracteristiques || {})
        .filter(([k, v]) => cat[k] && v !== null && v !== '')
        .map(([k, v]) => `${cat[k].libelle} : ${v}${cat[k].unite ? ' ' + cat[k].unite : ''}`);
      return {
        id: c.id,
        debut: hhmm(c.heure_debut), fin: hhmm(c.heure_fin),
        operation: (c.operations && c.operations.nom) || c.phase || '',
        phase: c.phase || '',
        machine: c.machines ? `${c.machines.nom} (${c.machines.code})` : 'Travail manuel',
        of: of.numero || '', titre: (of.titres && of.titres.nom) || '', client: (of.titres && of.titres.client) || '',
        quantite: of.quantite ?? null, delai: of.delai || null, priorite: of.priorite || '',
        caracteristiques: carac,
        statut: c.statut || '',
        personnel_ids,
        equipe: personnel_ids.map((id) => nomDe[id]).filter(Boolean),
      };
    });

    if (debug) {
      const lignes = planRes.data.map((c) => ({
        creneau: c.id, heure: `${hhmm(c.heure_debut) || ''}-${hhmm(c.heure_fin) || ''}`,
        operation: (c.operations && c.operations.nom) || null, phase: c.phase,
        machine: c.machines ? c.machines.nom : null, of: c.ordres_fabrication ? c.ordres_fabrication.numero : null,
        referent: c.personnel_id ? nomDe[c.personnel_id] || c.personnel_id : null,
        liens: (c.planning_jour_personnel || []).map((l) => nomDe[l.personnel_id] || l.personnel_id),
        competents_operation: compRes.data.filter((x) => x.operation_id === c.operation_id).map((x) => nomDe[x.personnel_id]).filter(Boolean),
        competents_machine: persMachRes.data.filter((x) => x.machine_id === c.machine_id).map((x) => nomDe[x.personnel_id]).filter(Boolean),
      }));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ date, indisponibilites: dispoRes.data.map((d) => ({ nom: nomDe[d.personnel_id], statut: d.statut })), lignes }, null, 1) };
    }

    const dispo = Object.fromEntries(dispoRes.data.map((d) => [d.personnel_id, d]));
    const personnes = persRes.data.map((p) => {
      const d = dispo[p.id];
      const statut = d ? d.statut : 'présent';
      return {
        id: p.id, nom: p.nom, poste: p.poste || '', badge: p.numero_badge || '',
        statut, plage: d && d.heure_debut ? `${hhmm(d.heure_debut)}–${hhmm(d.heure_fin)}` : '',
        commentaire: (d && d.commentaire) || '',
        creneaux: creneaux.filter((c) => c.personnel_ids.includes(p.id)),
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        date,
        personnes: personnes.filter((p) => p.creneaux.length || !['présent', 'disponible'].includes(p.statut)),
        presents_sans_tache: personnes.filter((p) => !p.creneaux.length && ['présent', 'disponible'].includes(p.statut)).map((p) => ({ nom: p.nom, poste: p.poste })),
        sans_personnel: creneaux.filter((c) => !c.personnel_ids.length),
        nb_creneaux: creneaux.length,
      }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || String(e) }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
