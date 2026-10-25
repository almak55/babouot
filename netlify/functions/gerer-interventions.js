// functions/gerer-interventions.js
//
// Interventions sur les machines : pannes, maintenance, retour constructeur, révision, marche dégradée.
//
// GET  ?machine_id=uuid  -> { machine, etat, interventions: [{ id, type, type_libelle, etat ('programmée'|'en cours'|'terminée'),
//                             date_debut, heure_debut, date_fin, heure_fin, date_fin_prevue, bloquant, description, intervenant }] }
// POST { machine_id, type, date_debut, heure_debut?, date_fin?, heure_fin?, bloquant?, description?, intervenant? }
//        -> { intervention, impacts: [ tâches déjà planifiées sur la machine pendant l'intervention ] }
// PUT  { id, action: 'terminer', date_fin? }      -> intervention terminée (fin = aujourd'hui par défaut)
//      { id, ...champs }                          -> modification (dates, heures, type, description, bloquant, intervenant)
// DELETE ?id=uuid                                 -> supprime l'intervention (erreur de saisie)

const { getSupabase } = require('./lib/supabaseclient');
const { aujourdhuiParis } = require('./lib/debut-etape');
const I = require('./lib/interventions');

const rep = (code, o) => ({ statusCode: code, body: JSON.stringify(o) });
const dateOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
const heureOk = (h) => /^\d{1,2}:\d{2}/.test(h || '');
const CHAMPS = ['type', 'date_debut', 'heure_debut', 'date_fin', 'heure_fin', 'bloquant', 'description', 'intervenant'];

// Tâches planifiées sur la machine pendant l'intervention (à partir d'aujourd'hui) : elles ne pourront pas avoir lieu.
async function impacts(supabase, interv, aujourdhui) {
  if (!I.bloque(interv)) return [];
  const du = interv.date_debut > aujourdhui ? interv.date_debut : aujourdhui;
  let q = supabase.from('planning_jour').select('id, date, heure_debut, heure_fin, phase, statut, of_id, gamme_operatoire_id, ordres_fabrication(numero, titres(nom)), operations(nom)')
    .eq('machine_id', interv.machine_id).gte('date', du).neq('statut', 'annulé').order('date');
  if (interv.date_fin) q = q.lte('date', interv.date_fin);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).filter((l) => I.touche(interv, { date: l.date, heure_debut: l.heure_debut, heure_fin: l.heure_fin })).map((l) => ({
    planning_id: l.id, gamme_id: l.gamme_operatoire_id, date: l.date, heure_debut: I.hh(l.heure_debut), heure_fin: I.hh(l.heure_fin),
    of: (l.ordres_fabrication && l.ordres_fabrication.numero) || '', titre: (l.ordres_fabrication && l.ordres_fabrication.titres && l.ordres_fabrication.titres.nom) || '',
    operation: (l.operations && l.operations.nom) || l.phase || '', statut: l.statut || '',
  }));
}

