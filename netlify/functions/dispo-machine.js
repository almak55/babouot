// functions/dispo-machine.js
//
// GET /.netlify/functions/dispo-machine?machine_id=uuid[&du=AAAA-MM-JJ][&jours=21]
//
// Plages de disponibilité d'une machine, jour par jour (jours ouvrés seulement) :
//   [{ date, libelle, etat: 'libre' | 'occupe' | 'maintenance', details: ["OF-2026-0001 08:00–12:00", ...] }]
// Week-ends et jours fériés sont ignorés. Un jour est « occupé » dès qu'un créneau y est
// planifié sur cette machine (c'est la règle de l'affectation manuelle).

const { getSupabase } = require('./lib/supabaseclient');
const PL = require('./lib/planification');
const INT = require('./lib/interventions');
const { libelleJour, aujourdhuiParis } = require('./lib/debut-etape');

const handlerProtege = async (event) => {
  try {
    const q = event.queryStringParameters || {};
    if (!q.machine_id) return { statusCode: 400, body: JSON.stringify({ error: 'machine_id requis.' }) };
    const du = /^\d{4}-\d{2}-\d{2}$/.test(q.du || '') ? q.du : aujourdhuiParis();
    const nb = Math.max(1, Math.min(60, parseInt(q.jours, 10) || 21));
    const debut = PL.enMinutes(du, '00:00');
    const fin = debut + nb * PL.MIN_JOUR * 2;       // marge : on saute week-ends et fériés
    const dateFin = PL.dateDe(fin);

    const supabase = getSupabase();
    const [planRes, maintRes] = await Promise.all([
      supabase.from('planning_jour')
        .select('date, heure_debut, heure_fin, phase, statut, ordres_fabrication(numero)')
        .eq('machine_id', q.machine_id).gte('date', du).lte('date', dateFin).neq('statut', 'annulé'),
      supabase.from('maintenance_machine')
        .select('*')
        .eq('machine_id', q.machine_id).neq('statut', 'terminé'),
    ]);
    if (planRes.error) throw planRes.error;
    if (maintRes.error) throw maintRes.error;

    const jours = [];
    for (let j = debut; jours.length < nb && j < fin; j += PL.MIN_JOUR) {
      if (!PL.estOuvre(j)) continue;
      const date = PL.dateDe(j);
      const lignes = planRes.data.filter((l) => l.date === date);
      const maint = maintRes.data.find((m) => INT.bloque(m) && INT.touche(m, { date, heure_debut: null, heure_fin: null }));
      const details = lignes.map((l) => {
        const of = l.ordres_fabrication && l.ordres_fabrication.numero ? l.ordres_fabrication.numero : 'OF';
        const h = l.heure_debut ? ` ${String(l.heure_debut).slice(0, 5)}–${String(l.heure_fin).slice(0, 5)}` : ' (journée)';
        return `${of}${l.phase ? ' · ' + l.phase : ''}${h}`;
      });
      if (maint) details.unshift(INT.decrire(maint));
      jours.push({ date, libelle: libelleJour(date), etat: maint ? 'maintenance' : (lignes.length ? 'occupe' : 'libre'), details });
    }
    const interventions = maintRes.data.map((m) => ({ type: m.type, type_libelle: INT.TYPES[m.type] || m.type, du: m.date_debut, au: m.date_fin, bloquant: m.bloquant !== false, texte: INT.decrire(m), etat: INT.etatIntervention(m, aujourdhuiParis()) }));
    return { statusCode: 200, body: JSON.stringify({ jours, interventions }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
