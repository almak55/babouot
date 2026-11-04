// functions/optimiser-production.js
//
// « Optimiser la production » (Reporting). POST { action, ... } — le travail est découpé en appels courts (limite Netlify de 10 s) ;
// l'enchaînement (essais de plusieurs ordres de passage dans le moteur de planification, avec retour exact à l'état précédent après chaque essai)
// est piloté par l'écran, qui s'appuie sur reorganiser-planning.js (preparer / planifier / lots / annuler / valider).
//
//   'lister'    { debut, fin }                         OF candidats sur la période (créneaux dans la période, ou livraison dans la période)
//   'mesurer'   { of_ids, debut, fin }                 indicateurs du planning actuel de ces OF (retards, réglages, nettoyages, trous, heures sup, personnel…)
//   'candidats' { of_ids, debut, fin }                 ordres de passage à essayer (règles métier)
//   'ia_ordre'  { of_ids, debut, fin }                 ordre de passage proposé par l'IA (facultatif : sans clé ou en cas d'erreur, ignoré)
//   'comparer'  { base, essais:[{code,nom,ordre,mesure,attentes_lot}], debut, fin }   classement des essais, recommandation, texte
//   'ia_synthese' { comparaison }                      analyse rédigée par l'IA (facultatif)

const { getSupabase } = require('./lib/supabaseclient');
const { aujourdhuiParis } = require('./lib/debut-etape');
const OPT = require('./lib/optimisation');

const rep = (code, o) => ({ statusCode: code, body: JSON.stringify(o) });
const STATUTS = ['en attente de validation', 'validé', 'en cours'];
const PAGE = 1000;
const ok10 = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

async function toutLire(fabrique) {
  const lignes = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await fabrique().range(debut, debut + PAGE - 1);
    if (error) throw error;
    lignes.push(...(data || []));
    if (!data || data.length < PAGE) break;
    if (debut > 50 * PAGE) break;
  }
  return lignes;
}
// Par paquets : une requête .in() avec beaucoup d'identifiants dépasse la taille d'URL.
async function parPaquets(ids, fabrique, taille = 40) {
  const sortie = [];
  for (let i = 0; i < ids.length; i += taille) sortie.push(...await toutLire(() => fabrique(ids.slice(i, i + taille))));
  return sortie;
}
const minutesDe = (l) => OPT.minutesCreneau(l);

