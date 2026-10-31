// functions/gerer-dependances.js
//
// Dépendances STANDARDS entre opérations : le modèle de gamme (table pleiade_gamme_modele).
// Ce modèle sert à créer les OF Pléiade et, pour TOUS les OF, au bouton « Recalculer les dépendances »
// (lib/ordre-gamme.js : « Applats après Montage », « Contrôle couvertures en simultané avec Montage »…).
// Il ne modifie jamais un OF existant : seuls les nouveaux OF et le recalcul d'un OF l'utilisent.
//
// GET    -> { lignes: [{ code, ordre, operation_code, operation, libelle, condition, predecesseurs, simultane, seuil_pct, personnalisee }],
//             operations: [{ code, nom, dans_modele }] }
// PUT    body { code, predecesseurs: [code], simultane?: [code], seuil_pct? }
//          -> remplace les dépendances d'une ligne du modèle (simultane = parmi les prédécesseurs : démarrage progressif)
// POST   body { operation_code, predecesseurs?, simultane?, seuil_pct? }
//          -> ajoute une opération au modèle (ligne « personnalisée », condition 'standard' : jamais proposée dans une gamme Pléiade)
// DELETE ?code=XXX -> retire une ligne personnalisée (les lignes d'origine du modèle Pléiade ne se suppriment pas)

const { getSupabase } = require('./lib/supabaseclient');

const rep = (statusCode, obj) => ({ statusCode, body: JSON.stringify(obj) });
const slug = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
const liste = (v) => (Array.isArray(v) ? Array.from(new Set(v.filter((x) => typeof x === 'string' && x))) : []);

// Ajouter `code -> preds` crée-t-il une boucle ? (un des prédécesseurs dépend déjà, directement ou non, de `code`)
function creeUneBoucle(modele, code, preds) {
  const predsDe = new Map(modele.map((r) => [r.code, r.code === code ? preds : (r.predecesseurs || [])]));
  const vus = new Set(); const pile = [...preds];
  while (pile.length) {
    const c = pile.pop();
    if (c === code) return true;
    if (vus.has(c)) continue; vus.add(c);
    (predsDe.get(c) || []).forEach((p) => pile.push(p));
  }
  return false;
}

