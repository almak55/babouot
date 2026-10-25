// functions/profils-machine.js
//
// Profils de temps d'une machine, par type de production (Pléiade, Cartonné…).
// Un profil = mise en route + réglage + roulage (cadence) + nettoyage, enregistré
// comme 4 phases dans phases_standard (machine + opération + type de production).
//
// GET    ?machine_id=uuid
//        -> { types: [{code, libelle}], profils: [{ operation_id, operation, type_production,
//             mise_en_route_min, reglage_min, cadence_par_h, nettoyage_min, nb_personnes }] }
// POST   { machine_id, operation_id, type_production|null, mise_en_route_min?, reglage_min?,
//          cadence_par_h?, nettoyage_min?, nb_personnes?, exemplaires_par_passage? }   -> crée ou remplace le profil
// POST   { action: 'ajouter_type', libelle }               -> ajoute un type de production
// DELETE ?machine_id=&operation_id=&type_production=       -> supprime le profil
//        (type_production vide ou « tous » = profil valable pour tous les types)
//
// Le temps total se calcule dans le chiffrage : mise en route + réglage + nettoyage
// + quantité de l'OF ÷ cadence.

const { getSupabase } = require('./lib/supabaseclient');
const { analyser } = require('./lib/formules');

const NOMS = { mise_en_route: 'Mise en route', reglage: 'Réglage', roulage: 'Roulage', nettoyage: 'Nettoyage' };
const NOMS_LISTE = Object.values(NOMS);

