// functions/recaler-durees.js
//
// Répare les créneaux « Journée » (sans heures) créés avant la prise en compte du chiffrage :
// ils sont recalés sur la durée réelle de l'étape (ex. 2 h au lieu de 8 h).
//
// GET  -> simulation : liste ce qui serait modifié, sans rien changer.
// POST -> applique ({ "of_id": "uuid" } facultatif pour se limiter à un OF).
// Seuls les créneaux planifiés, sans heures, à partir d'aujourd'hui, dont l'étape est chiffrée, sont touchés.
const { getSupabase } = require('./lib/supabaseclient');
const { aujourdhuiParis } = require('./lib/debut-etape');
const PL = require('./lib/planification');
const { calculerEtapes } = require('./lib/durees');

const hh = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

function decouper(jourDebut, phases, cal) {
  const dMin = PL.hhmm(cal.heure_debut), fMin = PL.hhmm(cal.heure_fin);
  const pD = PL.hhmm(cal.pause_debut), pF = pD + Number(cal.pause_minutes);
  const fenetres = [[dMin, pD], [pF, fMin]];
  let jour = PL.debutDeJour(PL.enMinutes(jourDebut, '00:00'));
  while (!PL.estOuvre(jour)) jour += PL.MIN_JOUR;
  let f = 0, curseur = fenetres[0][0];
  const morceaux = [];
  for (const ph of phases) {
    let reste = Math.round(ph.duree_h * 60), garde = 0;
    while (reste > 0 && garde++ < 2000) {
      if (f >= fenetres.length) { f = 0; jour += PL.MIN_JOUR; while (!PL.estOuvre(jour)) jour += PL.MIN_JOUR; curseur = fenetres[0][0]; }
      const [wd, wf] = fenetres[f];
      if (curseur < wd) curseur = wd;
      if (curseur >= wf) { f++; if (f < fenetres.length) curseur = fenetres[f][0]; continue; }
      const pris = Math.min(reste, wf - curseur);
      morceaux.push({ date: PL.dateDe(jour), heure_debut: hh(curseur), heure_fin: hh(curseur + pris), phase: ph.nom });
      curseur += pris; reste -= pris;
    }
  }
  return morceaux;
}

const handlerProtege = async (event) => {
  try {
    const appliquer = event.httpMethod === 'POST';
    if (!appliquer && event.httpMethod !== 'GET') return { statusCode: 405, body: JSON.stringify({ error: 'GET (simulation) ou POST (application).' }) };
    const body = appliquer ? JSON.parse(event.body || '{}') : {};
    const supabase = getSupabase();

    let q = supabase.from('planning_jour')
      .select('id, date, machine_id, personnel_id, of_id, operation_id, gamme_operatoire_id, statut')
      .is('heure_debut', null).eq('statut', 'planifié').not('gamme_operatoire_id', 'is', null)
      .gte('date', aujourdhuiParis());
    if (body.of_id) q = q.eq('of_id', body.of_id);
    const { data: lignes, error } = await q;
    if (error) throw error;

    // Une étape peut avoir plusieurs lignes « Journée » : on garde la 1re date comme départ, les autres sont remplacées.
    const parEtape = new Map();
    for (const l of lignes) {
      if (!parEtape.has(l.gamme_operatoire_id)) parEtape.set(l.gamme_operatoire_id, []);
      parEtape.get(l.gamme_operatoire_id).push(l);
    }
    const cacheOf = new Map();
    const rapport = [];
    for (const [gammeId, rows] of parEtape) {
      const ofId = rows[0].of_id;
      if (!cacheOf.has(ofId)) cacheOf.set(ofId, await calculerEtapes(supabase, ofId));
      const calc = cacheOf.get(ofId);
      const e = calc && calc.etapes.find((x) => x.gamme_id === gammeId);
      if (!e) continue;
      const phases = (e.duree_manuelle_h !== null && e.duree_manuelle_h !== undefined)
        ? [{ nom: 'Étape (durée manuelle)', duree_h: Number(e.duree_manuelle_h) }]
        : (e.phases || []).map((p) => ({ nom: p.nom, duree_h: Number(p.duree_h) }));
      if (!phases.some((p) => p.duree_h > 0)) continue; // non chiffrée : on ne touche pas
      const cal = calc.calendrier.find((c) => c.code === 'normal') || { heure_debut: '08:00', heure_fin: '16:30', pause_debut: '12:00', pause_minutes: 30 };
      const debut = rows.map((r) => r.date).sort()[0];
      const morceaux = decouper(debut, phases, cal);
      rapport.push({ etape: gammeId, of_id: ofId, avant: rows.map((r) => `${r.date} (journée)`), apres: morceaux.map((m) => `${m.date} ${m.heure_debut}-${m.heure_fin}`) });
      if (!appliquer) continue;

      const ids = rows.map((r) => r.id);
      const { data: liens, error: eL } = await supabase.from('planning_jour_personnel').select('personnel_id').in('planning_jour_id', ids);
      if (eL) throw eL;
      const personnes = Array.from(new Set(liens.map((l) => l.personnel_id)));
      const base = rows[0];
      for (const m of morceaux) {
        const { data: c, error: eI } = await supabase.from('planning_jour').insert({
          date: m.date, heure_debut: m.heure_debut, heure_fin: m.heure_fin, phase: m.phase,
          machine_id: base.machine_id, personnel_id: base.personnel_id, of_id: base.of_id,
          operation_id: base.operation_id, gamme_operatoire_id: gammeId, statut: 'planifié',
        }).select('id').single();
        if (eI) throw eI;
        if (personnes.length) {
          const { error: eP } = await supabase.from('planning_jour_personnel').insert(personnes.map((pid) => ({ planning_jour_id: c.id, personnel_id: pid })));
          if (eP) throw eP;
        }
      }
      // Anciennes lignes supprimées seulement une fois les nouvelles créées.
      await supabase.from('planning_jour_personnel').delete().in('planning_jour_id', ids);
      const { error: eD } = await supabase.from('planning_jour').delete().in('id', ids);
      if (eD) throw eD;
    }
    return { statusCode: 200, body: JSON.stringify({ applique: appliquer, etapes_concernees: rapport.length, detail: rapport }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

exports.handler = require('./lib/auth').avecAuth(handlerProtege);