function verifier(modele, code, predecesseurs, simultane, seuil) {
  const codes = new Set(modele.map((r) => r.code));
  const inconnus = predecesseurs.filter((p) => !codes.has(p));
  if (inconnus.length) return `Étape inconnue du modèle : ${inconnus.join(', ')}.`;
  if (predecesseurs.includes(code)) return 'Une opération ne peut pas dépendre d\'elle-même.';
  if (simultane.some((s) => !predecesseurs.includes(s))) return 'Une opération « en simultané » doit aussi figurer parmi les opérations attendues.';
  if (seuil !== undefined && !(Number.isInteger(seuil) && seuil >= 1 && seuil <= 100)) return 'Le seuil de démarrage progressif doit être un entier entre 1 et 100 (%).';
  if (creeUneBoucle(modele, code, predecesseurs)) return 'Ces dépendances créeraient une boucle (A attend B qui attend A).';
  return null;
}

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();
    const m = event.httpMethod;
    const [mod, ops] = await Promise.all([
      supabase.from('pleiade_gamme_modele').select('*').order('ordre'),
      supabase.from('operations').select('code, nom, ordre_defaut').order('ordre_defaut', { nullsFirst: false }).order('nom'),
    ]);
    if (mod.error) throw mod.error;
    if (ops.error) throw ops.error;
    const modele = mod.data || [];
    const nomOp = Object.fromEntries((ops.data || []).map((o) => [o.code, o.nom]));

    if (m === 'GET') {
      const dans = new Set(modele.map((r) => r.operation_code));
      return rep(200, {
        lignes: modele.map((r) => ({
          code: r.code, ordre: r.ordre, operation_code: r.operation_code, operation: nomOp[r.operation_code] || r.operation_code,
          libelle: r.libelle || nomOp[r.operation_code] || r.code, condition: r.condition,
          predecesseurs: r.predecesseurs || [], simultane: r.simultane || [], seuil_pct: r.seuil_pct || 10, personnalisee: r.condition === 'standard',
        })),
        operations: (ops.data || []).map((o) => ({ code: o.code, nom: o.nom, dans_modele: dans.has(o.code) })),
      });
    }

    const b = m === 'DELETE' ? {} : JSON.parse(event.body || '{}');

    if (m === 'PUT') {
      const ligne = modele.find((r) => r.code === b.code);
      if (!ligne) return rep(404, { error: 'Ligne du modèle introuvable.' });
      const predecesseurs = liste(b.predecesseurs), simultane = liste(b.simultane);
      const seuil = b.seuil_pct === undefined || b.seuil_pct === null || b.seuil_pct === '' ? undefined : Number(b.seuil_pct);
      const erreur = verifier(modele, b.code, predecesseurs, simultane, seuil);
      if (erreur) return rep(409, { error: erreur });
      const maj = { predecesseurs, simultane };
      if (seuil !== undefined) maj.seuil_pct = seuil;
      const { error } = await supabase.from('pleiade_gamme_modele').update(maj).eq('code', b.code);
      if (error) throw error;
      return rep(200, { ok: true });
    }

    if (m === 'POST') {
      const op = (ops.data || []).find((o) => o.code === b.operation_code);
      if (!op) return rep(400, { error: 'Opération inconnue.' });
      const existante = modele.find((r) => r.operation_code === op.code);
      if (existante) return rep(409, { error: `« ${op.nom} » a déjà une ligne dans le modèle (« ${existante.libelle || existante.code} »). Modifiez-la plutôt.` });
      let code = `STD_${slug(op.code)}`;
      if (modele.some((r) => r.code === code)) code += `_${modele.length}`;
      const predecesseurs = liste(b.predecesseurs), simultane = liste(b.simultane);
      const seuil = b.seuil_pct === undefined || b.seuil_pct === null || b.seuil_pct === '' ? 10 : Number(b.seuil_pct);
      const erreur = verifier([...modele, { code, predecesseurs: [] }], code, predecesseurs, simultane, seuil);
      if (erreur) return rep(409, { error: erreur });
      const ordre = modele.reduce((mx, r) => Math.max(mx, Number(r.ordre) || 0), 0) + 10;
      const { error } = await supabase.from('pleiade_gamme_modele')
        .insert({ code, ordre, operation_code: op.code, libelle: op.nom, condition: 'standard', predecesseurs, simultane, seuil_pct: seuil, notes: 'Dépendances standards ajoutées depuis Temps standards (hors Pléiade).' });
      if (error) throw error;
      return rep(200, { ok: true, code });
    }

    if (m === 'DELETE') {
      const code = (event.queryStringParameters || {}).code;
      const ligne = modele.find((r) => r.code === code);
      if (!ligne) return rep(404, { error: 'Ligne du modèle introuvable.' });
      if (ligne.condition !== 'standard') return rep(409, { error: 'Cette ligne fait partie du modèle Pléiade : elle ne se supprime pas (modifiez ses dépendances).' });
      // Les autres lignes qui l'attendaient ne l'attendent plus.
      for (const r of modele) {
        if (r.code === code) continue;
        const p = r.predecesseurs || [], s = r.simultane || [];
        if (p.includes(code) || s.includes(code)) {
          const { error: e1 } = await supabase.from('pleiade_gamme_modele').update({ predecesseurs: p.filter((x) => x !== code), simultane: s.filter((x) => x !== code) }).eq('code', r.code);
          if (e1) throw e1;
        }
      }
      const { error } = await supabase.from('pleiade_gamme_modele').delete().eq('code', code);
      if (error) throw error;
      return rep(200, { ok: true });
    }

    return rep(405, { error: 'Méthode non autorisée.' });
  } catch (err) {
    return rep(500, { error: err.message });
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
