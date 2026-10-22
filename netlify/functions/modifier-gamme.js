// functions/modifier-gamme.js
//
// POST /.netlify/functions/modifier-gamme
// body : { of_id, ajouter?: ["EMBOITAGE_1", ...], supprimer?: ["gamme_id", ...] }
//
// Ajoute à un OF existant des opérations du catalogue (par leur code) ou en
// retire. Une même opération peut être ajoutée plusieurs fois. Les opérations
// ajoutées sont « à planifier » et sans lien imposé (elles peuvent démarrer dès
// le début tant qu'on n'a pas indiqué « Démarre après »).
// Seules les étapes « à planifier » peuvent être retirées ; les liens qui
// pointaient vers elles sont nettoyés.

const { getSupabase } = require('./lib/supabaseclient');

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    const { of_id: ofId, ajouter, supprimer } = JSON.parse(event.body || '{}');
    if (!ofId) return { statusCode: 400, body: JSON.stringify({ error: 'of_id requis.' }) };
    const supabase = getSupabase();
    const avertissements = [];

    const lire = async () => {
      const { data, error } = await supabase.from('gammes_operatoires')
        .select('id, sequence, statut, predecesseurs, dependances').eq('of_id', ofId);
      if (error) throw error;
      return data || [];
    };
    let gammes = await lire();

    const aSupprimer = Array.isArray(supprimer) ? supprimer.filter(Boolean) : [];
    if (aSupprimer.length) {
      const retirees = [];
      for (const id of aSupprimer) {
        const g = gammes.find((x) => x.id === id);
        if (!g) continue;
        if (g.statut !== 'à planifier') {
          avertissements.push(`Étape ${g.sequence} conservée : elle est « ${g.statut} » (déplanifiez-la d'abord).`);
          continue;
        }
        retirees.push(g);
      }
      if (retirees.length) {
        const { error } = await supabase.from('gammes_operatoires').delete().in('id', retirees.map((g) => g.id));
        if (error) throw error;
        const seqRetirees = new Set(retirees.map((g) => g.sequence));
        const restantes = gammes.filter((g) => !seqRetirees.has(g.sequence)).sort((a, b) => a.sequence - b.sequence);
        for (const g of restantes) {
          // Une étape sans liste explicite suivait la précédente : on fige ce comportement avant de retirer des maillons.
          const toutes = gammes.slice().sort((a, b) => a.sequence - b.sequence);
          const i = toutes.findIndex((x) => x.id === g.id);
          const avant = i > 0 ? [toutes[i - 1].sequence] : [];
          const preds = g.predecesseurs ?? avant;
          if (!preds.some((p) => seqRetirees.has(p)) && !Object.keys(g.dependances || {}).some((k) => seqRetirees.has(Number(k)))) continue;
          const maj = { predecesseurs: preds.filter((p) => !seqRetirees.has(p)) };
          const dep = {};
          Object.entries(g.dependances || {}).forEach(([k, v]) => { if (!seqRetirees.has(Number(k))) dep[k] = v; });
          maj.dependances = dep;
          const { error: e2 } = await supabase.from('gammes_operatoires').update(maj).eq('id', g.id);
          if (e2) throw e2;
        }
        gammes = await lire();
      }
    }

    const codes = Array.isArray(ajouter) ? ajouter.filter(Boolean) : [];
    if (codes.length) {
      const { data: ops, error } = await supabase.from('operations').select('id, code').in('code', codes);
      if (error) throw error;
      const parCode = Object.fromEntries((ops || []).map((o) => [o.code, o.id]));
      const inconnus = codes.filter((c) => !parCode[c]);
      if (inconnus.length) return { statusCode: 400, body: JSON.stringify({ error: `Opération(s) inconnue(s) : ${inconnus.join(', ')}` }) };
      let suivante = Math.max(0, ...gammes.map((g) => g.sequence)) + 1;
      const lignes = codes.map((c) => ({ of_id: ofId, operation_id: parCode[c], sequence: suivante++, statut: 'à planifier', predecesseurs: [] }));
      const { error: eIns } = await supabase.from('gammes_operatoires').insert(lignes);
      if (eIns) throw eIns;
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, avertissements }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
