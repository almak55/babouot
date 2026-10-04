// functions/calculer-durees.js
//
// GET  /.netlify/functions/calculer-durees?of_id=uuid
//   -> calcule la durée de chaque étape de gamme de l'OF et le total.
// POST /.netlify/functions/calculer-durees
//   body : { of_id, etapes: [ { gamme_id, machine_id?, parametres?, duree_manuelle_h? } ] }
//   -> enregistre d'abord les réglages des étapes (machine prévue,
//      paramètres, durée manuelle), puis recalcule et mémorise la
//      durée estimée de chaque étape (gammes_operatoires.duree_estimee_min,
//      utilisée plus tard par la planification à l'heure).
//
// Règle de choix des phases pour une étape :
//   1. si une machine est prévue ET a des phases propres pour cette
//      opération -> ces phases ;
//   2. sinon les phases standard de l'opération (machine_id vide) ;
//   3. sinon l'étape n'est pas chiffrée (sauf durée manuelle).
//
// Durée d'une phase :
//   fixe        = duree_h
//   par_element = duree_h x paramètre de l'étape (ex: nb_fers)
//   cadence     = quantité / cadence_par_h  (quantité = paramètre
//                 "quantite" de l'étape, sinon quantité de l'OF)
// Une durée manuelle sur l'étape remplace le total calculé.

const { getSupabase } = require('./lib/supabaseclient');

const arrondi = (x) => Math.round(x * 100) / 100;
const heures = (t) => { const [h, m] = String(t).split(':'); return Number(h) + Number(m) / 60; };

function nombreOuNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

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

    const { data: of, error: ofError } = await supabase
      .from('ordres_fabrication').select('id, numero, quantite').eq('id', ofId).maybeSingle();
    if (ofError) throw ofError;
    if (!of) return { statusCode: 404, body: JSON.stringify({ error: 'OF introuvable.' }) };

    const { data: gammes, error: gammesError } = await supabase
      .from('gammes_operatoires')
      .select('id, sequence, statut, operation_id, machine_id, parametres, duree_manuelle_h, operations(code, nom)')
      .eq('of_id', ofId).order('sequence');
    if (gammesError) throw gammesError;

    const opIds = Array.from(new Set(gammes.map((g) => g.operation_id)));
    const [phasesRes, machinesRes, machinesOpsRes, calRes] = await Promise.all([
      opIds.length
        ? supabase.from('phases_standard').select('*').in('operation_id', opIds)
        : Promise.resolve({ data: [] }),
      supabase.from('machines').select('id, nom, operation_id').eq('actif', true),
      supabase.from('machines_operations').select('machine_id, operation_id'),
      supabase.from('calendrier_travail').select('*'),
    ]);
    for (const r of [phasesRes, machinesRes, machinesOpsRes, calRes]) if (r.error) throw r.error;

    const etapes = gammes.map((g) => {
      const parametres = g.parametres || {};
      const phasesOp = phasesRes.data.filter((p) => p.operation_id === g.operation_id);
      const propres = g.machine_id ? phasesOp.filter((p) => p.machine_id === g.machine_id) : [];
      const generiques = phasesOp.filter((p) => !p.machine_id);
      const utilisees = (propres.length ? propres : generiques).slice().sort((a, b) => a.ordre - b.ordre);
      const source = propres.length ? 'machine' : generiques.length ? 'operation' : 'aucune';

      const quantiteEtape = nombreOuNull(parametres.quantite);
      const quantite = quantiteEtape !== null && quantiteEtape > 0 ? quantiteEtape : of.quantite;

      const manquants = [];
      const requis = [];
      const phases = utilisees.map((p) => {
        let d = 0; let detail = '';
        if (p.type_calcul === 'fixe') {
          d = Number(p.duree_h);
          detail = 'forfait';
        } else if (p.type_calcul === 'par_element') {
          const valeur = nombreOuNull(parametres[p.element_param]);
          if (!requis.some((r) => r.cle === p.element_param)) requis.push({ cle: p.element_param, libelle: p.element_label || p.element_param });
          if (valeur === null) {
            if (!manquants.includes(p.element_param)) manquants.push(p.element_param);
            detail = `${p.element_label || p.element_param} : non renseigné`;
          } else {
            d = Number(p.duree_h) * valeur;
            detail = `${p.duree_h} h × ${valeur} ${p.element_label || p.element_param}`;
          }
        } else {
          d = quantite / Number(p.cadence_par_h);
          detail = `${quantite} ÷ ${p.cadence_par_h}/h`;
        }
        return { nom: p.nom, duree_h: arrondi(d), detail, occupe_machine: p.occupe_machine, nb_personnes: p.nb_personnes };
      });

      const totalPhases = phases.reduce((s, p) => s + p.duree_h, 0);
      let heuresMachine = phases.filter((p) => p.occupe_machine).reduce((s, p) => s + p.duree_h, 0);
      let heuresPersonnes = phases.reduce((s, p) => s + p.duree_h * p.nb_personnes, 0);

      const manuelle = g.duree_manuelle_h === null || g.duree_manuelle_h === undefined ? null : Number(g.duree_manuelle_h);
      let total = totalPhases;
      if (manuelle !== null) {
        total = manuelle;
        if (totalPhases > 0) {
          const ratio = manuelle / totalPhases;
          heuresMachine *= ratio; heuresPersonnes *= ratio;
        } else {
          heuresMachine = manuelle; heuresPersonnes = manuelle;
        }
      }

      const compatibles = machinesRes.data
        .filter((m) => m.operation_id === g.operation_id ||
          machinesOpsRes.data.some((mo) => mo.machine_id === m.id && mo.operation_id === g.operation_id))
        .map((m) => ({ id: m.id, nom: m.nom, temps_specifiques: phasesOp.some((p) => p.machine_id === m.id) }))
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

      return {
        gamme_id: g.id, sequence: g.sequence, statut: g.statut,
        operation: g.operations.nom, operation_code: g.operations.code,
        machine_id: g.machine_id, machines_compatibles: compatibles,
        source, phases,
        parametres, parametres_requis: requis, parametres_manquants: manquants,
        duree_manuelle_h: manuelle,
        chiffre: source !== 'aucune' || manuelle !== null,
        total_h: arrondi(total),
        heures_machine: arrondi(heuresMachine),
        heures_personnes: arrondi(heuresPersonnes),
      };
    });

    if (sauvegarde) {
      for (const e of etapes) {
        const { error } = await supabase.from('gammes_operatoires')
          .update({ duree_estimee_min: e.chiffre ? Math.round(e.total_h * 60) : null }).eq('id', e.gamme_id);
        if (error) throw error;
      }
    }

    const calendrier = calRes.data.map((c) => {
      const utiles = heures(c.heure_fin) - heures(c.heure_debut) - c.pause_minutes / 60;
      return {
        code: c.code, libelle: c.libelle,
        heure_debut: String(c.heure_debut).slice(0, 5), heure_fin: String(c.heure_fin).slice(0, 5),
        heures_utiles_par_jour: arrondi(utiles),
      };
    });

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
