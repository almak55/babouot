// lib/interventions.js — état des machines et interventions (table maintenance_machine).
//
// Une intervention : machine, type, date_debut [heure_debut], date_fin [heure_fin] (vide = fin inconnue), statut 'en cours' | 'terminé',
// bloquant (false = marche dégradée, la machine reste utilisable). « Programmée » = date_debut dans le futur.

const PL = require('./planification');

const TYPES = {
  reparation: 'Panne / réparation',
  maintenance: 'Maintenance préventive',
  retour_sigis: 'Retour constructeur / SAV',
  revision: 'Révision / contrôle',
  autre: 'Autre intervention',
};
const hh = (t) => (t ? String(t).slice(0, 5) : null);
const fmtJour = (d) => (d ? d.split('-').reverse().slice(0, 2).join('/') : '');

function etatIntervention(m, aujourdhui) {
  if (m.statut === 'terminé') return 'terminée';
  if (m.date_debut > aujourdhui) return 'programmée';
  return 'en cours';
}
// Intervalle [d, f[ en minutes absolues (même repère que lib/planification).
function intervalle(m) {
  const d = PL.enMinutes(m.date_debut, hh(m.heure_debut) || '00:00');
  const f = m.date_fin ? PL.enMinutes(m.date_fin, hh(m.heure_fin) || '00:00') + (hh(m.heure_fin) ? 0 : PL.MIN_JOUR) : d + PL.HORIZON_JOURS * PL.MIN_JOUR;
  return { d, f };
}
const bloque = (m) => m && m.statut !== 'terminé' && m.bloquant !== false;
// Une portion de journée { date, heure_debut, heure_fin } (heures vides = journée entière) tombe-t-elle dans l'intervention ?
function touche(m, morceau) {
  const s = PL.enMinutes(morceau.date, hh(morceau.heure_debut) || '00:00');
  const e = PL.enMinutes(morceau.date, hh(morceau.heure_fin) || '00:00') + (hh(morceau.heure_fin) ? 0 : PL.MIN_JOUR);
  const iv = intervalle(m);
  return s < iv.f && iv.d < e;
}
function decrire(m) {
  const type = TYPES[m.type] || m.type || 'intervention';
  const quand = m.date_fin
    ? (m.date_fin === m.date_debut ? `le ${fmtJour(m.date_debut)}${hh(m.heure_debut) ? ' de ' + hh(m.heure_debut) + ' à ' + (hh(m.heure_fin) || '…') : ''}` : `du ${fmtJour(m.date_debut)} au ${fmtJour(m.date_fin)}`)
    : `depuis le ${fmtJour(m.date_debut)} (fin non connue)`;
  return `${type} ${quand}${m.description ? ' — ' + m.description : ''}`;
}

// État courant de chaque machine : { [machine_id]: { etat, libelle, jusqu_au, intervention, prochaine } }
//   etat : 'ok' | 'hors_service' | 'maintenance' | 'degradee' | 'programmee'
async function etatsMachines(supabase, aujourdhui) {
  const { data, error } = await supabase.from('maintenance_machine').select('*').neq('statut', 'terminé');
  if (error) return {};   // table ou colonnes absentes : toutes les machines sont considérées en état normal
  const out = {};
  const par = {};
  (data || []).forEach((m) => { (par[m.machine_id] = par[m.machine_id] || []).push(m); });
  Object.entries(par).forEach(([mid, liste]) => {
    const courantes = liste.filter((m) => m.date_debut <= aujourdhui && (!m.date_fin || m.date_fin >= aujourdhui));
    const bloquantes = courantes.filter(bloque);
    const prochaine = liste.filter((m) => m.date_debut > aujourdhui).sort((a, b) => a.date_debut.localeCompare(b.date_debut))[0] || null;
    const resume = (m) => ({ id: m.id, type: m.type, type_libelle: TYPES[m.type] || m.type, date_debut: m.date_debut, date_fin: m.date_fin, description: m.description || '' });
    if (bloquantes.length) {
      const m = bloquantes.sort((a, b) => (a.type === 'reparation' || a.type === 'retour_sigis' ? 0 : 1) - (b.type === 'reparation' || b.type === 'retour_sigis' ? 0 : 1))[0];
      const hors = m.type === 'reparation' || m.type === 'retour_sigis';
      out[mid] = { etat: hors ? 'hors_service' : 'maintenance', libelle: hors ? 'Hors service' : 'Intervention en cours', jusqu_au: m.date_fin || null, intervention: resume(m), prochaine: prochaine && resume(prochaine) };
    } else if (courantes.length) {
      out[mid] = { etat: 'degradee', libelle: 'Marche dégradée', jusqu_au: courantes[0].date_fin || null, intervention: resume(courantes[0]), prochaine: prochaine && resume(prochaine) };
    } else if (prochaine) {
      out[mid] = { etat: 'programmee', libelle: 'Intervention programmée', jusqu_au: null, intervention: null, prochaine: resume(prochaine) };
    }
  });
  return out;
}

module.exports = { TYPES, hh, fmtJour, etatIntervention, intervalle, bloque, touche, decrire, etatsMachines };
