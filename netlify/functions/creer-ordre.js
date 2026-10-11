// functions/creer-ordre.js
//
// POST /.netlify/functions/creer-ordre
// body :
// {
//   titre: { nom, client, reference?, format? },   // ou titre_id si le titre existe déjà
//   titre_id: "uuid",                                // alternative à `titre`
//   quantite: 2000,
//   delai: "2026-10-15",
//   priorite: "normale" | "haute" | "urgente",
//   operations: ["MASSICOT", "PRESSURE_COLLE", "COUTURE", ...]  // codes, dans l'ordre de la gamme
// }
//
// Réponse : { of_id, numero, gammes_operatoires: [...] }

const { getSupabase } = require('./lib/supabaseclient');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    }
    const body = JSON.parse(event.body || '{}');
    const { titre, titre_id, quantite, delai, priorite, operations } = body;
    const typeProduction = body.type_production ? String(body.type_production) : null;

    if (!quantite || !Array.isArray(operations) || operations.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'quantite et operations (liste de codes, non vide) sont requis.' }),
      };
    }
    if (!titre && !titre_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Fournir soit titre (nouveau titre) soit titre_id (titre existant).' }),
      };
    }

    const supabase = getSupabase();

    // 1. Résoudre ou créer le titre.
    let titreId = titre_id;
    if (!titreId) {
      const { data: titreCree, error: titreError } = await supabase
        .from('titres')
        .insert({ nom: titre.nom, client: titre.client, reference: titre.reference, format: titre.format })
        .select('id')
        .single();
      if (titreError) throw titreError;
      titreId = titreCree.id;
    }

    // 2. Résoudre les codes d'opération en ids, dans l'ordre donné.
    const { data: ops, error: opsError } = await supabase
      .from('operations')
      .select('id, code')
      .in('code', operations);
    if (opsError) throw opsError;

    const opsParCode = {};
    ops.forEach((o) => { opsParCode[o.code] = o.id; });
    const inconnues = operations.filter((code) => !opsParCode[code]);
    if (inconnues.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Code(s) d'opération inconnu(s) : ${inconnues.join(', ')}` }),
      };
    }

    // 3. Numéro d'OF auto-incrémenté (OF-YYYY-NNNN).
    const annee = new Date().getFullYear();
    const { count, error: countError } = await supabase
      .from('ordres_fabrication')
      .select('id', { count: 'exact', head: true })
      .like('numero', `OF-${annee}-%`);
    if (countError) throw countError;
    const numero = `OF-${annee}-${String((count || 0) + 1).padStart(4, '0')}`;

    // 4. Créer l'OF.
    const ligneOf = {
      numero,
      titre_id: titreId,
      quantite,
      delai: delai || null,
      priorite: priorite || 'normale',
      statut: 'en attente de validation',
    };
    let { data: of, error: ofError } = await supabase
      .from('ordres_fabrication').insert(typeProduction ? { ...ligneOf, type_production: typeProduction } : ligneOf)
      .select('id, numero').single();
    if (ofError && typeProduction && /type_production/.test(ofError.message || '')) {
      // Migration 23 pas encore exécutée : on crée l'OF sans type de production.
      ({ data: of, error: ofError } = await supabase.from('ordres_fabrication').insert(ligneOf).select('id, numero').single());
    }
    if (ofError) throw ofError;

    // 5. Créer la gamme opératoire, dans l'ordre fourni.
    const gammeRows = operations.map((code, i) => ({
      of_id: of.id,
      operation_id: opsParCode[code],
      sequence: i + 1,
      statut: 'à planifier',
    }));
    const { data: gammes, error: gammesError } = await supabase
      .from('gammes_operatoires')
      .insert(gammeRows)
      .select('id, operation_id, sequence');
    if (gammesError) throw gammesError;

    return {
      statusCode: 200,
      body: JSON.stringify({ of_id: of.id, numero: of.numero, gammes_operatoires: gammes }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
