// functions/planning-annuel.js
//
// Planning annuel Pléiade (référence Gallimard) : liste des titres, proposition d'ordre de production
// et création des OF.
//
// GET                         -> { lignes, parametres, legende }
// PUT   { id, ...champs }     modifie une ligne (carte_dos, tete, peau, quantite, mois, statut, categorie, notes...)
// POST  { action:'ajouter', titre, ... }
// DELETE ?id=...
// POST  { action:'proposer', mois?: 'AAAA-MM' }
//        -> { mois: [ { mois, sequence: [ { id, titre, carte_dos, tete, serie, jour_bdm, change_reglage, change_tete } ],
//                       jours_bdm, reglages, nettoyages, sans_carte: [...] } ], a_coudre, a_emboiter }
//        Classement : 1) carte de dos DÉCROISSANTE (séries de largeurs voisines, écart <= ecart_carte_mm, de la plus large à la plus étroite),
//                     2) couleur de tête à l'intérieur d'une série (limite les nettoyages du jaspage),
//                     3) à couleur égale, carte de dos décroissante.
// POST  { action:'generer', ids:[...], rang_depart?:1 }   crée l'OF Pléiade de chaque ligne (dans l'ordre donné)

const { getSupabase } = require('./lib/supabaseclient');
const generer = require('./generer-of-pleiade');

const rep = (code, o) => ({ statusCode: code, body: JSON.stringify(o) });
const LEGENDE = { S: 'solde (fin de série)', N: 'nouveauté', T: 'train (production en cours)', R: 'réimpression' };
const CHAMPS = ['ordre', 'livraison_txt', 'mois', 'date_livraison', 'titre', 'quantite', 'quantite_alt', 'mp', 'carte_dos', 'flags', 'reception', 'tete', 'peau', 'categorie', 'statut', 'a_verifier', 'notes', 'rang'];
const ORDRE_TETES = ['gris clair', 'sable', 'vert', 'orange', 'gris foncé', 'bleu'];
const PEAU_CATEGORIE = { 'havane': 'XXE', 'v. émeraude': 'XIXE', 'v. emeraude': 'XIXE', 'bleu': 'XVIIIE', 'r. vénitien': 'XVIIE', 'corinthe': 'XVIE', 'v. antique': 'ANTIQUITE', 'violet': 'MOYEN_AGE', 'gris': 'RELIGIEUX' };
const norm = (s) => String(s || '').trim().toLowerCase();

const nettoyer = (b) => {
  const o = {};
  CHAMPS.forEach((k) => { if (b[k] !== undefined) o[k] = (typeof b[k] === 'string' && b[k].trim() === '') ? null : b[k]; });
  return o;
};

