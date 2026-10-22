// functions/generer-coffret.js
//
// OF « Coffret » : mise de 2 volumes Pléiade ou plus dans un coffret.
//
// GET  -> { ofs: [OF Pléiade avec leur quantité déjà affectée aux coffrets] }
// POST { action: 'apercu'|'creer', titre, client?, nb_coffrets, volumes_par_coffret, delai?, priorite?,
//        sources: [ { source: 'emboitage'|'stock'|'retour', of_source_id?, libelle?, quantite } ] }
//
// Gamme : [Déconditionnement si retours] -> Découpe de jaquettes (indépendante) -> Rainage
//         -> Pose de jaquettes (après rainage et déconditionnement) -> Pose de rhodoïds
//         -> Mise en coffrets -> Mise en caisses et palettes.
// La quantité de l'OF = nombre de volumes ; le reste de chaque OF Pléiade source part au conditionnement standard.

const { getSupabase } = require('./lib/supabaseclient');
const creerOrdre = require('./creer-ordre');

const rep = (code, o) => ({ statusCode: code, body: JSON.stringify(o) });

function gamme(aRetours) {
  const e = [];
  const add = (code, libelle, preds, simult) => e.push({ code, libelle, operation_code: code, preds, simult: simult || [] });
  if (aRetours) add('DECONDITIONNEMENT', 'Déconditionnement (retours clients)', []);
  add('DECOUPE_JAQUETTES', 'Découpe de jaquettes', []);
  add('RAINAGE_JAQUETTES', 'Rainage de jaquettes', ['DECOUPE_JAQUETTES']);
  add('POSE_JAQUETTES', 'Mise en jaquettes du bloc', ['RAINAGE_JAQUETTES'].concat(aRetours ? ['DECONDITIONNEMENT'] : []));
  add('POSE_RHODOIDS', 'Mise sous rhodoïds', ['POSE_JAQUETTES']);
  add('MISE_EN_COFFRETS', 'Mise en coffrets', ['POSE_RHODOIDS']);
  add('MISE_EN_CAISSES', 'Mise en caisses et palettes', ['MISE_EN_COFFRETS']);
  const seq = Object.fromEntries(e.map((x, i) => [x.code, i + 1]));
  return e.map((x) => ({ ...x, sequence: seq[x.code], predecesseurs: x.preds.map((p) => seq[p]), predecesseurs_libelles: x.preds.map((p) => e.find((y) => y.code === p).libelle), dependances: {} }));
}

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();
    if (event.httpMethod === 'GET') {
      const { data: ofs, error } = await supabase.from('ordres_fabrication')
        .select('id, numero, quantite, titres(nom), type_production').eq('type_production', 'pleiade');
      if (error) throw error;
      const { data: src, error: e2 } = await supabase.from('coffret_sources').select('of_source_id, quantite').eq('source', 'emboitage');
      if (e2) throw e2;
      const pris = {};
      (src || []).forEach((s) => { pris[s.of_source_id] = (pris[s.of_source_id] || 0) + s.quantite; });
      return rep(200, { ofs: (ofs || []).map((o) => ({ id: o.id, numero: o.numero, titre: o.titres ? o.titres.nom : '', quantite: o.quantite, deja_affecte: pris[o.id] || 0 })) });
    }
    if (event.httpMethod !== 'POST') return rep(405, { error: 'Méthode non autorisée.' });
    const b = JSON.parse(event.body || '{}');
    const nb = parseInt(b.nb_coffrets, 10), vpc = parseInt(b.volumes_par_coffret, 10);
    if (!(nb > 0) || !(vpc >= 2)) return rep(400, { error: 'nb_coffrets (≥ 1) et volumes_par_coffret (≥ 2) requis.' });
    const sources = (Array.isArray(b.sources) ? b.sources : []).filter((s) => Number(s.quantite) > 0)
      .map((s) => ({ source: s.source, of_source_id: s.of_source_id || null, libelle: s.libelle || null, quantite: parseInt(s.quantite, 10) }));
    if (sources.some((s) => !['emboitage', 'stock', 'retour'].includes(s.source))) return rep(400, { error: 'Source inconnue.' });
    if (sources.some((s) => s.source === 'emboitage' && !s.of_source_id)) return rep(400, { error: 'Une source « emboîtage 1 » doit indiquer l\'OF Pléiade.' });

    const besoin = nb * vpc;
    const total = sources.reduce((a, s) => a + s.quantite, 0);
    const avertissements = [];
    if (total !== besoin) avertissements.push(`Volumes affectés : ${total} pour ${besoin} nécessaires (${nb} coffrets × ${vpc}).`);

    // Quantité disponible dans chaque OF Pléiade source.
    for (const s of sources.filter((x) => x.source === 'emboitage')) {
      const { data: of } = await supabase.from('ordres_fabrication').select('numero, quantite').eq('id', s.of_source_id).single();
      const { data: deja } = await supabase.from('coffret_sources').select('quantite').eq('of_source_id', s.of_source_id).eq('source', 'emboitage');
      const pris = (deja || []).reduce((a, x) => a + x.quantite, 0);
      if (of && pris + s.quantite > of.quantite) avertissements.push(`${of.numero} : ${pris + s.quantite} volumes affectés aux coffrets pour ${of.quantite} produits.`);
      if (of) { s.reste_standard = Math.max(0, of.quantite - pris - s.quantite); s.numero = of.numero; }
    }

    const g = gamme(sources.some((s) => s.source === 'retour'));
    const reponse = { besoin, total, gamme: g, sources, avertissements };
    if (b.action !== 'creer') return rep(200, reponse);
    if (!b.titre) return rep(400, { error: 'titre requis.' });
    if (total !== besoin) return rep(400, { error: reponse.avertissements[0] + ' Corrigez la répartition avant de créer l\'OF.' });

    const res = await creerOrdre.handler({ httpMethod: 'POST', body: JSON.stringify({
      titre: { nom: b.titre, client: b.client || null },
      quantite: besoin, delai: b.delai || null, priorite: b.priorite || 'normale', type_production: 'coffret',
      caracteristiques: { volumes_par_coffret: vpc, nb_coffrets: nb },
      operations: g.map((x) => x.operation_code),
    }) });
    if (res.statusCode !== 200) return res;
    const cree = JSON.parse(res.body);
    for (const x of g) {
      const l = cree.gammes_operatoires.find((y) => y.sequence === x.sequence);
      const { error } = await supabase.from('gammes_operatoires').update({ predecesseurs: x.predecesseurs, dependances: x.dependances }).eq('id', l.id);
      if (error) throw error;
    }
    if (sources.length) {
      const { error } = await supabase.from('coffret_sources').insert(sources.map((s) => ({ coffret_of_id: cree.of_id, source: s.source, of_source_id: s.of_source_id, libelle: s.libelle, quantite: s.quantite })));
      if (error) throw error;
    }
    return rep(200, { ...reponse, of_id: cree.of_id, numero: cree.numero });
  } catch (err) {
    return rep(500, { error: err.message });
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