const nombre = (v) => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
const typeOuNull = (v) => (v === undefined || v === null || v === '' || v === 'tous' ? null : String(v));

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();
    const q = event.queryStringParameters || {};

    if (event.httpMethod === 'GET') {
      if (!q.machine_id) return { statusCode: 400, body: JSON.stringify({ error: 'machine_id requis.' }) };
      const [{ data: types, error: e1 }, { data: phases, error: e2 }] = await Promise.all([
        supabase.from('types_production').select('code, libelle').order('ordre'),
        supabase.from('phases_standard').select('*, operations(nom)').eq('machine_id', q.machine_id),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const profils = new Map();
      phases.filter((p) => NOMS_LISTE.includes(p.nom)).forEach((p) => {
        const cle = `${p.operation_id}|${p.type_production || ''}`;
        if (!profils.has(cle)) profils.set(cle, { operation_id: p.operation_id, operation: p.operations.nom, type_production: p.type_production, mise_en_route_min: null, reglage_min: null, cadence_par_h: null, nettoyage_min: null, nb_personnes: 1, quantite_formule: null, unite_cadence: null, par_passage: 1 });
        const pr = profils.get(cle);
        if (p.nom === NOMS.mise_en_route) pr.mise_en_route_min = Math.round(Number(p.duree_h) * 60 * 100) / 100;
        if (p.nom === NOMS.reglage) pr.reglage_min = Math.round(Number(p.duree_h) * 60 * 100) / 100;
        if (p.nom === NOMS.nettoyage) pr.nettoyage_min = Math.round(Number(p.duree_h) * 60 * 100) / 100;
        if (p.nom === NOMS.roulage) { pr.cadence_par_h = p.cadence_par_h === null ? null : Number(p.cadence_par_h); pr.nb_personnes = p.nb_personnes; pr.quantite_formule = p.quantite_formule || null; pr.unite_cadence = p.unite_cadence || null; pr.par_passage = Number(p.par_passage) > 1 ? Number(p.par_passage) : 1; }
      });
      return { statusCode: 200, body: JSON.stringify({ types, profils: Array.from(profils.values()) }) };
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');

      if (b.action === 'ajouter_type') {
        const libelle = String(b.libelle || '').trim();
        if (!libelle) return { statusCode: 400, body: JSON.stringify({ error: 'Libellé requis.' }) };
        const code = libelle.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        if (!/^[a-z][a-z0-9_]*$/.test(code)) return { statusCode: 400, body: JSON.stringify({ error: 'Libellé invalide : commencez par une lettre.' }) };
        const { error } = await supabase.from('types_production').insert({ code, libelle });
        if (error) throw error;
        return { statusCode: 200, body: JSON.stringify({ code, libelle }) };
      }

      if (!b.machine_id || !b.operation_id) return { statusCode: 400, body: JSON.stringify({ error: 'machine_id et operation_id requis.' }) };
      const type = typeOuNull(b.type_production);
      const valeurs = {
        mise_en_route: nombre(b.mise_en_route_min), reglage: nombre(b.reglage_min),
        nettoyage: nombre(b.nettoyage_min), cadence: nombre(b.cadence_par_h),
      };
      for (const [cle, v] of Object.entries(valeurs)) {
        if (Number.isNaN(v) || (v !== null && v < 0)) return { statusCode: 400, body: JSON.stringify({ error: `Valeur invalide pour « ${cle} » (nombre positif attendu).` }) };
      }
      if (valeurs.cadence !== null && valeurs.cadence <= 0) return { statusCode: 400, body: JSON.stringify({ error: 'La cadence doit être supérieure à 0 (exemplaires par heure).' }) };
      if (Object.values(valeurs).every((v) => v === null)) return { statusCode: 400, body: JSON.stringify({ error: 'Renseignez au moins une valeur.' }) };
      const nbPers = Math.max(1, parseInt(b.nb_personnes, 10) || 1);
      const parPassage = Math.max(1, parseInt(b.exemplaires_par_passage, 10) || 1);

      // Unité de la cadence (exemplaires, cahiers, coupes…) et quantité à traiter (formule sur la fiche).
      const unite = String(b.unite_cadence || '').trim() || null;
      let formule = String(b.quantite_formule || '').trim() || null;
      if (formule && formule.replace(/\s+/g, '') === 'quantite') formule = null;   // = quantité de l'OF : rien à calculer
      if (formule) {
        const a = analyser(formule);
        if (!a.ok) return { statusCode: 400, body: JSON.stringify({ error: `Quantité à traiter : formule invalide (${a.erreur}).` }) };
        const { data: cat, error: catErr } = await supabase.from('caracteristiques_produit').select('cle');
        if (catErr) throw catErr;
        const connues = new Set(cat.map((c) => c.cle));
        const inconnues = a.variables.filter((x) => x !== 'quantite' && !connues.has(x));
        if (inconnues.length) return { statusCode: 400, body: JSON.stringify({ error: `Caractéristique inconnue : ${inconnues.map((x) => `« ${x} »`).join(', ')}. Créez-la d'abord dans « Caractéristiques produit ».` }) };
      }

      await effacer(supabase, b.machine_id, b.operation_id, type);
      const lignes = [];
      const ajout = (nom, ordre, champs) => lignes.push({ operation_id: b.operation_id, machine_id: b.machine_id, type_production: type, nom, ordre, occupe_machine: true, nb_personnes: 1, ...champs });
      if (valeurs.mise_en_route !== null) ajout(NOMS.mise_en_route, 1, { type_calcul: 'fixe', duree_h: valeurs.mise_en_route / 60 });
      if (valeurs.reglage !== null) ajout(NOMS.reglage, 2, { type_calcul: 'fixe', duree_h: valeurs.reglage / 60 });
      if (valeurs.cadence !== null) ajout(NOMS.roulage, 3, { type_calcul: 'cadence', cadence_par_h: valeurs.cadence, nb_personnes: nbPers, ...(formule || unite ? { quantite_formule: formule, unite_cadence: unite } : {}), ...(parPassage > 1 ? { par_passage: parPassage } : {}) });
      if (valeurs.nettoyage !== null) ajout(NOMS.nettoyage, 4, { type_calcul: 'fixe', duree_h: valeurs.nettoyage / 60 });
      const { error } = await supabase.from('phases_standard').insert(lignes);
      if (error) throw new Error(/par_passage/.test(error.message || '') ? `${error.message} — exécutez d'abord la migration 43 dans Supabase.` : /quantite_formule|unite_cadence/.test(error.message || '') ? `${error.message} — exécutez d'abord la migration 24 dans Supabase.` : error.message);
      return { statusCode: 200, body: JSON.stringify({ ok: true, phases: lignes.length }) };
    }

    if (event.httpMethod === 'DELETE') {
      if (!q.machine_id || !q.operation_id) return { statusCode: 400, body: JSON.stringify({ error: 'machine_id et operation_id requis.' }) };
      await effacer(supabase, q.machine_id, q.operation_id, typeOuNull(q.type_production));
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

async function effacer(supabase, machineId, operationId, type) {
  let req = supabase.from('phases_standard').delete()
    .eq('machine_id', machineId).eq('operation_id', operationId).in('nom', NOMS_LISTE);
  req = type === null ? req.is('type_production', null) : req.eq('type_production', type);
  const { error } = await req;
  if (error) throw error;
}

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
