// lib/journal.js
//
// Journal de traçabilité d'un OF (table of_journal, migration 58).
// Écriture « au mieux » : une erreur (table absente, réseau…) n'interrompt jamais l'opération métier qui l'appelle.

const TYPES = ['creation', 'validation', 'planification', 'replanification', 'delai', 'saisie', 'etape_terminee', 'recalage', 'termine', 'deplanification', 'affectation', 'observation'];

async function noter(supabase, ofId, type, resume, details) {
  try {
    if (!supabase || !ofId || !resume) return false;
    const ligne = { of_id: ofId, type: TYPES.includes(type) ? type : 'observation', resume: String(resume).slice(0, 600), details: details && typeof details === 'object' ? details : {} };
    const { error } = await supabase.from('of_journal').insert(ligne);
    if (error) { console.warn('journal OF non écrit :', error.message); return false; }
    return true;
  } catch (e) {
    console.warn('journal OF non écrit :', e.message);
    return false;
  }
}

module.exports = { TYPES, noter };
