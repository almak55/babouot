// lib/ordre-gamme.js
//
// Ordre logique d'une gamme et dépendances automatiques.
//
// Les numéros de séquence d'un OF reflètent l'ordre de saisie, pas l'ordre de fabrication. Pour qu'une
// étape sans dépendance déclarée (predecesseurs null ou vide) soit correctement reliée, normaliserGamme()
// lui déduit ses prédécesseurs :
//   1) du modèle de gamme (table pleiade_gamme_modele : « Applats après Montage », « Contrôle couvertures
//      en simultané avec Montage »…), en sautant les opérations absentes de l'OF ;
//   2) sinon d'un partenaire « en ligne » (table liaisons_en_ligne) placé avant dans l'ordre logique ;
//   3) sinon (predecesseurs null seulement) de l'étape qui précède dans l'ordre standard des opérations
//      (operations.ordre_defaut).
// Une étape ajoutée plus tard (ex. montage) relie aussi les étapes déjà présentes qui en dépendent.
// Seules les étapes sans dépendance sont modifiées, sauf { tout: true } (bouton « Recalculer »).
// L'opération est idempotente et ne bloque jamais la planification.

const EL = require('./en-ligne');
const { baseCode } = EL;

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

// Y est-il déjà un descendant de X (ajouter Y comme prédécesseur de X créerait une boucle) ?
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

async function chargerModele(supabase) {
  try {
    const { data, error } = await supabase.from('pleiade_gamme_modele').select('code, operation_code, predecesseurs, simultane, seuil_pct');
    if (error || !data) return new Map();
    return new Map(data.map((r) => [r.code, r]));
  } catch (_) { return new Map(); }
}

async function normaliserGamme(supabase, ofId, options) {
  const tout = !!(options && options.tout);
  try {
    const { data, error } = await supabase.from('gammes_operatoires')
      .select('id, sequence, statut, predecesseurs, dependances, operations(id, code, nom, ordre_defaut)').eq('of_id', ofId);
    if (error || !data || !data.length) return false;
    const aTraiter = (g) => tout || !Array.isArray(g.predecesseurs) || g.predecesseurs.length === 0;
    if (!data.some(aTraiter)) return false;
    const [regles, modele] = await Promise.all([EL.chargerRegles(supabase), chargerModele(supabase)]);
    const code = (g) => baseCode(g.operations && g.operations.code);
    const parBase = new Map();                       // code de base -> étapes de l'OF
    data.forEach((g) => { const c = code(g); if (!parBase.has(c)) parBase.set(c, []); parBase.get(c).push(g); });
    const ligneModele = (c) => Array.from(modele.values()).find((r) => baseCode(r.operation_code) === c);

    // Prédécesseurs d'une étape d'après le modèle, en sautant les opérations absentes de l'OF.
    const depuisModele = (g) => {
      const ligne = ligneModele(code(g));
      if (!ligne) return { seqs: [], simultanes: new Map() };
      const seqs = new Set(); const simultanes = new Map();
      const explorer = (codesModele, vus, direct) => {
        for (const cm of codesModele || []) {
          if (vus.has(cm)) continue; vus.add(cm);
          const r = modele.get(cm); if (!r) continue;
          const presentes = (parBase.get(baseCode(r.operation_code)) || []).filter((x) => x.sequence !== g.sequence);
          if (presentes.length) {
            presentes.forEach((x) => { seqs.add(x.sequence); if (direct && (ligne.simultane || []).includes(cm)) simultanes.set(x.sequence, ligne.seuil_pct || 10); });
          } else explorer(r.predecesseurs, vus, false);
        }
      };
      explorer(ligne.predecesseurs, new Set(), true);
      return { seqs: Array.from(seqs), simultanes };
    };

    // Dans l'ordre logique les étapes sont résolues du début vers la fin.
    const base0 = data.map((g) => ({ ...g, predecesseurs: aTraiter(g) ? null : g.predecesseurs }));
    const ordre = ordreLogique(base0);
    const rang = new Map(ordre.map((g, i) => [g.sequence, i]));
    const predsDe = new Map(data.map((g) => [g.sequence, aTraiter(g) ? null : g.predecesseurs.slice()]));
    const depsDe = new Map();
    const codeParSeq = new Map(data.map((g) => [g.sequence, code(g)]));
    const resolu = () => new Map([...predsDe].map(([s, v]) => [s, v || []]));
    const parSeq = new Map(data.map((g) => [g.sequence, g]));

    // 1re passe : modèle et partenaires « en ligne », toutes étapes à traiter
    for (const g of ordre) {
      if (predsDe.get(g.sequence)) continue;
      const i = rang.get(g.sequence);
      const m = depuisModele(g);
      let choisis = m.seqs.filter((s) => !creeUneBoucle(resolu(), g.sequence, s));
      if (choisis.length) {
        const dep = {};
        m.simultanes.forEach((seuil, s) => { if (choisis.includes(s) && !regles.has(`${code(g)}|${codeParSeq.get(s)}`)) dep[s] = { mode: 'progressif', seuil_pct: seuil }; });
        if (Object.keys(dep).length) depsDe.set(g.sequence, dep);
        predsDe.set(g.sequence, choisis); continue;
      }
      // partenaire « en ligne » placé avant dans l'ordre logique
      let partenaire = null;
      for (let k = i - 1; k >= 0 && partenaire === null; k--) {
        const y = ordre[k];
        if (regles.has(`${code(g)}|${code(y)}`) && !creeUneBoucle(resolu(), g.sequence, y.sequence)) partenaire = y.sequence;
      }
      if (partenaire !== null) { predsDe.set(g.sequence, [partenaire]); continue; }
      // étapes dont predecesseurs vaut null seulement : étape précédente dans l'ordre logique (hors étapes « en ligne » annexes)
      if ((tout || !Array.isArray(parSeq.get(g.sequence).predecesseurs)) && i > 0) {
        let c = ordre[i - 1].sequence;
        for (let garde = 0; garde < 10; garde++) {
          const ps = predsDe.get(c) || [];
          const cote = ps.find((p) => codeParSeq.get(c) && codeParSeq.get(p) && regles.has(`${codeParSeq.get(c)}|${codeParSeq.get(p)}`));
          if (cote === undefined) break;
          c = cote;
        }
        predsDe.set(g.sequence, [c]);
      } else predsDe.set(g.sequence, []);
    }

    let modifiees = 0;
    for (const g of data) {
      if (!aTraiter(g)) continue;
      const nouveaux = predsDe.get(g.sequence) || [];
      const dep = depsDe.get(g.sequence);
      const memePreds = Array.isArray(g.predecesseurs) && g.predecesseurs.length === nouveaux.length && g.predecesseurs.every((p) => nouveaux.includes(p));
      if (memePreds && !dep) continue;
      const maj = { predecesseurs: nouveaux };
      if (dep) maj.dependances = { ...(g.dependances || {}), ...dep };
      const { error: e2 } = await supabase.from('gammes_operatoires').update(maj).eq('id', g.id);
      if (e2) return false;
      modifiees++;
    }
    return modifiees > 0;
  } catch (_) { return false; }   // ne jamais bloquer la planification
}

module.exports = { ordreLogique, normaliserGamme };
