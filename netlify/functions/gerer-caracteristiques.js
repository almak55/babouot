// functions/gerer-caracteristiques.js
//
// Catalogue des caractéristiques produit (largeur, nombre de pages, nombre de
// fers…) utilisables comme variables dans les formules de temps standards.
//
// GET    /.netlify/functions/gerer-caracteristiques
// POST   { libelle, cle?, type?: 'nombre'|'texte', unite?, ordre? }   création
//        (cle déduite du libellé si absente : « Largeur (mm) » -> largeur_mm)
// PUT    { cle, libelle?, type?, unite?, ordre? }                    modification (la clé ne change pas)
// DELETE ?cle=...   refusée tant qu'une phase l'utilise (la réponse la nomme)

const { getSupabase } = require('./lib/supabaseclient');
const { analyser } = require('./lib/formules');
const { cleParam, verifierCle } = require('./lib/phases');

// Phases (formule ou « par élément ») qui utilisent cette caractéristique.
async function utilisations(supabase, cle) {
  const { data, error } = await supabase
    .from('phases_standard').select('nom, type_calcul, formule, element_param, operations(nom), machines(nom)');
  if (error) throw error;
  return data.filter((p) => {
    if (p.type_calcul === 'par_element') return p.element_param === cle;
    if (p.type_calcul === 'formule') { const a = analyser(p.formule); return a.ok && a.variables.includes(cle); }
    return false;
  }).map((p) => `${p.operations.nom}${p.machines ? ' (' + p.machines.nom + ')' : ''} — ${p.nom}`);
}

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase.from('caracteristiques_produit').select('*').order('ordre').order('libelle');
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      const libelle = String(b.libelle || '').trim();
      if (!libelle) return { statusCode: 400, body: JSON.stringify({ error: 'Le libellé est requis.' }) };
      let cle = cleParam(b.cle || libelle);
      if (/^[0-9]/.test(cle)) cle = `c_${cle}`;
      const probleme = verifierCle(cle);
      if (probleme) return { statusCode: 400, body: JSON.stringify({ error: probleme }) };
      const type = b.type === 'texte' ? 'texte' : 'nombre';
      const { data, error } = await supabase.from('caracteristiques_produit')
        .insert({ cle, libelle, type, unite: String(b.unite || '').trim() || null, ordre: Number.isInteger(Number(b.ordre)) ? Number(b.ordre) : 100 })
        .select('cle').single();
      if (error) {
        if (error.code === '23505') return { statusCode: 409, body: JSON.stringify({ error: `La clé « ${cle} » existe déjà.` }) };
        throw error;
      }
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'PUT') {
      const b = JSON.parse(event.body || '{}');
      if (!b.cle) return { statusCode: 400, body: JSON.stringify({ error: 'cle requise.' }) };
      const maj = {};
      if (b.libelle !== undefined) {
        if (!String(b.libelle).trim()) return { statusCode: 400, body: JSON.stringify({ error: 'Le libellé ne peut pas être vide.' }) };
        maj.libelle = String(b.libelle).trim();
      }
      if (b.unite !== undefined) maj.unite = String(b.unite || '').trim() || null;
      if (b.ordre !== undefined && Number.isInteger(Number(b.ordre))) maj.ordre = Number(b.ordre);
      if (b.type !== undefined) {
        if (!['nombre', 'texte'].includes(b.type)) return { statusCode: 400, body: JSON.stringify({ error: 'type invalide (nombre | texte).' }) };
        const { data: actuel, error: aErr } = await supabase.from('caracteristiques_produit').select('type').eq('cle', b.cle).maybeSingle();
        if (aErr) throw aErr;
        if (actuel && actuel.type !== b.type) {
          const usages = await utilisations(supabase, b.cle);
          if (usages.length) return { statusCode: 409, body: JSON.stringify({ error: `Changer le type casserait des formules : ${usages.join(' ; ')}.`, utilisee_par: usages }) };
        }
        maj.type = b.type;
      }
      const { data, error } = await supabase.from('caracteristiques_produit').update(maj).eq('cle', b.cle).select('cle').single();
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'DELETE') {
      const cle = (event.queryStringParameters || {}).cle;
      if (!cle) return { statusCode: 400, body: JSON.stringify({ error: 'Paramètre cle requis.' }) };
      const usages = await utilisations(supabase, cle);
      if (usages.length) {
        return { statusCode: 409, body: JSON.stringify({ error: `Utilisée par : ${usages.join(' ; ')}. Modifiez ou supprimez ces phases d'abord.`, utilisee_par: usages }) };
      }
      const { error } = await supabase.from('caracteristiques_produit').delete().eq('cle', cle);
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
  } catch (err) {
    console.error('gerer-caracteristiques error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
