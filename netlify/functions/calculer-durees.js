// functions/calculer-durees.js
//
// GET  /.netlify/functions/calculer-durees?of_id=uuid
//   -> calcule la durée de chaque étape de gamme de l'OF et le total.
// POST /.netlify/functions/calculer-durees
//   body : { of_id, caracteristiques?: { largeur_mm: 210, ... }, etapes: [ { gamme_id, machine_id?, parametres?, duree_manuelle_h?, predecesseurs? } ] }
//   predecesseurs : numéros des étapes à terminer avant celle-ci (null = l'étape
//   précédente ; [] = aucune dépendance). Seules des étapes de numéro inférieur sont acceptées.
//   dependances : { "<n° d'étape>": { mode: "progressif", seuil_pct } } — l'étape démarre dès que
//   seuil_pct % de l'étape n° est avancé (sans pouvoir finir avant elle). Sans entrée : attendre la fin.
//   -> enregistre d'abord les réglages des étapes (machine prévue,
//      paramètres, durée manuelle), puis recalcule et mémorise la
//      durée estimée de chaque étape (gammes_operatoires.duree_estimee_min).
//
//   caracteristiques : valeurs du PRODUIT, saisies une fois pour tout l'OF et reprises par
//   toutes ses étapes (une valeur vide efface la caractéristique). Une étape peut
//   toujours avoir sa propre valeur (parametres) qui prime sur celle de l'OF.
//
// La logique de calcul elle-même est dans lib/durees.js (partagée avec
// la planification à l'heure).

const { getSupabase } = require('./lib/supabaseclient');
const { calculerEtapes, arrondi, nombreOuNull } = require('./lib/durees');

