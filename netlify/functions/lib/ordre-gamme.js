// lib/ordre-gamme.js
//
// Ordre logique d'une gamme et dépendances implicites.
//
// Les numéros de séquence d'un OF reflètent l'ordre dans lequel les opérations ont été saisies, pas
// forcément l'ordre de fabrication. Une étape SANS prédécesseur déclaré (predecesseurs = null) était
// jusqu'ici rattachée à « l'étape de numéro précédent », ce qui donne des dates incohérentes.
// normaliserGamme() rend ces dépendances explicites, une fois pour toutes :
//   - si l'opération fonctionne en ligne avec une autre opération de l'OF (table liaisons_en_ligne :
//     contrôle couvertures avec montage, coloris tête avec massicot…), elle dépend de celle-ci ;
//   - sinon elle dépend de l'étape qui la précède dans l'ordre logique (ordre standard des opérations,
//     operations.ordre_defaut), en respectant les dépendances déjà déclarées.
// Seules les étapes dont predecesseurs est null sont modifiées ; l'opération est idempotente.

const EL = require('./en-ligne');

// Tri topologique stable : prédécesseurs déclarés d'abord, puis ordre standard, puis séquence.
// Une étape qui dépend de celle qui vient d'être placée la suit immédiatement.
function ordreLogique(gammes) {
  const parSeq = new Map(gammes.map((g) => [g.sequence, g]));
  const predsExpl = (g) => (Array.isArray(g.predecesseurs) ? g.predecesseurs.filter((s) => parSeq.has(s) && s !== g.sequence) : []);
  const cle = (g) => [g.operations && g.operations.ordre_defaut != null ? g.operations.ordre_defaut : 1e9, g.sequence];
  const avant = (a, b) => { const x = cle(a), y = cle(b); return x[0] - y[0] || x[1] - y[1]; };
  const restants = new Set(gammes.map((g) => g.sequence));
  const triees = [];
  while (restants.size) {
    const dispo = Array.from(restants).map((s) => parSeq.get(s)).filter((g) => predsExpl(g).every((s) => !restants.has(s)));
    const pool = dispo.length ? dispo : Array.from(restants).map((s) => parSeq.get(s));
    const derniere = triees.length ? triees[triees.length - 1].sequence : null;
    const suiveuses = derniere == null ? [] : pool.filter((g) => predsExpl(g).includes(derniere));
    const choix = (suiveuses.length ? suiveuses : pool).sort(avant)[0];
    triees.push(choix); restants.delete(choix.sequence);
  }
  return triees;
}

// Le prédécesseur Y peut-il être ajouté à X sans créer de boucle ? (X ne doit pas être un ancêtre de Y.)
function creeUneBoucle(predsDe, x, y) {
  const vus = new Set(); const pile = [y];
  while (pile.length) {
    const s = pile.pop();
    if (s === x) return true;
    if (vus.has(s)) continue; vus.add(s);
    (predsDe.get(s) || []).forEach((p) => pile.push(p));
  }
  return false;
}

async function normaliserGamme(supabase, ofId) {
  try {
    const { data, error } = await supabase.from('gammes_operatoires')
      .select('id, sequence, statut, predecesseurs, operations(id, code, nom, ordre_defaut)').eq('of_id', ofId);
    if (error || !data || !data.some((g) => !Array.isArray(g.predecesseurs))) return false;
    const regles = await EL.chargerRegles(supabase);
    const ordre = ordreLogique(data);
    const rang = new Map(ordre.map((g, i) => [g.sequence, i]));
    const predsDe = new Map(data.map((g) => [g.sequence, Array.isArray(g.predecesseurs) ? g.predecesseurs.slice() : null]));
    // Étapes sans prédécesseur déclaré, dans l'ordre logique : un prédécesseur est toujours résolu avant son successeur.
    for (const g of ordre) {
      if (predsDe.get(g.sequence)) continue;
      const i = rang.get(g.sequence);
      const code = g.operations && g.operations.code;
      let choisi = null;
      // 1) partenaire « en ligne » placé avant dans l'ordre logique
      for (let k = i - 1; k >= 0 && choisi === null; k--) {
        const y = ordre[k]; const cy = y.operations && y.operations.code;
        if (code && cy && regles.has(`${code}|${cy}`) && !creeUneBoucle(new Map([...predsDe].map(([s, v]) => [s, v || []])), g.sequence, y.sequence)) choisi = y.sequence;
      }
      // 2) sinon l'étape précédente dans l'ordre logique
      //    (une étape « en ligne » tourne en parallèle de son partenaire : on se rattache alors à ce partenaire,
      //    pour ne pas dépendre d'une étape annexe qui n'est peut-être pas encore planifiée)
      if (choisi === null && i > 0) {
        let c = ordre[i - 1].sequence;
        const parSeqOp = new Map(data.map((x) => [x.sequence, x.operations && x.operations.code]));
        for (let garde = 0; garde < 10; garde++) {
          const ps = predsDe.get(c) || [];
          const cote = ps.find((p) => parSeqOp.get(c) && parSeqOp.get(p) && regles.has(`${parSeqOp.get(c)}|${parSeqOp.get(p)}`));
          if (cote === undefined) break;
          c = cote;
        }
        choisi = c;
      }
      predsDe.set(g.sequence, choisi === null ? [] : [choisi]);
    }
    for (const g of data) {
      if (Array.isArray(g.predecesseurs)) continue;
      const { error: e2 } = await supabase.from('gammes_operatoires').update({ predecesseurs: predsDe.get(g.sequence) }).eq('id', g.id);
      if (e2) return false;
    }
    return true;
  } catch (_) { return false; }   // la normalisation ne doit jamais bloquer la planification
}

module.exports = { ordreLogique, normaliserGamme };