function dernierJourOuvre(mois) {
  const [a, m] = mois.split('-').map(Number);
  const d = new Date(Date.UTC(a, m, 0));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// 'ici' / 'ici nov' -> null (déjà là) ; 'ici le 09/9' / 'AV 20/01' -> date (année déduite de la livraison).
function dateReception(texte, livraison) {
  const m = String(texte || '').match(/(\d{1,2})\s*\/\s*(\d{1,2})/);
  if (!m || !livraison) return null;
  const jour = Number(m[1]), mois = Number(m[2]);
  let an = Number(livraison.slice(0, 4));
  let d = `${an}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
  if (d > livraison) d = `${an - 1}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
  return d;
}

// Séries de cartes de dos voisines (de la plus large à la plus étroite), puis couleurs de tête regroupées dans la série.
function sequencer(lignes, ecart, parJour) {
  const avec = lignes.filter((l) => l.carte_dos).sort((a, b) => b.carte_dos - a.carte_dos || (a.ordre || 0) - (b.ordre || 0));
  const series = [];
  avec.forEach((l) => {
    const cur = series[series.length - 1];
    if (cur && cur[cur.length - 1].carte_dos - l.carte_dos <= ecart) cur.push(l); else series.push([l]);
  });
  const rang = (t) => { const i = ORDRE_TETES.indexOf(norm(t)); return i < 0 ? 99 : i; };
  let derniereTete = null;
  const ordre = [];
  series.forEach((serie, si) => {
    const tetes = Array.from(new Set(serie.map((l) => norm(l.tete)))).sort((a, b) => rang(a) - rang(b) || a.localeCompare(b));
    // La série commence par la couleur de tête de la précédente si elle en contient une.
    if (derniereTete && tetes.includes(derniereTete)) tetes.splice(tetes.indexOf(derniereTete), 1), tetes.unshift(derniereTete);
    tetes.forEach((t) => serie.filter((l) => norm(l.tete) === t).sort((a, b) => b.carte_dos - a.carte_dos || (a.ordre || 0) - (b.ordre || 0)).forEach((l) => ordre.push({ l, serie: si + 1 })));
    derniereTete = tetes[tetes.length - 1];
  });
  let reglages = 0, nettoyages = 0;
  const sequence = ordre.map((x, i) => {
    const p = ordre[i - 1];
    const cr = !!p && p.serie !== x.serie;
    const ct = !!p && norm(p.l.tete) !== norm(x.l.tete);
    if (cr) reglages++;
    if (ct) nettoyages++;
    return { id: x.l.id, titre: x.l.titre, quantite: x.l.quantite, mp: x.l.mp, carte_dos: x.l.carte_dos, tete: x.l.tete, peau: x.l.peau, serie: x.serie, jour_bdm: Math.floor(i / parJour) + 1, change_reglage: cr, change_tete: ct, flags: x.l.flags, a_verifier: x.l.a_verifier };
  });
  const detail = series.map((serie, si) => ({ serie: si + 1, nb: serie.length, carte_max: serie[0].carte_dos, carte_min: serie[serie.length - 1].carte_dos, quantite: serie.reduce((t, l) => t + (Number(l.quantite) || 0), 0) }));
  return { sequence, jours_bdm: Math.ceil(sequence.length / parJour), reglages, nettoyages, series: series.length, series_detail: detail };
}

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();
    const lireParams = async () => {
      const { data } = await supabase.from('pleiade_parametres').select('cle, valeur');
      const p = {}; (data || []).forEach((x) => { p[x.cle] = x.valeur; });
      return { ecart: Number(p.ecart_carte_mm) || 2, parJour: Number(p.titres_par_jour_bdm) || 4 };
    };
    const m = event.httpMethod;
    // OF supprimé depuis la liste des OF : la ligne du planning annuel (of_id remis à vide) redevient « à produire ».
    if (m === 'GET' || m === 'POST') {
      const { error: eSync } = await supabase.from('pleiade_annuel').update({ statut: 'a_produire' }).eq('statut', 'of_cree').is('of_id', null);
      if (eSync) console.warn('planning-annuel : resynchronisation impossible', eSync.message);
    }
    if (m === 'GET') {
      const { data, error } = await supabase.from('pleiade_annuel').select('*').order('ordre');
      if (error) throw error;
      return rep(200, { lignes: data, parametres: await lireParams(), legende: LEGENDE });
    }
    if (m === 'PUT') {
      const b = JSON.parse(event.body || '{}');
      if (!b.id) return rep(400, { error: 'id requis.' });
      const maj = nettoyer(b); if (!Object.keys(maj).length) return rep(400, { error: 'Rien à modifier.' });
      // Changement de date de livraison : le mois suit, la ligne est signalée « modifiée récemment »,
      // et l'OF déjà créé voit son délai suivre.
      if ('date_livraison' in maj) {
        if (maj.date_livraison && !/^\d{4}-\d{2}-\d{2}$/.test(maj.date_livraison)) return rep(400, { error: 'Date de livraison invalide.' });
        if (maj.date_livraison) { maj.mois = maj.date_livraison.slice(0, 7); maj.a_verifier = true; }
      } else if ('mois' in maj && maj.mois) {
        // Déplacement vers un autre mois sans date précise : on oublie l'ancienne date.
        maj.date_livraison = null; maj.a_verifier = true;
      }
      const { data: ligne, error: eL } = await supabase.from('pleiade_annuel').select('of_id').eq('id', b.id).maybeSingle();
      if (eL) throw eL;
      const { error } = await supabase.from('pleiade_annuel').update(maj).eq('id', b.id);
      if (error) throw error;
      if (ligne && ligne.of_id && maj.date_livraison) {
        const { data: avantDelai } = await supabase.from('ordres_fabrication').select('delai').eq('id', ligne.of_id).maybeSingle();
        const { error: eOf } = await supabase.from('ordres_fabrication').update({ delai: maj.date_livraison }).eq('id', ligne.of_id);
        if (eOf) console.warn('planning-annuel : délai de l\'OF non mis à jour', eOf.message);
        else if (!avantDelai || avantDelai.delai !== maj.date_livraison) await require('./lib/journal').noter(supabase, ligne.of_id, 'delai', `Délai de livraison ${avantDelai && avantDelai.delai ? 'modifié : ' + avantDelai.delai + ' → ' : 'fixé au '}${maj.date_livraison} (planning annuel Pléiade).`, { ancien: avantDelai ? avantDelai.delai : null, nouveau: maj.date_livraison, origine: 'planning annuel' });
      }
      return rep(200, { ok: true });
    }
    if (m === 'DELETE') {
      const id = (event.queryStringParameters || {}).id;
      if (!id) return rep(400, { error: 'id requis.' });
      const { error } = await supabase.from('pleiade_annuel').delete().eq('id', id);
      if (error) throw error;
      return rep(200, { ok: true });
    }
    if (m !== 'POST') return rep(405, { error: 'Méthode non autorisée.' });
    const b = JSON.parse(event.body || '{}');

    if (b.action === 'ajouter') {
      if (!b.titre) return rep(400, { error: 'titre requis.' });
      const ajout = nettoyer(b);
      if (ajout.date_livraison) ajout.mois = ajout.date_livraison.slice(0, 7);
      if (!ajout.mois) return rep(400, { error: 'Date ou mois de livraison requis.' });
      const { data, error } = await supabase.from('pleiade_annuel').insert({ ordre: 9999, statut: 'a_produire', a_verifier: true, ...ajout }).select('id').single();
      if (error) throw error;
      return rep(200, { id: data.id });
    }

    if (b.action === 'proposer') {
      const { ecart, parJour } = await lireParams();
      const { data, error } = await supabase.from('pleiade_annuel').select('*').order('ordre');
      if (error) throw error;
      const aProduire = data.filter((l) => l.statut === 'a_produire' && l.mois && (!b.mois || l.mois === b.mois) && !/coffret/i.test(l.notes || '') && !/^coffrets?\b/i.test(l.titre));
      const mois = Array.from(new Set(aProduire.map((l) => l.mois))).sort().map((mo) => {
        const lignes = aProduire.filter((l) => l.mois === mo);
        const r = sequencer(lignes, ecart, parJour);
        return { mois: mo, ...r, sans_carte: lignes.filter((l) => !l.carte_dos).map((l) => ({ id: l.id, titre: l.titre })), total_titres: lignes.length };
      });
      return rep(200, { mois, a_coudre: data.filter((l) => l.statut === 'a_coudre'), a_emboiter: data.filter((l) => l.statut === 'a_emboiter'), parametres: { ecart, parJour } });
    }

    if (b.action === 'generer') {
      const ids = Array.isArray(b.ids) ? b.ids : [];
      if (!ids.length) return rep(400, { error: 'ids requis.' });
      // « Mémoriser dans le modèle » : les liens modifiés deviennent ceux du modèle Pléiade pour les prochains OF.
      if (b.memoriser && b.liens && typeof b.liens === 'object') {
        for (const [code, lien] of Object.entries(b.liens)) {
          if (!lien || !Array.isArray(lien.predecesseurs)) continue;
          const { error: eM } = await supabase.from('pleiade_gamme_modele')
            .update({ predecesseurs: lien.predecesseurs.filter((q) => typeof q === 'string'), simultane: (Array.isArray(lien.simultane) ? lien.simultane : []).filter((q) => typeof q === 'string') }).eq('code', code);
          if (eM) throw eM;
        }
      }
      const resultats = [];
      for (let i = 0; i < ids.length; i++) {
        const { data: l, error } = await supabase.from('pleiade_annuel').select('*').eq('id', ids[i]).single();
        if (error) throw error;
        if (l.of_id) { resultats.push({ id: l.id, titre: l.titre, erreur: 'OF déjà créé.' }); continue; }
        const categorie = l.categorie || PEAU_CATEGORIE[norm(l.peau)];
        if (!categorie) { resultats.push({ id: l.id, titre: l.titre, erreur: `Catégorie à choisir (peau « ${l.peau || '?'} » inconnue du tableau).` }); continue; }
        if (!l.quantite) { resultats.push({ id: l.id, titre: l.titre, erreur: 'Quantité manquante.' }); continue; }
        const livraison = l.date_livraison || (l.mois ? dernierJourOuvre(l.mois) : null);
        const res = await generer.handler({ httpMethod: 'POST', body: JSON.stringify({
          action: 'creer', categorie, etapes: Array.isArray(b.etapes) ? b.etapes : undefined, operations_extra: Array.isArray(b.operations_extra) ? b.operations_extra : undefined, liens: b.liens && typeof b.liens === 'object' ? b.liens : undefined, titre: l.titre, quantite: l.quantite, delai: livraison,
          date_reception: dateReception(l.reception, livraison), couleur_tete: l.tete, couleur_peau: l.peau,
          carte_dos: l.carte_dos, nb_cahiers: l.mp, rang_priorite: (b.rang_depart || 1) + i, priorite: l.a_verifier ? 'haute' : 'normale',
        }) });
        const d = JSON.parse(res.body);
        if (res.statusCode !== 200) { resultats.push({ id: l.id, titre: l.titre, erreur: d.error || `HTTP ${res.statusCode}` }); continue; }
        await supabase.from('pleiade_annuel').update({ of_id: d.of_id, statut: 'of_cree', categorie }).eq('id', l.id);
        resultats.push({ id: l.id, titre: l.titre, numero: d.numero, avertissements: d.avertissements });
      }
      return rep(200, { resultats });
    }
    if (b.action === 'etapes') {
      const { data: l, error } = await supabase.from('pleiade_annuel').select('*').eq('id', b.id).single();
      if (error) throw error;
      const categorie = l.categorie || PEAU_CATEGORIE[norm(l.peau)];
      if (!categorie) return rep(400, { error: `Catégorie à choisir (peau « ${l.peau || '?'} » inconnue du tableau).` });
      const res = await generer.handler({ httpMethod: 'POST', body: JSON.stringify({ action: 'apercu', categorie, titre: l.titre, quantite: l.quantite, couleur_tete: l.tete, couleur_peau: l.peau }) });
      const d = JSON.parse(res.body);
      if (res.statusCode !== 200) return rep(res.statusCode, { error: d.error || 'Aperçu impossible.' });
      return rep(200, { etapes: d.etapes_possibles, catalogue: d.operations_catalogue || [] });
    }
    return rep(400, { error: 'action inconnue.' });
  } catch (err) {
    return rep(500, { error: err.message });
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
exports.sequencer = sequencer;   // exposé pour les tests
