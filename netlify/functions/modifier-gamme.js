// functions/modifier-gamme.js
//
// POST /.netlify/functions/modifier-gamme
// body : { of_id, ajouter?: ["EMBOITAGE_1", ...], apres_sequence?: n° d'étape après laquelle elles démarrent, supprimer?: ["gamme_id", ...],
//         mode_ligne?: { mode: 'en_ligne' | 'hors_ligne' | 'auto', gamme_id?: "uuid" (sinon toutes les étapes de l'OF) } }
//
// mode_ligne : pour les opérations qui peuvent tourner en ligne avec leur précédente (voir lib/en-ligne.js),
// choisit en ligne (production simultanée), hors ligne (après la fin de la précédente, durée propre) ou
// auto (règle générale). Réservé aux étapes « à planifier ».
//
// Ajoute à un OF existant des opérations du catalogue (par leur code) ou en
// retire. Une même opération peut être ajoutée plusieurs fois. Les opérations
// ajoutées sont « à planifier » et sans lien imposé (elles peuvent démarrer dès
// le début tant qu'on n'a pas indiqué « Démarre après »).
// recalculer_liens: true  refait toutes les dépendances de l'OF d'après le modèle de gamme (Pléiade) et les couples « en ligne ».
// Seules les étapes « à planifier » peuvent être retirées ; les liens qui
// pointaient vers elles sont nettoyés.

const { getSupabase } = require('./lib/supabaseclient');
const EL = require('./lib/en-ligne');

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    const { of_id: ofId, ajouter, supprimer, mode_ligne: modeLigne, apres_sequence: apresSeq, recalculer_liens: recalculer, avec_planning: avecPlanning } = JSON.parse(event.body || '{}');
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
        if (g.statut !== 'à planifier' && !(avecPlanning && g.statut === 'planifié')) {
          avertissements.push(`Étape ${g.sequence} conservée : elle est « ${g.statut} » (déplanifiez-la d'abord).`);
          continue;
        }
        retirees.push(g);
      }
      if (retirees.length) {
        // avec_planning : les créneaux d'une étape « planifié » sont supprimés avec elle (libère personnes et machines).
        const aLiberer = retirees.filter((g) => g.statut === 'planifié').map((g) => g.id);
        if (aLiberer.length) {
          const { data: cren, error: eC } = await supabase.from('planning_jour').select('id').in('gamme_operatoire_id', aLiberer);
          if (eC) throw eC;
          const idsC = (cren || []).map((c) => c.id);
          if (idsC.length) {
            const { error: eP } = await supabase.from('planning_jour_personnel').delete().in('planning_jour_id', idsC);
            if (eP) throw eP;
            const { error: eD } = await supabase.from('planning_jour').delete().in('id', idsC);
            if (eD) throw eD;
          }
        }
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

    if (modeLigne) {
      if (!['en_ligne', 'hors_ligne', 'auto'].includes(modeLigne.mode)) return { statusCode: 400, body: JSON.stringify({ error: 'mode_ligne.mode invalide (en_ligne | hors_ligne | auto).' }) };
      const { data: tout, error: eL } = await supabase.from('gammes_operatoires')
        .select('id, sequence, statut, predecesseurs, dependances, operations(code)').eq('of_id', ofId);
      if (eL) throw eL;
      const tri = (tout || []).slice().sort((a, b) => a.sequence - b.sequence);
      const regles = await EL.chargerRegles(supabase);
      let touchees = 0;
      for (let i = 0; i < tri.length; i++) {
        const g = tri[i];
        if (modeLigne.gamme_id && g.id !== modeLigne.gamme_id) continue;
        const preds = Array.isArray(g.predecesseurs) ? g.predecesseurs : (i > 0 ? [tri[i - 1].sequence] : []);
        const dep = { ...(g.dependances || {}) };
        let change = false;
        preds.forEach((s) => {
          const p = tri.find((x) => x.sequence === s);
          if (!p || !regles.has(`${g.operations.code}|${p.operations.code}`)) return;
          if (g.statut !== 'à planifier') { avertissements.push(`Étape ${g.sequence} inchangée : elle est « ${g.statut} » (déplanifiez-la d'abord).`); return; }
          const lien = { ...(dep[String(s)] || {}) };
          if (modeLigne.mode === 'auto') delete lien.en_ligne; else lien.en_ligne = modeLigne.mode === 'en_ligne';
          if (Object.keys(lien).length) dep[String(s)] = lien; else delete dep[String(s)];
          change = true;
        });
        if (!change) continue;
        const { error: eU } = await supabase.from('gammes_operatoires').update({ dependances: dep }).eq('id', g.id);
        if (eU) throw eU;
        touchees++;
      }
      if (!touchees && !avertissements.length) avertissements.push('Aucune opération de cet OF ne peut tourner en ligne.');
    }

    const codes = Array.isArray(ajouter) ? ajouter.filter(Boolean) : [];
    if (codes.length) {
      const { data: ops, error } = await supabase.from('operations').select('id, code').in('code', codes);
      if (error) throw error;
      const parCode = Object.fromEntries((ops || []).map((o) => [o.code, o.id]));
      const inconnus = codes.filter((c) => !parCode[c]);
      if (inconnus.length) return { statusCode: 400, body: JSON.stringify({ error: `Opération(s) inconnue(s) : ${inconnus.join(', ')}` }) };
      let suivante = Math.max(0, ...gammes.map((g) => g.sequence)) + 1;
      const lignes = codes.map((c) => ({ of_id: ofId, operation_id: parCode[c], sequence: suivante++, statut: 'à planifier', predecesseurs: Number.isInteger(apresSeq) && gammes.some((g) => g.sequence === apresSeq) ? [apresSeq] : [] }));
      const { error: eIns } = await supabase.from('gammes_operatoires').insert(lignes);
      if (eIns) throw eIns;
    }

    // Dépendances automatiques : relie les étapes sans lien (y compris celles qui dépendent d'une étape ajoutée)
    // d'après le modèle de gamme et les couples « en ligne » ; « recalculer » refait tous les liens.
    const { normaliserGamme } = require('./lib/ordre-gamme');
    const relie = await normaliserGamme(supabase, ofId, { tout: !!recalculer });
    if (recalculer) avertissements.push(relie ? 'Dépendances recalculées d\'après le modèle de gamme.' : 'Dépendances déjà à jour.');

    return { statusCode: 200, body: JSON.stringify({ ok: true, avertissements }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
