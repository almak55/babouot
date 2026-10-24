// functions/gerer-affectation.js
//
// Retouches d'une affectation du planning (page « Occupation hebdomadaire »).
//
// GET  ?planning_jour_id=uuid&ancien_id=uuid
//      -> { creneau, candidats: [{ id, nom, poste, competent, deja_travaille, libre, motif, charge_jour_min }] }
//         (classés : compétents et libres d'abord)
// POST { action: 'reaffecter', planning_jour_id, ancien_id, nouveau_id | null, portee: 'creneau' | 'tache' }
//         remplace une personne par une autre (nouveau_id null : la personne est retirée, « personnel à affecter »)
// POST { action: 'auto', planning_jour_id, ancien_id, portee }
//         choisit automatiquement le meilleur remplaçant (compétent, libre, déjà passé sur la tâche, peu chargé)
// POST { action: 'deplacer', planning_jour_id, date, heure_debut, heure_fin }
//         change le jour et/ou l'horaire du créneau (contrôle machine, personnes, absences, horaires, pause)

const { getSupabase } = require('./lib/supabaseclient');
const PL = require('./lib/planification');

const rep = (statusCode, obj) => ({ statusCode, body: JSON.stringify(obj) });
const hm = (t) => { const [h, m] = String(t).slice(0, 5).split(':'); return Number(h) * 60 + Number(m); };
const hh = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const bornes = (l) => [l.heure_debut ? hm(l.heure_debut) : 0, l.heure_fin ? hm(l.heure_fin) : 1440];
const chevauche = (a, b) => a[0] < b[1] && b[0] < a[1];
const minutesTravail = (l) => {
  if (!l.heure_debut || !l.heure_fin) return 480;
  const [s, e] = bornes(l);
  return Math.max(0, e - s - Math.max(0, Math.min(e, 750) - Math.max(s, 720)));
};

