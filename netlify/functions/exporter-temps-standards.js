// functions/exporter-temps-standards.js
//
// GET /.netlify/functions/exporter-temps-standards
// -> { nom: "temps-standards-AAAA-MM-JJ.xlsx", fichier_base64 }
//
// Exporte toutes les phases et caractéristiques au format Excel, avec les
// feuilles d'aide et de listes. Sert aussi de MODÈLE à remplir (s'il n'y a
// encore rien, le fichier contient des lignes d'exemple ignorées à l'import).

const { getSupabase } = require('./lib/supabaseclient');
const { construireClasseur } = require('./lib/excel-standards');

const handlerProtege = async () => {
  try {
    const supabase = getSupabase();
    const [phasesRes, opsRes, machinesRes, caracRes] = await Promise.all([
      supabase.from('phases_standard').select('*, operations(nom), machines(nom)'),
      supabase.from('operations').select('nom').order('nom'),
      supabase.from('machines').select('nom').order('nom'),
      supabase.from('caracteristiques_produit').select('*').order('ordre').order('libelle'),
    ]);
    for (const r of [phasesRes, opsRes, machinesRes, caracRes]) if (r.error) throw r.error;

    const phases = phasesRes.data.slice().sort((a, b) =>
      a.operations.nom.localeCompare(b.operations.nom, 'fr') ||
      (a.machines ? a.machines.nom : '').localeCompare(b.machines ? b.machines.nom : '', 'fr') || a.ordre - b.ordre);

    const buffer = construireClasseur({ phases, operations: opsRes.data, machines: machinesRes.data, caracteristiques: caracRes.data });
    return {
      statusCode: 200,
      body: JSON.stringify({ nom: `temps-standards-${new Date().toISOString().slice(0, 10)}.xlsx`, fichier_base64: buffer.toString('base64') }),
    };
  } catch (err) {
    console.error('exporter-temps-standards error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