const vue = (m, auj) => ({
  id: m.id, machine_id: m.machine_id, type: m.type, type_libelle: I.TYPES[m.type] || m.type, etat: I.etatIntervention(m, auj),
  date_debut: m.date_debut, heure_debut: I.hh(m.heure_debut), date_fin: m.date_fin, heure_fin: I.hh(m.heure_fin), date_fin_prevue: m.date_fin_prevue || null,
  bloquant: m.bloquant !== false, description: m.description || '', intervenant: m.intervenant || '',
});

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();
    const auj = aujourdhuiParis();
    const q = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
      if (!q.machine_id) return rep(400, { error: 'machine_id requis.' });
      const [mRes, iRes] = await Promise.all([
        supabase.from('machines').select('id, code, nom, actif').eq('id', q.machine_id).maybeSingle(),
        supabase.from('maintenance_machine').select('*').eq('machine_id', q.machine_id).order('date_debut', { ascending: false }),
      ]);
      if (mRes.error) throw mRes.error; if (iRes.error) throw iRes.error;
      if (!mRes.data) return rep(404, { error: 'Machine introuvable.' });
      const etats = await I.etatsMachines(supabase, auj);
      return rep(200, { machine: mRes.data, etat: etats[q.machine_id] || { etat: 'ok', libelle: 'Opérationnelle' }, types: I.TYPES, interventions: (iRes.data || []).map((m) => vue(m, auj)) });
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!b.machine_id) return rep(400, { error: 'machine_id requis.' });
      if (!I.TYPES[b.type]) return rep(400, { error: 'Type d\'intervention inconnu.' });
      if (!dateOk(b.date_debut)) return rep(400, { error: 'Date de début requise.' });
      if (b.date_fin && !dateOk(b.date_fin)) return rep(400, { error: 'Date de fin invalide.' });
      if (b.date_fin && b.date_fin < b.date_debut) return rep(400, { error: 'La fin ne peut pas précéder le début.' });
      if (b.date_fin && b.date_fin === b.date_debut && heureOk(b.heure_debut) && heureOk(b.heure_fin) && b.heure_fin <= b.heure_debut) return rep(400, { error: 'L\'heure de fin doit suivre l\'heure de début.' });
      const ligne = {
        machine_id: b.machine_id, type: b.type, date_debut: b.date_debut, date_fin: b.date_fin || null, date_fin_prevue: b.date_fin || null,
        heure_debut: heureOk(b.heure_debut) ? b.heure_debut.slice(0, 5) : null, heure_fin: heureOk(b.heure_fin) ? b.heure_fin.slice(0, 5) : null,
        bloquant: b.bloquant !== false, description: (b.description || '').trim() || null, intervenant: (b.intervenant || '').trim() || null, statut: 'en cours',
      };
      const { data, error } = await supabase.from('maintenance_machine').insert(ligne).select('*').single();
      if (error) {
        if (/heure_debut|bloquant|intervenant|date_fin_prevue/.test(error.message || '')) return rep(500, { error: 'Colonnes manquantes : exécutez la migration 48 dans Supabase.' });
        throw error;
      }
      return rep(200, { intervention: vue(data, auj), impacts: await impacts(supabase, data, auj) });
    }

    if (event.httpMethod === 'PUT') {
      const b = JSON.parse(event.body || '{}');
      if (!b.id) return rep(400, { error: 'id requis.' });
      const { data: cur, error: cErr } = await supabase.from('maintenance_machine').select('*').eq('id', b.id).maybeSingle();
      if (cErr) throw cErr; if (!cur) return rep(404, { error: 'Intervention introuvable.' });
      let maj;
      if (b.action === 'terminer') {
        const fin = dateOk(b.date_fin) ? b.date_fin : (auj < cur.date_debut ? cur.date_debut : auj);
        maj = { statut: 'terminé', date_fin: fin, heure_fin: null, updated_at: new Date().toISOString() };
      } else {
        maj = { updated_at: new Date().toISOString() };
        CHAMPS.forEach((k) => { if (k in b) maj[k] = b[k] === '' ? null : b[k]; });
        if ('bloquant' in b) maj.bloquant = b.bloquant !== false;
        if (maj.date_debut !== undefined && !dateOk(maj.date_debut)) return rep(400, { error: 'Date de début invalide.' });
        if (maj.date_fin && !dateOk(maj.date_fin)) return rep(400, { error: 'Date de fin invalide.' });
        const d0 = maj.date_debut || cur.date_debut, d1 = 'date_fin' in maj ? maj.date_fin : cur.date_fin;
        if (d1 && d1 < d0) return rep(400, { error: 'La fin ne peut pas précéder le début.' });
        if (maj.type && !I.TYPES[maj.type]) return rep(400, { error: 'Type d\'intervention inconnu.' });
      }
      const { data, error } = await supabase.from('maintenance_machine').update(maj).eq('id', b.id).select('*').single();
      if (error) throw error;
      return rep(200, { intervention: vue(data, auj), impacts: b.action === 'terminer' ? [] : await impacts(supabase, data, auj) });
    }

    if (event.httpMethod === 'DELETE') {
      if (!q.id) return rep(400, { error: 'id requis.' });
      const { error } = await supabase.from('maintenance_machine').delete().eq('id', q.id);
      if (error) throw error;
      return rep(200, { supprime: true });
    }
    return rep(405, { error: 'Méthode non autorisée.' });
  } catch (e) {
    console.error('gerer-interventions error:', e);
    return rep(500, { error: e.message || String(e) });
  }
};

exports.handler = require('./lib/auth').avecAuth(handlerProtege);