async function lireCreneau(supabase, id) {
  const { data, error } = await supabase.from('planning_jour')
    .select('id, date, heure_debut, heure_fin, phase, statut, machine_id, personnel_id, of_id, operation_id, gamme_operatoire_id').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

const equipeDe = (l, liens) => Array.from(new Set([l.personnel_id, ...liens.filter((x) => x.planning_jour_id === l.id).map((x) => x.personnel_id)].filter(Boolean)));

// Qui est libre sur ce créneau ? Occupations des autres créneaux du jour + absences.
async function etatJour(supabase, l) {
  const [lignesRes, absRes] = await Promise.all([
    supabase.from('planning_jour').select('id, date, heure_debut, heure_fin, machine_id, personnel_id, statut').eq('date', l.date).neq('statut', 'annulé'),
    supabase.from('personnel_planning_jour').select('personnel_id, date, statut, heure_debut, heure_fin').eq('date', l.date),
  ]);
  for (const r of [lignesRes, absRes]) if (r.error) throw r.error;
  const ids = lignesRes.data.map((x) => x.id);
  const liensRes = ids.length ? await supabase.from('planning_jour_personnel').select('planning_jour_id, personnel_id').in('planning_jour_id', ids) : { data: [] };
  if (liensRes.error) throw liensRes.error;
  return { lignes: lignesRes.data, abs: absRes.data, liens: liensRes.data };
}

// Raison pour laquelle la personne ne peut pas prendre [s, e] ce jour-là (null = libre), en ignorant `ignorerId`.
function motifIndispo(pid, s, e, jour, ignorerId) {
  const a = jour.abs.find((x) => x.personnel_id === pid);
  if (a) {
    if (a.statut === 'absent') return 'absent(e)';
    if (a.statut === 'en arrêt') return 'en arrêt';
    if (a.heure_debut && a.heure_fin && (s < hm(a.heure_debut) || e > hm(a.heure_fin))) return `disponible seulement ${String(a.heure_debut).slice(0, 5)}-${String(a.heure_fin).slice(0, 5)}`;
  }
  for (const x of jour.lignes) {
    if (x.id === ignorerId || !equipeDe(x, jour.liens).includes(pid)) continue;
    if (chevauche([s, e], bornes(x))) return 'déjà affecté(e) sur ce créneau horaire';
  }
  return null;
}

async function candidats(supabase, l, ancienId) {
  const [persRes, compRes, pmRes, histRes] = await Promise.all([
    supabase.from('personnel').select('id, nom, poste').eq('actif', true).order('nom'),
    supabase.from('personnel_competences').select('personnel_id, operation_id'),
    supabase.from('personnel_machines').select('personnel_id, machine_id'),
    l.gamme_operatoire_id ? supabase.from('planning_jour').select('id, personnel_id').eq('gamme_operatoire_id', l.gamme_operatoire_id) : { data: [] },
  ]);
  for (const r of [persRes, compRes, pmRes, histRes]) if (r.error) throw r.error;
  const jour = await etatJour(supabase, l);
  const [s, e] = bornes(l);
  const dejaLa = new Set(histRes.data.map((x) => x.personnel_id).filter(Boolean));
  if (histRes.data.length) {
    const lr = await supabase.from('planning_jour_personnel').select('personnel_id').in('planning_jour_id', histRes.data.map((x) => x.id));
    if (!lr.error) lr.data.forEach((x) => dejaLa.add(x.personnel_id));
  }
  const charge = (pid) => jour.lignes.filter((x) => equipeDe(x, jour.liens).includes(pid)).reduce((t, x) => t + minutesTravail(x), 0);
  const liste = persRes.data.filter((p) => p.id !== ancienId).map((p) => {
    const competent = compRes.data.some((c) => c.personnel_id === p.id && c.operation_id === l.operation_id)
      || (!!l.machine_id && pmRes.data.some((m) => m.personnel_id === p.id && m.machine_id === l.machine_id));
    const motif = motifIndispo(p.id, s, e, jour, l.id);
    return { id: p.id, nom: p.nom, poste: p.poste || '', competent, deja_travaille: dejaLa.has(p.id), libre: !motif, motif, charge_jour_min: charge(p.id) };
  });
  liste.sort((a, b) => (Number(b.libre && b.competent) - Number(a.libre && a.competent)) || (Number(b.libre) - Number(a.libre))
    || (Number(b.deja_travaille) - Number(a.deja_travaille)) || (a.charge_jour_min - b.charge_jour_min) || a.nom.localeCompare(b.nom, 'fr'));
  return liste;
}

async function remplacer(supabase, l, ancienId, nouveauId, portee) {
  let cibles = [l];
  if (portee === 'tache' && l.gamme_operatoire_id) {
    const { data, error } = await supabase.from('planning_jour')
      .select('id, date, heure_debut, heure_fin, phase, statut, machine_id, personnel_id, of_id, operation_id, gamme_operatoire_id')
      .eq('gamme_operatoire_id', l.gamme_operatoire_id).gte('date', l.date).neq('statut', 'annulé').neq('statut', 'terminé');
    if (error) throw error;
    const ids = data.map((x) => x.id);
    const liens = ids.length ? (await supabase.from('planning_jour_personnel').select('planning_jour_id, personnel_id').in('planning_jour_id', ids)).data || [] : [];
    cibles = data.filter((x) => x.id === l.id || equipeDe(x, liens).includes(ancienId));
  }
  const faits = []; const ignores = [];
  for (const x of cibles) {
    if (nouveauId) {
      const jour = await etatJour(supabase, x);
      const [s, e] = bornes(x);
      const motif = motifIndispo(nouveauId, s, e, jour, x.id);
      if (motif) { ignores.push({ date: x.date, raison: motif }); continue; }
    }
    const d1 = await supabase.from('planning_jour_personnel').delete().eq('planning_jour_id', x.id).eq('personnel_id', ancienId);
    if (d1.error) throw d1.error;
    if (nouveauId) {
      const dejaLie = await supabase.from('planning_jour_personnel').select('personnel_id').eq('planning_jour_id', x.id).eq('personnel_id', nouveauId);
      if (!dejaLie.error && !(dejaLie.data || []).length) {
        const i1 = await supabase.from('planning_jour_personnel').insert({ planning_jour_id: x.id, personnel_id: nouveauId });
        if (i1.error) throw i1.error;
      }
    }
    const u1 = await supabase.from('planning_jour').update({ personnel_id: nouveauId || null }).eq('id', x.id).eq('personnel_id', ancienId);
    if (u1.error) throw u1.error;
    faits.push({ date: x.date });
  }
  return { faits, ignores };
}

async function calendrierNormal(supabase) {
  const { data } = await supabase.from('calendrier_travail').select('*').eq('code', 'normal').maybeSingle();
  return data ? { debut: hm(data.heure_debut), fin: hm(data.heure_fin), pause: hm(data.pause_debut), pauseFin: hm(data.pause_debut) + Number(data.pause_minutes) }
    : { debut: 480, fin: 990, pause: 720, pauseFin: 750 };
}

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();

    if (event.httpMethod === 'GET') {
      const q = event.queryStringParameters || {};
      if (!q.planning_jour_id) return rep(400, { error: 'planning_jour_id requis.' });
      const l = await lireCreneau(supabase, q.planning_jour_id);
      if (!l) return rep(404, { error: 'Créneau introuvable.' });
      return rep(200, { creneau: l, candidats: await candidats(supabase, l, q.ancien_id || null) });
    }
    if (event.httpMethod !== 'POST') return rep(405, { error: 'Méthode non autorisée.' });

    const b = JSON.parse(event.body || '{}');
    if (!b.planning_jour_id) return rep(400, { error: 'planning_jour_id requis.' });
    const l = await lireCreneau(supabase, b.planning_jour_id);
    if (!l) return rep(404, { error: 'Créneau introuvable.' });

    if (b.action === 'reaffecter' || b.action === 'auto') {
      if (!b.ancien_id) return rep(400, { error: 'ancien_id requis.' });
      let nouveau = b.action === 'reaffecter' ? (b.nouveau_id || null) : null;
      if (b.action === 'auto') {
        const c = (await candidats(supabase, l, b.ancien_id)).find((x) => x.libre && x.competent);
        if (!c) return rep(409, { error: 'Aucune personne compétente et libre sur ce créneau.' });
        nouveau = c.id;
      }
      const { faits, ignores } = await remplacer(supabase, l, b.ancien_id, nouveau, b.portee === 'tache' ? 'tache' : 'creneau');
      if (!faits.length) return rep(409, { error: 'Réaffectation impossible : ' + (ignores[0] ? ignores[0].raison : 'créneau inchangé') + '.', ignores });
      return rep(200, { ok: true, nouveau_id: nouveau, remplaces: faits, ignores });
    }

    if (b.action === 'deplacer') {
      const date = b.date || l.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return rep(400, { error: 'Date invalide.' });
      if (!/^\d{2}:\d{2}$/.test(String(b.heure_debut || '')) || !/^\d{2}:\d{2}$/.test(String(b.heure_fin || ''))) return rep(400, { error: 'Horaires invalides (HH:MM).' });
      const s = hm(b.heure_debut), e = hm(b.heure_fin);
      const cal = await calendrierNormal(supabase);
      const erreurs = [];
      if (e <= s) erreurs.push('L\'heure de fin doit être après l\'heure de début.');
      if (!PL.estOuvre(PL.enMinutes(date, '00:00'))) erreurs.push('Ce jour n\'est pas ouvré (week-end ou jour férié).');
      if (s < cal.debut || e > cal.fin) erreurs.push(`Hors des horaires de l'atelier (${hh(cal.debut)}-${hh(cal.fin)}).`);
      if (chevauche([s, e], [cal.pause, cal.pauseFin])) erreurs.push(`Le créneau chevauche la pause déjeuner (${hh(cal.pause)}-${hh(cal.pauseFin)}) : scindez-le avant ou après.`);
      if (!erreurs.length) {
        const cible = { ...l, date };
        const jour = await etatJour(supabase, cible);
        // machine
        if (l.machine_id) {
          const m = jour.lignes.find((x) => x.id !== l.id && x.machine_id === l.machine_id && chevauche([s, e], bornes(x)));
          if (m) erreurs.push(`La machine est déjà occupée de ${String(m.heure_debut).slice(0, 5)} à ${String(m.heure_fin).slice(0, 5)} ce jour-là.`);
        }
        // personnes
        const lienRes = await supabase.from('planning_jour_personnel').select('personnel_id').eq('planning_jour_id', l.id);
        const equipe = Array.from(new Set([l.personnel_id, ...((lienRes.data || []).map((x) => x.personnel_id))].filter(Boolean)));
        const noms = Object.fromEntries(((await supabase.from('personnel').select('id, nom').in('id', equipe.length ? equipe : ['00000000-0000-0000-0000-000000000000'])).data || []).map((p) => [p.id, p.nom]));
        equipe.forEach((pid) => { const mo = motifIndispo(pid, s, e, jour, l.id); if (mo) erreurs.push(`${noms[pid] || 'Une personne'} : ${mo}.`); });
      }
      if (erreurs.length) return rep(409, { error: erreurs.join(' '), erreurs });

      // Avertissements (non bloquants) : ordre des étapes de la gamme
      const avertissements = [];
      if (l.gamme_operatoire_id) {
        const { data: g } = await supabase.from('gammes_operatoires').select('id, of_id, sequence, predecesseurs').eq('id', l.gamme_operatoire_id).maybeSingle();
        if (g) {
          const { data: gammes } = await supabase.from('gammes_operatoires').select('id, sequence, predecesseurs, operations(nom)').eq('of_id', g.of_id);
          const tri = (gammes || []).slice().sort((x, y) => x.sequence - y.sequence);
          const i = tri.findIndex((x) => x.id === g.id);
          const preds = Array.isArray(g.predecesseurs) ? g.predecesseurs : (i > 0 ? [tri[i - 1].sequence] : []);
          const predIds = tri.filter((x) => preds.includes(x.sequence)).map((x) => x.id);
          const succIds = tri.filter((x) => { const k = tri.indexOf(x); const ps = Array.isArray(x.predecesseurs) ? x.predecesseurs : (k > 0 ? [tri[k - 1].sequence] : []); return ps.includes(g.sequence); }).map((x) => x.id);
          const tous = [...predIds, ...succIds];
          if (tous.length) {
            const { data: autres } = await supabase.from('planning_jour').select('gamme_operatoire_id, date, heure_debut, heure_fin').in('gamme_operatoire_id', tous).neq('statut', 'annulé');
            const instant = (d, t) => PL.enMinutes(d, t);
            const debut = instant(date, b.heure_debut), fin = instant(date, b.heure_fin);
            const finPred = Math.max(0, ...(autres || []).filter((x) => predIds.includes(x.gamme_operatoire_id)).map((x) => instant(x.date, x.heure_fin ? String(x.heure_fin).slice(0, 5) : '16:30')));
            const debSucc = Math.min(Infinity, ...(autres || []).filter((x) => succIds.includes(x.gamme_operatoire_id)).map((x) => instant(x.date, x.heure_debut ? String(x.heure_debut).slice(0, 5) : '08:00')));
            if (finPred && debut < finPred) avertissements.push('Cette étape démarre avant la fin d\'une étape précédente de la gamme (sauf si elles tournent en ligne).');
            if (Number.isFinite(debSucc) && fin > debSucc) avertissements.push('Cette étape se termine après le début d\'une étape suivante de la gamme.');
          }
        }
      }
      const { error } = await supabase.from('planning_jour').update({ date, heure_debut: b.heure_debut, heure_fin: b.heure_fin }).eq('id', l.id);
      if (error) throw error;
      return rep(200, { ok: true, date, heure_debut: b.heure_debut, heure_fin: b.heure_fin, avertissements });
    }

    return rep(400, { error: 'action inconnue (reaffecter | auto | deplacer).' });
  } catch (err) {
    return rep(500, { error: err.message });
  }
};

exports.handler = require('./lib/auth').avecAuth(handlerProtege);
