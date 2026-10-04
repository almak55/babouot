// functions/calculer-durees.js
//
// GET  /.netlify/functions/calculer-durees?of_id=uuid
//   -> calcule la durée de chaque étape de gamme de l'OF et le total.
// POST /.netlify/functions/calculer-durees
//   body : { of_id, etapes: [ { gamme_id, machine_id?, parametres?, duree_manuelle_h? } ] }
//   -> enregistre d'abord les réglages des étapes (machine prévue,
//      paramètres, durée manuelle), puis recalcule et mémorise la
//      durée estimée de chaque étape (gammes_operatoires.duree_estimee_min).
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

      const { data: existantes, error: exError } = await supabase
        .from('gammes_operatoires').select('id, statut, sequence').eq('of_id', ofId);
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
    const { of, etapes, calendrier } = calcul;

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
        of: { id: of.id, numero: of.numero, quantite: of.quantite },
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