exports.handler = async (event) => {
  try {
    const supabase = getSupabase();
    let ofId;
    const avertissements = [];
    const sauvegarde = event.httpMethod === 'POST';

    if (event.httpMethod === 'GET') {
      ofId = (event.queryStringParameters || {}).of_id;
    } else if (sauvegarde) {
      const body = JSON.parse(event.body || '{}');
      ofId = body.of_id;
      if (!ofId) return { statusCode: 400, body: JSON.stringify({ error: 'of_id requis.' }) };

      // Caractéristiques du produit (niveau OF) : fusionnées avec l'existant.
      if (body.caracteristiques && typeof body.caracteristiques === 'object') {
        const [{ data: ofRow, error: ofErr }, { data: cat, error: catErr }] = await Promise.all([
          supabase.from('ordres_fabrication').select('caracteristiques').eq('id', ofId).maybeSingle(),
          supabase.from('caracteristiques_produit').select('cle, type'),
        ]);
        if (ofErr) throw ofErr;
        if (catErr) throw catErr;
        const types = Object.fromEntries((cat || []).map((c) => [c.cle, c.type]));
        const actuel = { ...((ofRow && ofRow.caracteristiques) || {}) };
        Object.entries(body.caracteristiques).forEach(([cle, val]) => {
          if (!/^[a-z][a-z0-9_]*$/.test(cle)) return;
          if (val === null || val === undefined || String(val).trim() === '') { delete actuel[cle]; return; }
          const n = nombreOuNull(val);
          if (types[cle] === 'texte') actuel[cle] = String(val).trim();
          else if (n !== null) actuel[cle] = n;
          else if (types[cle] === 'nombre') avertissements.push(`« ${cle} » : valeur non numérique ignorée (« ${val} »).`);
          else actuel[cle] = String(val).trim();
        });
        const { error: majErr } = await supabase.from('ordres_fabrication').update({ caracteristiques: actuel }).eq('id', ofId);
        if (majErr) throw majErr;
      }

      const { data: existantes, error: exError } = await supabase
        .from('gammes_operatoires').select('id, statut, sequence').eq('of_id', ofId);
      const sequences = new Set(existantes.map((g) => g.sequence));
      if (exError) throw exError;

      for (const e of body.etapes || []) {
        const etape = existantes.find((g) => g.id === e.gamme_id);
        if (!etape) continue;
        const maj = {};
        if ('parametres' in e) {
          const p = {};
          Object.entries(e.parametres || {}).forEach(([cle, val]) => {
            const n = nombreOuNull(val);
            if (n !== null && n >= 0) p[cle] = n;
          });
          maj.parametres = p;
        }
        if ('duree_manuelle_h' in e) {
          const n = nombreOuNull(e.duree_manuelle_h);
          maj.duree_manuelle_h = n !== null && n >= 0 ? n : null;
        }
        if ('machine_id' in e) {
          if (etape.statut === 'à planifier') {
            maj.machine_id = e.machine_id || null;
          } else {
            avertissements.push(`Étape ${etape.sequence} : machine inchangée (déjà planifiée — modifiez-la via le planning).`);
          }
        }
        if ('predecesseurs' in e) {
          if (e.predecesseurs === null) {
            maj.predecesseurs = null;
          } else if (Array.isArray(e.predecesseurs)) {
            const valides = Array.from(new Set(e.predecesseurs.map(Number)))
              .filter((s) => Number.isInteger(s) && s < etape.sequence && sequences.has(s))
              .sort((a, b) => a - b);
            if (valides.length !== new Set(e.predecesseurs.map(Number)).size) {
              avertissements.push(`Étape ${etape.sequence} : seules des étapes antérieures existantes peuvent être prédécesseurs (valeurs invalides ignorées).`);
            }
            maj.predecesseurs = valides;
          }
        }
        if ('dependances' in e) {
          const options = {};
          Object.entries(e.dependances || {}).forEach(([seq, v]) => {
            const n = Number(seq);
            if (!Number.isInteger(n) || n >= etape.sequence || !sequences.has(n)) return;
            if (!v || v.mode !== 'progressif') return;                       // seul le mode progressif se mémorise
            if (Array.isArray(maj.predecesseurs) && !maj.predecesseurs.includes(n)) return;   // lien retiré
            const pct = Number(String(v.seuil_pct).replace(',', '.'));
            options[n] = { mode: 'progressif', seuil_pct: Number.isFinite(pct) ? Math.max(0, Math.min(100, Math.round(pct))) : 10 };
          });
          maj.dependances = options;
        }
        if (Object.keys(maj).length > 0) {
          const { error } = await supabase.from('gammes_operatoires').update(maj).eq('id', etape.id);
          if (error) throw error;
        }
      }
    } else {
      return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
    }

    if (!ofId) return { statusCode: 400, body: JSON.stringify({ error: 'Paramètre of_id requis.' }) };

    const calcul = await calculerEtapes(supabase, ofId);
    if (!calcul) return { statusCode: 404, body: JSON.stringify({ error: 'OF introuvable.' }) };
    const { of, etapes, calendrier, catalogue } = calcul;

    // Caractéristiques à renseigner pour cet OF : celles dont ses étapes ont besoin, dédoublonnées.
    const produitRequis = [];
    etapes.forEach((e) => e.parametres_requis.forEach((r) => {
      if (!produitRequis.some((x) => x.cle === r.cle)) {
        const v = of.caracteristiques[r.cle];
        produitRequis.push({ ...r, valeur: v === undefined ? null : v });
      }
    }));

    if (sauvegarde) {
      for (const e of etapes) {
        const { error } = await supabase.from('gammes_operatoires')
          .update({ duree_estimee_min: e.chiffre ? Math.round(e.total_h * 60) : null }).eq('id', e.gamme_id);
        if (error) throw error;
      }
    }

    const totalH = arrondi(etapes.reduce((s, e) => s + e.total_h, 0));
    return {
      statusCode: 200,
      body: JSON.stringify({
        of: { id: of.id, numero: of.numero, quantite: of.quantite, caracteristiques: of.caracteristiques },
        catalogue,
        produit_requis: produitRequis,
        etapes,
        totaux: {
          total_h: totalH,
          heures_machine: arrondi(etapes.reduce((s, e) => s + e.heures_machine, 0)),
          heures_personnes: arrondi(etapes.reduce((s, e) => s + e.heures_personnes, 0)),
          etapes_non_chiffrees: etapes.filter((e) => !e.chiffre).length,
          jours_equivalents: calendrier.map((c) => ({ code: c.code, libelle: c.libelle, jours: arrondi(totalH / c.heures_utiles_par_jour) })),
        },
        calendrier,
        avertissements,
      }),
    };
  } catch (err) {
    console.error('calculer-durees error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
