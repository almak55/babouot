// functions/feuille-journaliere.js
//
// GET /.netlify/functions/feuille-journaliere?date=2026-10-12
//
// Données de la feuille journalière de placement du personnel :
// pour chaque personne, ses créneaux du jour (horaires, machine, OF, titre,
// client, quantité, opération, équipe) + absents + créneaux sans personne.

const { getSupabase } = require('./lib/supabaseclient');

const hhmm = (t) => (t ? String(t).slice(0, 5) : null);

exports.handler = async (event) => {
  try {
    const date = (event.queryStringParameters || {}).date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Paramètre date (AAAA-MM-JJ) requis.' }) };
    }
    const supabase = getSupabase();

    const [persRes, planRes, dispoRes, catRes] = await Promise.all([
      supabase.from('personnel').select('id, nom, poste').eq('actif', true).order('nom'),
      supabase.from('planning_jour')
        .select('id, heure_debut, heure_fin, phase, statut, machine_id, personnel_id, of_id, operation_id, machines(code, nom), operations(nom), ordres_fabrication(numero, quantite, delai, priorite, caracteristiques, titres(nom, client)), planning_jour_personnel(personnel_id)')
        .eq('date', date).order('heure_debut', { nullsFirst: true }),
      supabase.from('personnel_planning_jour').select('personnel_id, statut, heure_debut, heure_fin, commentaire').eq('date', date),
      supabase.from('caracteristiques_produit').select('cle, libelle, unite'),
    ]);
    for (const r of [persRes, planRes, dispoRes, catRes]) if (r.error) throw r.error;

    const cat = Object.fromEntries(catRes.data.map((c) => [c.cle, c]));
    const nomDe = Object.fromEntries(persRes.data.map((p) => [p.id, p.nom]));

    const creneaux = planRes.data.map((c) => {
      const of = c.ordres_fabrication || {};
      const ids = (c.planning_jour_personnel || []).map((l) => l.personnel_id);
      const personnel_ids = ids.length ? ids : (c.personnel_id ? [c.personnel_id] : []);
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

    const dispo = Object.fromEntries(dispoRes.data.map((d) => [d.personnel_id, d]));
    const personnes = persRes.data.map((p) => {
      const d = dispo[p.id];
      const statut = d ? d.statut : 'présent';
      return {
        id: p.id, nom: p.nom, poste: p.poste || '',
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