async function lireOf(supabase, ofIds) {
  const { data: ofs, error } = await supabase.from('ordres_fabrication').select('id, numero, quantite, delai, priorite, type_production, statut, date_reception, titres(nom, client)').in('id', ofIds);
  if (error) throw error;
  return ofs || [];
}
async function lireGammes(supabase, ofIds) {
  return parPaquets(ofIds, (ids) => supabase.from('gammes_operatoires').select('id, of_id, sequence, statut, machine_id, machines(nom)').in('of_id', ids).order('id'));
}
async function lireCreneaux(supabase, ofIds) {
  const lignes = await parPaquets(ofIds, (ids) => supabase.from('planning_jour')
    .select('id, of_id, date, heure_debut, heure_fin, phase, statut, machine_id, personnel_id, gamme_operatoire_id, planning_jour_personnel(personnel_id)').in('of_id', ids).neq('statut', 'annulé').order('id'));
  return lignes.map((l) => ({ ...l, date: String(l.date).slice(0, 10), personnes: Array.from(new Set([...(l.personnel_id ? [l.personnel_id] : []), ...(l.planning_jour_personnel || []).map((x) => x.personnel_id)])) }));
}

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return rep(405, { error: 'Méthode non autorisée, utiliser POST.' });
    const b = JSON.parse(event.body || '{}');
    const supabase = getSupabase();
    const aujourdhui = aujourdhuiParis();
    const debut = ok10(b.debut) ? b.debut : null, fin = ok10(b.fin) ? b.fin : null;
    const depuis = debut && debut > aujourdhui ? debut : aujourdhui;      // on ne replanifie jamais le passé
    const ofIds = Array.isArray(b.of_ids) ? b.of_ids.filter((x) => typeof x === 'string').slice(0, 25) : [];

    // ───────────── lister ─────────────
    if (b.action === 'lister') {
      if (!debut || !fin || fin < debut) return rep(400, { error: 'Période invalide : choisissez un début et une fin (début ≤ fin).' });
      const { data: actifs, error } = await supabase.from('ordres_fabrication')
        .select('id, numero, quantite, delai, priorite, type_production, statut, titres(nom, client)').in('statut', STATUTS);
      if (error) throw error;
      const ids = (actifs || []).map((o) => o.id);
      if (!ids.length) return rep(200, { debut, fin, depuis, ofs: [] });
      const gammes = await lireGammes(supabase, ids);
      const creneauxPeriode = await toutLire(() => supabase.from('planning_jour').select('id, of_id').gte('date', debut).lte('date', fin).neq('statut', 'annulé').in('of_id', ids).order('id'));
      const dansPeriode = new Set(creneauxPeriode.map((l) => l.of_id));
      const restant = (id) => gammes.filter((g) => g.of_id === id && g.statut !== 'terminé');
      const candidats = (actifs || []).filter((o) => restant(o.id).length
        && (dansPeriode.has(o.id) || (o.delai && String(o.delai).slice(0, 10) >= debut && String(o.delai).slice(0, 10) <= fin)
          || (restant(o.id).some((g) => g.statut === 'à planifier') && o.delai && String(o.delai).slice(0, 10) <= fin)));
      const creneaux = candidats.length ? await lireCreneaux(supabase, candidats.map((o) => o.id)) : [];
      const sortie = candidats.map((o) => {
        const m = OPT.mesurer({ ofs: [o], creneaux: creneaux.filter((l) => l.of_id === o.id), depuis, debut, fin });
        const f = m.ofs[0];
        const mesGammes = gammes.filter((g) => g.of_id === o.id);
        const dans = creneaux.filter((l) => l.of_id === o.id && l.date >= debut && l.date <= fin);
        return {
          id: o.id, numero: o.numero, titre: o.titres ? o.titres.nom : '', client: o.titres ? o.titres.client : '', quantite: o.quantite, delai: o.delai ? String(o.delai).slice(0, 10) : null,
          priorite: o.priorite, type_production: o.type_production, statut: o.statut,
          etapes_restantes: restant(o.id).length, etapes_a_planifier: mesGammes.filter((g) => g.statut === 'à planifier').length, etapes_en_cours: mesGammes.filter((g) => g.statut === 'en cours').length,
          creneaux_periode: dans.length, minutes_periode: dans.reduce((t, l) => t + minutesDe(l), 0),
          fin_planifiee: f.fin, retard_jours: f.retard_jours, en_retard: f.en_retard, non_planifie: f.non_planifie,
          machines: Array.from(new Set(mesGammes.map((g) => g.machines && g.machines.nom).filter(Boolean))),
        };
      }).sort((a, c) => String(a.delai || '9999').localeCompare(String(c.delai || '9999')) || String(a.numero).localeCompare(String(c.numero)));
      return rep(200, { debut, fin, depuis, ofs: sortie });
    }

    if (['mesurer', 'candidats', 'ia_ordre'].includes(b.action) && !ofIds.length) return rep(400, { error: 'Choisissez au moins un OF.' });

    // ───────────── mesurer ─────────────
    if (b.action === 'mesurer') {
      const [ofs, gammes, creneaux] = await Promise.all([lireOf(supabase, ofIds), lireGammes(supabase, ofIds), lireCreneaux(supabase, ofIds)]);
      const machines = {}; gammes.forEach((g) => { if (g.machine_id && g.machines) machines[g.machine_id] = g.machines.nom; });
      const idsMachines = Array.from(new Set(creneaux.map((l) => l.machine_id).filter((x) => x && !machines[x])));
      if (idsMachines.length) { const { data } = await supabase.from('machines').select('id, nom').in('id', idsMachines); (data || []).forEach((m) => { machines[m.id] = m.nom; }); }
      const nonPlanifies = {}; gammes.filter((g) => g.statut === 'à planifier').forEach((g) => { nonPlanifies[g.of_id] = (nonPlanifies[g.of_id] || 0) + 1; });
      const { data: pers } = await supabase.from('personnel').select('id, nom');
      const mesure = OPT.mesurer({ ofs: ofs.map((o) => ({ id: o.id, numero: o.numero, titre: o.titres ? o.titres.nom : '', delai: o.delai })), creneaux, machines, personnel: Object.fromEntries((pers || []).map((p) => [p.id, p.nom])), depuis, debut, fin, non_planifies: nonPlanifies });
      return rep(200, { mesure, depuis, aujourdhui });
    }

    // Données communes à 'candidats' et 'ia_ordre'.
    const faits = async () => {
      const [ofs, gammes, creneaux] = await Promise.all([lireOf(supabase, ofIds), lireGammes(supabase, ofIds), lireCreneaux(supabase, ofIds)]);
      const futurs = creneaux.filter((l) => l.date >= depuis);
      const liste = ofs.map((o) => {
        const ls = futurs.filter((l) => l.of_id === o.id);
        const gs = gammes.filter((g) => g.of_id === o.id && g.statut !== 'terminé');
        return {
          id: o.id, numero: o.numero, titre: o.titres ? o.titres.nom : '', quantite: o.quantite, delai: o.delai ? String(o.delai).slice(0, 10) : null, priorite: o.priorite, type_production: o.type_production,
          charge_min: ls.reduce((t, l) => t + minutesDe(l), 0),
          debut_actuel: ls.reduce((m, l) => { const t = `${l.date}T${String(l.heure_debut).slice(0, 5)}`; return !m || t < m ? t : m; }, ''),
          machines: Array.from(new Set(gs.map((g) => g.machines && g.machines.nom).filter(Boolean))),
          non_planifie: gs.some((g) => g.statut === 'à planifier'), etapes_restantes: gs.length,
        };
      });
      // OF sans créneau : charge estimée d'après les temps standards (au mieux).
      const sans = liste.filter((o) => !o.charge_min).slice(0, 6);
      if (sans.length) {
        const durees = require('./lib/durees');
        await Promise.all(sans.map(async (o) => {
          try {
            const c = await durees.calculerEtapes(supabase, o.id);
            const restantes = new Set(gammes.filter((g) => g.of_id === o.id && g.statut !== 'terminé').map((g) => g.id));
            o.charge_min = Math.round(((c && c.etapes) || []).filter((e) => restantes.has(e.gamme_id)).reduce((t, e) => t + (Number(e.total_h) || 0) * 60, 0));
            o.charge_estimee = true;
          } catch (e) { /* estimation indisponible */ }
        }));
      }
      return liste;
    };

    // ───────────── candidats ─────────────
    if (b.action === 'candidats') {
      const liste = await faits();
      const cands = OPT.candidats(liste, aujourdhui).map((c) => ({ code: c.code, nom: c.nom, description: c.description, aussi: c.aussi || [], ordre: c.ordre }));
      return rep(200, { candidats: cands, ofs: liste.map((o) => ({ id: o.id, numero: o.numero, charge_min: o.charge_min })) });
    }

    // ───────────── ia_ordre ─────────────
    if (b.action === 'ia_ordre') {
      const cle = process.env.ANTHROPIC_API_KEY;
      if (!cle) return rep(200, { ok: false, raison: 'ANTHROPIC_API_KEY absent : l\'IA n\'est pas utilisée pour proposer un ordre.' });
      const liste = await faits();
      if (liste.length < 2) return rep(200, { ok: false, raison: 'Un seul OF : pas d\'ordre à proposer.' });
      const donnees = liste.map((o) => ({ numero: o.numero, titre: o.titre, quantite: o.quantite, type: o.type_production || 'standard', priorite: o.priorite, livraison: o.delai,
        jours_ouvres_avant_livraison: o.delai ? require('./lib/rapport-analyse').joursOuvres(aujourdhui, o.delai) : null, charge_restante_heures: Math.round((o.charge_min / 60) * 10) / 10, machines: o.machines, deja_commence_partiellement: !o.non_planifie }));
      const consigne = `Tu es l'ordonnanceur d'un atelier de reliure industrielle. On te donne des ordres de fabrication (OF) à replanifier à partir du ${aujourdhui}. Propose l'ORDRE DE PASSAGE qui rend la production la plus faisable : tenir les dates de livraison, limiter les mises en route et nettoyages (enchaîner les OF qui utilisent les mêmes machines), éviter les temps morts, ne pas surcharger les équipes.
Règles de l'atelier : lundi-vendredi 8h-12h et 12h30-16h30, pause de 12h à 12h30 ; une machine = une « journée de machine » (une mise en route et un nettoyage par jour) ; les OF Pléiade et Coffret sont prioritaires ; certaines machines ont des règles de démarrage et des lots minimum que le moteur de planification applique lui-même (tu n'as pas à les calculer).
Réponds UNIQUEMENT par un JSON : {"ordre":["numéro d'OF", ...],"justification":"3 phrases maximum en français","points_attention":["…"]}. "ordre" doit contenir CHAQUE numéro d'OF exactement une fois.`;
      const ctrl = new AbortController(); const minuteur = setTimeout(() => ctrl.abort(), 8000);
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', 'x-api-key': cle, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 700, system: consigne, messages: [{ role: 'user', content: JSON.stringify(donnees) }] }) });
        if (!r.ok) return rep(200, { ok: false, raison: `IA indisponible (HTTP ${r.status}).` });
        const d = await r.json();
        const texte = (d.content || []).map((x) => x.text || '').join('').replace(/```json|```/g, '').trim();
        const j = JSON.parse(texte.slice(texte.indexOf('{'), texte.lastIndexOf('}') + 1));
        const parNumero = new Map(liste.map((o) => [o.numero, o.id]));
        const ordre = []; (Array.isArray(j.ordre) ? j.ordre : []).forEach((n) => { const id = parNumero.get(String(n).trim()); if (id && !ordre.includes(id)) ordre.push(id); });
        if (ordre.length < Math.ceil(liste.length / 2)) return rep(200, { ok: false, raison: 'Réponse de l\'IA inexploitable.' });
        liste.forEach((o) => { if (!ordre.includes(o.id)) ordre.push(o.id); });   // les OF oubliés passent à la fin, dans l'ordre d'origine
        return rep(200, { ok: true, ordre, justification: String(j.justification || '').slice(0, 700), points_attention: (Array.isArray(j.points_attention) ? j.points_attention : []).map((x) => String(x).slice(0, 220)).slice(0, 5) });
      } catch (e) {
        return rep(200, { ok: false, raison: e.name === 'AbortError' ? 'L\'IA a mis trop de temps à répondre.' : `IA indisponible : ${e.message}` });
      } finally { clearTimeout(minuteur); }
    }

    // ───────────── comparer ─────────────
    if (b.action === 'comparer') {
      if (!b.base || !Array.isArray(b.essais) || !b.essais.length) return rep(400, { error: 'base et essais requis.' });
      return rep(200, OPT.comparer(b.base, b.essais, aujourdhui));
    }

    // ───────────── ia_synthese ─────────────
    if (b.action === 'ia_synthese') {
      const cle = process.env.ANTHROPIC_API_KEY;
      if (!cle) return rep(200, { ok: false });
      const c = b.comparaison || {};
      const compact = { note_actuelle: c.note_base, recommande: c.recommande_code, periode: { debut, fin }, base: b.base ? { ...b.base, ofs: (b.base.ofs || []).map((o) => ({ of: o.numero, fin: o.fin, retard_jours: o.retard_jours })) } : null,
        essais: (c.essais || []).map((e) => ({ code: e.code, nom: e.nom, note: e.note, gain_pct: e.gain_pct, nb_en_retard: e.mesure.nb_en_retard, retard_jours_total: e.mesure.retard_jours_total, reglage_nettoyage_min: e.mesure.minutes.reglage + e.mesure.minutes.nettoyage, trous_min: e.mesure.trous_min, heures_sup_min: e.mesure.heures_sup_min, jours_machine: e.mesure.jours_machine, fin_globale: e.mesure.fin_globale, ofs: (e.mesure.ofs || []).map((o) => ({ of: o.numero, fin: o.fin, retard_jours: o.retard_jours })) })) };
      const consigne = 'Tu conseilles le chef d\'atelier d\'une reliure industrielle. On te donne le planning actuel et plusieurs réorganisations réellement calculées par le moteur de planification, avec leurs indicateurs. Rédige en français, en 120 mots maximum, une analyse claire : quelle organisation retenir et pourquoi (chiffres à l\'appui), ce qu\'on gagne, ce qui reste risqué (OF encore en retard, heures supplémentaires, dépendance à une machine) et 1 à 2 actions concrètes. Pas de titre, pas de liste à puces. N\'invente aucun chiffre qui ne figure pas dans les données.';
      const ctrl = new AbortController(); const minuteur = setTimeout(() => ctrl.abort(), 8000);
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json', 'x-api-key': cle, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 500, system: consigne, messages: [{ role: 'user', content: JSON.stringify(compact) }] }) });
        if (!r.ok) return rep(200, { ok: false });
        const d = await r.json();
        return rep(200, { ok: true, texte: (d.content || []).map((x) => x.text || '').join('').trim().slice(0, 1500) });
      } catch (e) { return rep(200, { ok: false }); } finally { clearTimeout(minuteur); }
    }

    return rep(400, { error: 'action inconnue (lister | mesurer | candidats | ia_ordre | comparer | ia_synthese).' });
  } catch (err) {
    console.error('optimiser-production error:', err);
    return rep(500, { error: err.message });
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
