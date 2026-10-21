// functions/lib/pleiade.js
//
// Logique de la fiche de fabrication Pléiade : valeurs déduites de la catégorie,
// puis gamme déduite du modèle (pleiade_gamme_modele) selon les variantes.

const CONDITIONS = ['toujours', 'simple', 'pave', 'coffret', 'rhodoides', 'etuis', 'a_la_demande'];

async function chargerReferentiel(supabase) {
  const [cats, modele, params] = await Promise.all([
    supabase.from('pleiade_categories').select('*').order('ordre'),
    supabase.from('pleiade_gamme_modele').select('*').order('ordre'),
    supabase.from('pleiade_parametres').select('cle, valeur'),
  ]);
  for (const r of [cats, modele, params]) if (r.error) throw r.error;
  const p = {};
  (params.data || []).forEach((x) => { p[x.cle] = x.valeur; });
  return { categories: cats.data || [], modele: modele.data || [], parametres: p };
}

const vide = (v) => v === null || v === undefined || String(v).trim() === '';

// Valeurs de la fiche déduites de la catégorie + variantes.
function valeursFiche(ref, opts) {
  const cat = ref.categories.find((c) => c.code === opts.categorie);
  if (!cat) throw new Error(`Catégorie Pléiade inconnue : ${opts.categorie}`);
  const P = ref.parametres;
  const oui = (k) => String(P[k] || 'oui').toLowerCase() !== 'non';
  const pave = !vide(cat.piece);
  return {
    categorie: cat.code,
    categorie_libelle: cat.libelle,
    client: P.client || '',
    format_bloc: P.format_bloc || '',
    carton: P.carton || 'Carton pléiade',
    couleur_tete: vide(cat.tete) ? '' : cat.tete,
    gardes: cat.gardes || '',
    couleur_peau: cat.cuir || '',
    tranchefile: oui('tranchefile') ? (cat.tranchefile || '') : '',
    signets: oui('signets') ? (cat.signets || '') : '',
    pave,
    piece_pave: pave ? [cat.piece, cat.piece_ref].filter((x) => !vide(x)).join(' ') : '',
    applats: true,
    fournisseurs: (P.fournisseurs || '').split(';').map((s) => s.trim()).filter(Boolean),
    notes: cat.notes || '',
  };
}

function actif(etape, opts, pave) {
  switch (etape.condition) {
    case 'toujours': return true;
    case 'simple': return !!opts.simple;
    case 'pave': return !!pave;
    case 'coffret': return !!opts.coffret;
    case 'rhodoides': return !!opts.rhodoides;
    case 'etuis': return !!opts.etuis;
    case 'a_la_demande': return !!opts.reparations_volumes;
    default: return true;
  }
}

// Gamme du modèle : étapes actives, avec prédécesseurs recalculés (les étapes inactives sont sautées).
function construireGamme(ref, opts, pave) {
  const modele = ref.modele;
  const parCode = Object.fromEntries(modele.map((e) => [e.code, e]));
  const actives = modele.filter((e) => actif(e, opts, pave)).sort((a, b) => a.ordre - b.ordre);
  const estActive = new Set(actives.map((e) => e.code));
  const seq = {};
  actives.forEach((e, i) => { seq[e.code] = i + 1; });

  // Remplace un prédécesseur inactif par ses propres prédécesseurs (récursif).
  const resoudre = (code, vus = new Set()) => {
    if (vus.has(code)) return [];
    vus.add(code);
    if (estActive.has(code)) return [code];
    const e = parCode[code];
    if (!e) return [];
    return (e.predecesseurs || []).flatMap((p) => resoudre(p, vus));
  };

  return actives.map((e) => {
    const preds = Array.from(new Set((e.predecesseurs || []).flatMap((p) => resoudre(p))));
    const simult = new Set((e.simultane || []).flatMap((p) => resoudre(p)));
    const dependances = {};
    preds.forEach((p) => { if (simult.has(p)) dependances[String(seq[p])] = { mode: 'progressif', seuil_pct: e.seuil_pct || 10 }; });
    return {
      code: e.code,
      sequence: seq[e.code],
      operation_code: e.operation_code,
      libelle: e.libelle || e.operation_code,
      predecesseurs: preds.map((p) => seq[p]),
      predecesseurs_libelles: preds.map((p) => parCode[p].libelle || p),
      dependances,
      machine_code: e.machine_code || null,
      notes: e.notes || null,
    };
  });
}

// Caractéristiques enregistrées sur l'OF (uniquement celles du catalogue).
function caracteristiquesOf(valeurs, opts) {
  const c = {
    categorie_pleiade: valeurs.categorie_libelle,
    couleur_tete: valeurs.couleur_tete,
    gardes: valeurs.gardes,
    couleur_peau: valeurs.couleur_peau,
    tranchefile: valeurs.tranchefile,
    signets: valeurs.signets,
    piece_pave: valeurs.piece_pave,
    carton: valeurs.carton,
    format_bloc: valeurs.format_bloc,
    auteur: opts.auteur,
    reception_peaux: opts.date_reception_peaux,
  };
  if (opts.nb_pages) c.nb_pages = Number(opts.nb_pages);
  if (opts.nb_cahiers) c.nb_cahiers = Number(opts.nb_cahiers);
  return Object.fromEntries(Object.entries(c).filter(([, v]) => !vide(v)));
}

module.exports = { CONDITIONS, chargerReferentiel, valeursFiche, construireGamme, caracteristiquesOf, vide };
