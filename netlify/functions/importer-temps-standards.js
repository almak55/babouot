// functions/importer-temps-standards.js
//
// POST /.netlify/functions/importer-temps-standards
// body : { fichier_base64, appliquer?: false, ignorer_erreurs?: false }
//
// Importe un fichier Excel de temps standards (voir lib/excel-standards.js).
// En deux temps : appliquer=false renvoie un APERÇU (ce qui serait créé,
// modifié, inchangé, refusé, ligne par ligne) sans rien écrire ; appliquer=true
// écrit. Par défaut l'application est refusée s'il reste des lignes en erreur
// (rien n'est alors écrit) ; ignorer_erreurs=true importe seulement les lignes
// valides. Rien n'est jamais supprimé.
//
// Réponse : { resume: {creations, mises_a_jour, inchangees, erreurs},
//             caracteristiques: [...], phases: [...], applique, erreurs_fichier: [] }

const { getSupabase } = require('./lib/supabaseclient');
const { lireClasseur, analyserImport } = require('./lib/excel-standards');

const AFFICHAGE_MAX = 400;

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    const { fichier_base64, appliquer = false, ignorer_erreurs = false } = JSON.parse(event.body || '{}');
    if (!fichier_base64) return { statusCode: 400, body: JSON.stringify({ error: 'fichier_base64 requis.' }) };

    let lu;
    try { lu = lireClasseur(Buffer.from(fichier_base64, 'base64')); }
    catch (e) { return { statusCode: 400, body: JSON.stringify({ error: 'Fichier illisible : ce n\'est pas un classeur Excel (.xlsx) valide.' }) }; }
    if (lu.erreurs.length) return { statusCode: 400, body: JSON.stringify({ error: lu.erreurs.join(' ') }) };

    const supabase = getSupabase();
    const [opsRes, machinesRes, caracRes, phasesRes] = await Promise.all([
      supabase.from('operations').select('id, nom, code'),
      supabase.from('machines').select('id, nom, code'),
      supabase.from('caracteristiques_produit').select('*'),
      supabase.from('phases_standard').select('*'),
    ]);
    for (const r of [opsRes, machinesRes, caracRes, phasesRes]) if (r.error) throw r.error;

    const analyse = analyserImport(lu, { operations: opsRes.data, machines: machinesRes.data, caracteristiques: caracRes.data, phases: phasesRes.data });
    const reponse = {
      resume: analyse.resume,
      caracteristiques: analyse.caracteristiques.map(({ valeurs, ...x }) => x),
      phases: analyse.phases.map(({ valeurs, id, ...x }) => x).slice(0, AFFICHAGE_MAX),
      phases_tronquees: analyse.phases.length > AFFICHAGE_MAX,
      applique: false,
    };
    if (!appliquer) return { statusCode: 200, body: JSON.stringify(reponse) };

    if (analyse.resume.erreurs > 0 && !ignorer_erreurs) {
      return { statusCode: 409, body: JSON.stringify({ ...reponse, error: `${analyse.resume.erreurs} ligne(s) en erreur : corrigez le fichier, ou importez seulement les lignes valides.` }) };
    }

    // ---- Écriture : caractéristiques d'abord (les formules en dépendent), puis phases ----
    for (const c of analyse.caracteristiques) {
      if (c.statut === 'creation') {
        const { error } = await supabase.from('caracteristiques_produit').insert({ ...c.valeurs, ordre: 100 });
        if (error) throw error;
      } else if (c.statut === 'mise_a_jour') {
        const { error } = await supabase.from('caracteristiques_produit').update({ libelle: c.valeurs.libelle, unite: c.valeurs.unite }).eq('cle', c.valeurs.cle);
        if (error) throw error;
      }
    }
    const aCreer = analyse.phases.filter((p) => p.statut === 'creation').map((p) => p.valeurs);
    if (aCreer.length) {
      const { error } = await supabase.from('phases_standard').insert(aCreer);
      if (error) throw error;
    }
    for (const p of analyse.phases.filter((x) => x.statut === 'mise_a_jour')) {
      // L'identité (opération, machine, nom) ne change pas : une mise à jour ne doit pas
      // renommer la phase si le fichier n'a fait que changer la casse de son nom.
      const { operation_id, machine_id, nom, ...modifiable } = p.valeurs;
      const { error } = await supabase.from('phases_standard').update(modifiable).eq('id', p.id);
      if (error) throw error;
    }
    return { statusCode: 200, body: JSON.stringify({ ...reponse, applique: true }) };
  } catch (err) {
    console.error('importer-temps-standards error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
