// functions/gerer-couts.js
//
// GET  -> réglages du devis, machines (amortissement), personnel (coût horaire), matières (prix, consommation)
// POST { parametres?: { cle: valeur }, machines?: [{id, prix_achat, duree_amortissement_ans, heures_an, entretien_an, cout_horaire_force}],
//        personnel?: [{id, cout_horaire}], stocks?: [{id, prix_unitaire, conso_formule}] }

const { getSupabase } = require('./lib/supabaseclient');
const { coutHoraireMachine, lireParametres, num } = require('./lib/devis');
const { analyser } = require('./lib/formules');

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();
    if (event.httpMethod === 'GET') {
      const [pRes, mRes, perRes, sRes] = await Promise.all([
        supabase.from('parametres_devis').select('cle, valeur, libelle, unite').order('cle'),
        supabase.from('machines').select('id, code, nom, prix_achat, duree_amortissement_ans, heures_an, entretien_an, cout_horaire_force').eq('actif', true).order('nom'),
        supabase.from('personnel').select('id, nom, poste, cout_horaire').eq('actif', true).order('nom'),
        supabase.from('stocks').select('id, nom, unite, prix_unitaire, conso_formule').order('nom'),
      ]);
      for (const r of [pRes, mRes, perRes, sRes]) if (r.error) throw r.error;
      return { statusCode: 200, body: JSON.stringify({
        parametres: pRes.data,
        machines: mRes.data.map((m) => ({ ...m, cout_horaire: coutHoraireMachine(m) })),
        personnel: perRes.data, stocks: sRes.data,
      }) };
    }
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
    const b = JSON.parse(event.body || '{}');

    for (const s of b.stocks || []) {
      if (s.conso_formule && String(s.conso_formule).trim()) {
        const a = analyser(String(s.conso_formule));
        if (!a.ok) return { statusCode: 400, body: JSON.stringify({ error: `Formule de consommation invalide : ${a.erreur}` }) };
      }
    }
    for (const [cle, valeur] of Object.entries(b.parametres || {})) {
      const v = num(valeur);
      if (v === null || v < 0) return { statusCode: 400, body: JSON.stringify({ error: `Valeur invalide pour « ${cle} ».` }) };
      const { error } = await supabase.from('parametres_devis').update({ valeur: v }).eq('cle', cle);
      if (error) throw error;
    }
    for (const m of b.machines || []) {
      const maj = {};
      ['prix_achat', 'duree_amortissement_ans', 'heures_an', 'entretien_an', 'cout_horaire_force'].forEach((k) => { if (k in m) maj[k] = num(m[k]); });
      if (Object.keys(maj).length) { const { error } = await supabase.from('machines').update(maj).eq('id', m.id); if (error) throw error; }
    }
    for (const p of b.personnel || []) {
      const { error } = await supabase.from('personnel').update({ cout_horaire: num(p.cout_horaire) }).eq('id', p.id);
      if (error) throw error;
    }
    for (const s of b.stocks || []) {
      const maj = {};
      if ('prix_unitaire' in s) maj.prix_unitaire = num(s.prix_unitaire);
      if ('conso_formule' in s) maj.conso_formule = s.conso_formule && String(s.conso_formule).trim() ? String(s.conso_formule).trim() : null;
      if (Object.keys(maj).length) { const { error } = await supabase.from('stocks').update(maj).eq('id', s.id); if (error) throw error; }
    }
    return { statusCode: 200, body: JSON.stringify({ enregistre: true, parametres: await lireParametres(supabase) }) };
  } catch (e) {
    console.error('gerer-couts error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || String(e) }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
