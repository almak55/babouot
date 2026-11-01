// functions/reorganiser-planning.js
//
// Réorganisation du planning par priorité : les OF Pléiade / Coffret et les OF « urgente »
// passent d'abord (par date de livraison), les autres commandes sont replanifiées derrière.
// Ce qui est déjà commencé (étape en cours, ou dont un créneau a déjà débuté) est terminé tel quel.
//
// POST { action, ... } — le travail est découpé en appels courts (limite Netlify de 10 s) :
//   'preparer'  { mode? }                 libère les créneaux à venir des étapes non commencées (avec sauvegarde)
//                                          mode 'actualiser' (« Recalculer tous les OF ») : mêmes OF, mais l'ordre actuel du planning est
//                                          conservé (au lieu du classement par priorité) et les OF jamais lancés ne sont pas touchés
//                                          depuis_date 'AAAA-MM-JJ' (« Replanifier à partir d'une date », avec mode 'actualiser') : libère tout ce qui est planifié
//                                          à partir de ce jour, même déjà passé (les étapes qui commencent avant restent ; celles dont la production
//                                          est saisie ne sont jamais libérées) ; inclure_en_cours libère aussi les étapes « en cours »
//                                          -> { session_id, ordre: [ { of_id, numero, titre, delai, groupe, ... } ], proteges, depuis }
//   'planifier' { session_id, of_id, refaire_liens? }  replanifie un OF (refaire_liens : refait d'abord ses dépendances d'après le modèle) (au plus tôt, horaires normaux), dans l'ordre fourni
//                                          -> { fin, delai, respecte_delai, retard_min, heures_sup, renforts, bloquants }
//                                          lots_liberes { gamme_id: 'AAAA-MM-JJTHH:MM' } : étapes à lot minimum à lancer (voir 'lots') ; lots: 'liberes' : tout lancer
//                                          lots_seul: true : avec lots_liberes, ne place que ces étapes (le reste de l'OF est replanifié à l'appel suivant)
//                                          -> + attente_lot : étapes qui attendent un lot (BDM / pressure en colle Pléiade : 3 500 ex. par journée), partiel
//   'lots'      { attentes: [...] }       forme les lots minimum à partir des étapes en attente (réponses 'planifier') :
//                                          -> { lancements: [ { of_id, gamme_id, depart } ], attente: [...] } ; à replanifier ensuite avec lots_liberes
//   'valider'   { session_id }            garde la nouvelle organisation
//   'annuler'   { session_id }            remet le planning exactement comme avant 'preparer'

const { getSupabase } = require('./lib/supabaseclient');
const { aujourdhuiParis } = require('./lib/debut-etape');
const planifierOf = require('./planifier-of');
const PL = require('./lib/planification');
const LOTS = require('./lib/lots');
const { imposerPause } = require('./lib/horaires');

const rep = (code, o) => ({ statusCode: code, body: JSON.stringify(o) });
const PRIORITAIRES = ['pleiade', 'coffret'];
const maintenantParis = () => `${aujourdhuiParis()}T${new Date().toLocaleTimeString('sv-SE', { timeZone: 'Europe/Paris' }).slice(0, 5)}`;
const estPrioritaire = (of) => PRIORITAIRES.includes(of.type_production) || of.priorite === 'urgente';

function trier(ofs) {
  return ofs.slice().sort((a, b) => {
    const pa = estPrioritaire(a) ? 0 : 1, pb = estPrioritaire(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const d = new Date(a.delai || '9999-12-31') - new Date(b.delai || '9999-12-31');
    if (d !== 0) return d;
    const r = (a.rang_priorite ?? 1e9) - (b.rang_priorite ?? 1e9);
    if (r !== 0) return r;
    return new Date(a.date_reception || '9999-12-31') - new Date(b.date_reception || '9999-12-31');
  });
}

// Renforts (tâches manuelles critiques) nécessaires pour rattraper `retardMin`.
function suggestionsRenforts(plan, retardMin) {
  const critiques = new Set((plan.pert ? plan.pert.etapes : []).filter((e) => e.critique).map((e) => e.gamme_id));
  const out = [];
  (plan.etapes || []).filter((e) => !e.fixe && critiques.has(e.gamme_id)).forEach((e) => {
    (e.phases || []).filter((p) => p.repartissable && p.duree_une_personne_min && p.effectif).forEach((p) => {
      const cible = p.duree_min - retardMin;
      if (cible <= 0) return;
      const n = Math.ceil(p.duree_une_personne_min / cible);
      if (n > p.effectif) out.push({ operation: e.operation, phase: p.nom, effectif_actuel: p.effectif, effectif_necessaire: n, supplementaires: n - p.effectif });
    });
  });
  return out;
}

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return rep(405, { error: 'Méthode non autorisée, utiliser POST.' });
    const b = JSON.parse(event.body || '{}');
    const supabase = getSupabase();
    const maintenant = maintenantParis();
    const [aujourdhui, heure] = maintenant.split('T');

    if (b.action === 'preparer') {
      const { data: ofs, error } = await supabase.from('ordres_fabrication')
        .select('id, numero, quantite, delai, priorite, type_production, rang_priorite, date_reception, titres(nom)')
        .in('statut', ['en attente de validation', 'validé', 'en cours']);
      if (error) throw error;
      const ids = ofs.map((o) => o.id);
      if (!ids.length) return rep(200, { session_id: null, ordre: [] });
      const { data: gammes, error: e2 } = await supabase.from('gammes_operatoires').select('id, of_id, statut, machine_id').in('of_id', ids);
      if (e2) throw e2;
      const { data: creneaux, error: e3 } = await supabase.from('planning_jour').select('*').in('of_id', ids).neq('statut', 'annulé');
      if (e3) throw e3;
      const { data: liens } = creneaux.length
        ? await supabase.from('planning_jour_personnel').select('planning_jour_id, personnel_id').in('planning_jour_id', creneaux.map((c) => c.id))
        : { data: [] };

      const debute = (c) => c.date < aujourdhui || (c.date === aujourdhui && String(c.heure_debut || '00:00').slice(0, 5) < heure);
      // « Replanifier à partir d'une date » (depuis_date) : tout ce qui est planifié à partir de ce jour est libéré, même si le jour
      // est déjà passé ; ce qui commence avant reste en place. inclure_en_cours : libère aussi les étapes « en cours ».
      // Une étape dont la production a été saisie (production_jour) n'est jamais libérée : c'est de l'historique réel.
      const depuis = /^\d{4}-\d{2}-\d{2}$/.test(String(b.depuis_date || '')) ? String(b.depuis_date) : null;
      const verrouille = (c) => (depuis ? c.date < depuis : debute(c));
      let avecProduction = new Set();
      if (depuis && gammes.length) {
        try {
          const { data: prods, error: eP } = await supabase.from('production_jour').select('gamme_operatoire_id').in('gamme_operatoire_id', gammes.map((g) => g.id));
          if (!eP) avecProduction = new Set((prods || []).map((x) => x.gamme_operatoire_id));
        } catch (_) { /* table facultative */ }
      }
      const statutsLiberables = depuis && b.inclure_en_cours ? ['planifié', 'en cours'] : ['planifié'];
      // Étapes à libérer : « planifié » (ou « en cours » sur demande), dont aucun créneau n'est verrouillé.
      const candidates = gammes.filter((g) => statutsLiberables.includes(g.statut)
        && !creneaux.some((c) => c.gamme_operatoire_id === g.id && verrouille(c)));
      const proteges = candidates.filter((g) => avecProduction.has(g.id)).length;
      const liberables = candidates.filter((g) => !avecProduction.has(g.id));
      const idsLib = new Set(liberables.map((g) => g.id));
      const aSupprimer = creneaux.filter((c) => idsLib.has(c.gamme_operatoire_id));
      const actualiser = b.mode === 'actualiser';
      // Début actuel du planning à venir de chaque OF (sert à garder l'ordre en mode « actualiser »).
      const debutActuel = new Map();
      aSupprimer.forEach((c) => { const t = `${c.date}T${String(c.heure_debut || '00:00').slice(0, 5)}`; if (!debutActuel.has(c.of_id) || t < debutActuel.get(c.of_id)) debutActuel.set(c.of_id, t); });

      const payload = {
        gammes: liberables.map((g) => ({ id: g.id, statut: g.statut, machine_id: g.machine_id })),
        creneaux: aSupprimer,
        liens: (liens || []).filter((l) => aSupprimer.some((c) => c.id === l.planning_jour_id)),
        de: maintenant,
      };
      const { data: sauv, error: e4 } = await supabase.from('reorg_sauvegarde').insert({ payload }).select('session_id').single();
      if (e4) throw e4;

      if (aSupprimer.length) {
        const { error } = await supabase.from('planning_jour').delete().in('id', aSupprimer.map((c) => c.id));
        if (error) throw error;
      }
      if (idsLib.size) {
        const { error } = await supabase.from('gammes_operatoires').update({ statut: 'à planifier' }).in('id', Array.from(idsLib));
        if (error) throw error;
      }
      // Nettoyages de fin de journée des machines dont des travaux viennent d'être libérés (voir lib/nettoyage.js).
      try { await require('./lib/nettoyage').recalerNettoyages(supabase, aSupprimer.filter((c) => c.machine_id).map((c) => ({ machine_id: c.machine_id, date: c.date }))); }
      catch (e) { console.warn('nettoyage de fin de journée ignoré :', e.message); }
      // OF à replanifier : ceux qui ont au moins une étape « à planifier » (libérée ou nouvelle).
      // Un OF jamais planifié n'est repris que s'il est prioritaire (nouvelle commande Pléiade / urgente).
      const dejaLance = (ofId) => gammes.some((g) => g.of_id === ofId && ['planifié', 'en cours', 'terminé'].includes(g.statut));
      const aPlanifier = new Set(gammes.filter((g) => g.statut === 'à planifier' || idsLib.has(g.id))
        .filter((g) => idsLib.has(g.id) || dejaLance(g.of_id) || (!actualiser && estPrioritaire(ofs.find((o) => o.id === g.of_id))))
        .map((g) => g.of_id));
      const aReplanifier = ofs.filter((o) => aPlanifier.has(o.id));
      const classes = actualiser
        ? aReplanifier.slice().sort((a, c) => { const x = debutActuel.get(a.id) || '9999', y = debutActuel.get(c.id) || '9999'; if (x !== y) return x < y ? -1 : 1; return trier([a, c])[0] === a ? -1 : 1; })
        : trier(aReplanifier);
      const regles = await LOTS.chargerRegles(supabase);
      const ordre = classes.map((o) => ({
        avec_lots: regles.some((r) => !r.type_production || r.type_production === o.type_production),   // OF soumis à une règle de lot minimum
        of_id: o.id, numero: o.numero, titre: o.titres ? o.titres.nom : '', delai: o.delai, quantite: o.quantite,
        groupe: estPrioritaire(o) ? 'prioritaire' : 'standard', type_production: o.type_production, priorite: o.priorite,
        etapes: gammes.filter((g) => g.of_id === o.id && (g.statut === 'à planifier' || idsLib.has(g.id))).length,
      }));
      return rep(200, { session_id: sauv.session_id, ordre, proteges, depuis });
    }

    if (b.action === 'planifier') {
      if (!b.of_id) return rep(400, { error: 'of_id requis.' });
      if (b.refaire_liens) { try { await require('./lib/ordre-gamme').normaliserGamme(supabase, b.of_id, { tout: true }); } catch (_) { /* les liens actuels sont conservés */ } }
      const corps = { of_id: b.of_id, mode: 'avant', appliquer: true, maintenant };
      if (b.lots_liberes && typeof b.lots_liberes === 'object') corps.lots_liberes = b.lots_liberes;
      if (b.lots === 'liberes') corps.lots = 'liberes';
      if (b.lots_seul) corps.lots_seul = true;
      const res = await planifierOf.handler({ httpMethod: 'POST', body: JSON.stringify(corps) });
      const d = JSON.parse(res.body);
      if (res.statusCode === 409) return rep(200, { ok: false, bloquants: d.bloquants || [], erreur: d.error });
      if (res.statusCode !== 200) return rep(200, { ok: false, erreur: d.error || `HTTP ${res.statusCode}` });
      const r = d.resume;
      const reponse = { ok: true, debut: r.debut, fin: r.fin, delai: r.delai, respecte_delai: r.respecte_delai, retard_min: r.retard_min, heures_sup: d.alternative_heures_sup, renforts: [], partiel: !!r.partiel, attente_lot: d.attente_lot || [] };
      if (r.respecte_delai === false) reponse.renforts = suggestionsRenforts(d, r.retard_min);
      return rep(200, reponse);
    }

    if (b.action === 'lots') {
      // Formation des lots minimum : une opération à la fois, journée par journée (voir lib/lots.js).
      const prets = (Array.isArray(b.attentes) ? b.attentes : []).filter((x) => x && x.gamme_id && x.of_id && !x.en_amont && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(x.pret_le || '')));
      if (!prets.length) return rep(200, { lancements: [], attente: [] });
      const { data: cals } = await supabase.from('calendrier_travail').select('*');
      const ligne = (cals || []).map(imposerPause).find((c) => c.code === 'normal');
      const cal = ligne
        ? { code: 'normal', debut: String(ligne.heure_debut).slice(0, 5), fin: String(ligne.heure_fin).slice(0, 5), pause_debut: '12:00', pause_minutes: 30 }
        : { code: 'normal', debut: '08:00', fin: '16:30', pause_debut: '12:00', pause_minutes: 30 };
      const minutes = (iso) => PL.enMinutes(String(iso).slice(0, 10), String(iso).slice(11, 16));
      const iso = (m) => `${PL.dateDe(m)}T${PL.heureDe(m)}`;
      const apartir = minutes(maintenant);
      // Journées où une machine tourne déjà pour cette opération (OF Pléiade) : un nouveau lot ne s'y mêle pas.
      const codes = Array.from(new Set(prets.map((x) => x.operation_code)));
      const [opsRes, ofsRes] = await Promise.all([
        supabase.from('operations').select('id, code').in('code', codes),
        supabase.from('ordres_fabrication').select('id, type_production').eq('type_production', 'pleiade'),
      ]);
      if (opsRes.error) throw opsRes.error; if (ofsRes.error) throw ofsRes.error;
      const idsOps = (opsRes.data || []).map((o) => o.id), idsOf = (ofsRes.data || []).map((o) => o.id);
      const codeDe = Object.fromEntries((opsRes.data || []).map((o) => [o.id, o.code]));
      let lignesPlan = [];
      if (idsOps.length && idsOf.length) {
        const r = await supabase.from('planning_jour').select('date, machine_id, operation_id, of_id, statut').in('operation_id', idsOps).in('of_id', idsOf).neq('statut', 'annulé');
        if (r.error) throw r.error; lignesPlan = (r.data || []).filter((l) => l.machine_id);
      }
      const lancements = []; const attente = [];
      for (const code of codes) {
        const groupe = prets.filter((x) => x.operation_code === code);
        const min = Math.max(...groupe.map((x) => Number(x.quantite_min) || 0));
        const joursPris = new Set(lignesPlan.filter((l) => codeDe[l.operation_id] === code).map((l) => PL.enMinutes(l.date, '00:00')));
        const items = groupe.map((x) => ({ cle: x.gamme_id, x, qte: Number(x.quantite) || 0, pret: minutes(x.pret_le), mer_min: Number(x.mer_min) || 0, regl_min: Number(x.regl_min) || 0, roulage_min: Number(x.roulage_min) || 0, rang: Number(x.rang) || 0 }));
        const f = LOTS.formerLots({ items, joursPris, apartir, min, cal });
        f.lots.forEach((lot) => lot.membres.forEach((m) => lancements.push({
          of_id: m.x.of_id, gamme_id: m.cle, operation_code: code, depart: iso(lot.depart), lot_jour: PL.dateDe(lot.jour), lot_total: lot.total,
          jours: lot.jours.map((j) => ({ date: PL.dateDe(j.jour), quantite: j.qte })), rang: m.rang,
        })));
        const total = f.attente.reduce((t, i) => t + i.qte, 0);
        f.attente.forEach((i) => attente.push({ of_id: i.x.of_id, gamme_id: i.cle, operation_code: code, quantite: i.qte, quantite_min: min, total_en_attente: total, manque: Math.max(0, min - total) }));
      }
      return rep(200, { lancements, attente });
    }

    if (b.action === 'lots_bilan') {
      // Contrôle du planning : quantité réellement programmée par journée de machine pour les opérations à lot minimum.
      const regles = await LOTS.chargerRegles(supabase);
      const codes = Array.from(new Set(regles.map((r) => r.operation_code)));
      if (!codes.length) return rep(200, { jours: [], regles: [] });
      const [opsRes, ofsRes, machRes] = await Promise.all([
        supabase.from('operations').select('id, code').in('code', codes),
        supabase.from('ordres_fabrication').select('id, numero, quantite, type_production').in('statut', ['en attente de validation', 'validé', 'en cours']),
        supabase.from('machines').select('id, nom'),
      ]);
      if (opsRes.error) throw opsRes.error; if (ofsRes.error) throw ofsRes.error;
      const codeDe = Object.fromEntries((opsRes.data || []).map((o) => [o.id, o.code]));
      const ofDe = Object.fromEntries((ofsRes.data || []).map((o) => [o.id, o]));
      const nomMachine = Object.fromEntries((machRes.data || []).map((m) => [m.id, m.nom]));
      const idsOps = Object.keys(codeDe), idsOf = Object.keys(ofDe);
      if (!idsOps.length || !idsOf.length) return rep(200, { jours: [], regles });
      const { data: lignes, error: eL } = await supabase.from('planning_jour').select('date, heure_debut, heure_fin, machine_id, operation_id, of_id, gamme_operatoire_id, phase, statut')
        .in('operation_id', idsOps).in('of_id', idsOf).neq('statut', 'annulé');
      if (eL) throw eL;
      const minutes = (l) => Math.max(0, (Number(String(l.heure_fin).slice(0, 2)) * 60 + Number(String(l.heure_fin).slice(3, 5))) - (Number(String(l.heure_debut).slice(0, 2)) * 60 + Number(String(l.heure_debut).slice(3, 5))));
      const travail = (lignes || []).filter((l) => l.machine_id && l.gamme_operatoire_id && !/mise en route|r[ée]glage|nettoyage/i.test(l.phase || ''));
      const totalGamme = {};
      travail.forEach((l) => { totalGamme[l.gamme_operatoire_id] = (totalGamme[l.gamme_operatoire_id] || 0) + minutes(l); });
      const jours = new Map();
      travail.forEach((l) => {
        const of = ofDe[l.of_id]; const code = codeDe[l.operation_id];
        const regle = of && LOTS.regleDe(regles, code, of.type_production);
        if (!regle || l.date < aujourdhui) return;
        const part = totalGamme[l.gamme_operatoire_id] > 0 ? minutes(l) / totalGamme[l.gamme_operatoire_id] : 0;
        const cle = `${code}|${l.machine_id}|${l.date}`;
        const j = jours.get(cle) || { operation_code: code, machine: nomMachine[l.machine_id] || '?', date: l.date, quantite: 0, quantite_min: regle.quantite_min, ofs: new Set() };
        j.quantite += Number(of.quantite) * part; j.ofs.add(of.numero); jours.set(cle, j);
      });
      const liste = Array.from(jours.values()).map((j) => ({ ...j, quantite: Math.round(j.quantite), ofs: Array.from(j.ofs).sort(), ok: j.quantite >= j.quantite_min * 0.995 }))
        .sort((a, c) => (a.date === c.date ? String(a.operation_code).localeCompare(String(c.operation_code)) : a.date < c.date ? -1 : 1));
      return rep(200, { jours: liste, regles });
    }

    if (b.action === 'valider') {
      if (!b.session_id) return rep(400, { error: 'session_id requis.' });
      const { error } = await supabase.from('reorg_sauvegarde').delete().eq('session_id', b.session_id);
      if (error) throw error;
      return rep(200, { ok: true });
    }

    if (b.action === 'annuler') {
      if (!b.session_id) return rep(400, { error: 'session_id requis.' });
      const { data, error } = await supabase.from('reorg_sauvegarde').select('payload').eq('session_id', b.session_id).single();
      if (error) throw error;
      const p = data.payload;
      const idsGammes = p.gammes.map((g) => g.id);
      const idsSauves = new Set(p.creneaux.map((c) => c.id));
      const joursMachine = p.creneaux.filter((c) => c.machine_id).map((c) => ({ machine_id: c.machine_id, date: c.date }));   // journées dont le nettoyage de fin de journée est à recaler
      // Supprimer ce que la réorganisation a recréé pour ces étapes.
      if (idsGammes.length) {
        const { data: actuels } = await supabase.from('planning_jour').select('id, date, machine_id').in('gamme_operatoire_id', idsGammes).neq('statut', 'annulé');
        const effaces = (actuels || []).filter((c) => !idsSauves.has(c.id));
        const aEffacer = effaces.map((c) => c.id);
        effaces.forEach((c) => { if (c.machine_id) joursMachine.push({ machine_id: c.machine_id, date: c.date }); });
        if (aEffacer.length) { const { error: e } = await supabase.from('planning_jour').delete().in('id', aEffacer); if (e) throw e; }
      }
      if (p.creneaux.length) {
        const { error: e } = await supabase.from('planning_jour').insert(p.creneaux);
        if (e) throw e;
        if (p.liens.length) { const { error: e2 } = await supabase.from('planning_jour_personnel').insert(p.liens); if (e2) throw e2; }
      }
      for (const g of p.gammes) {
        const { error: e } = await supabase.from('gammes_operatoires').update({ statut: g.statut, machine_id: g.machine_id }).eq('id', g.id);
        if (e) throw e;
      }
      try { await require('./lib/nettoyage').recalerNettoyages(supabase, joursMachine); }
      catch (e) { console.warn('nettoyage de fin de journée ignoré :', e.message); }
      await supabase.from('reorg_sauvegarde').delete().eq('session_id', b.session_id);
      return rep(200, { ok: true, restaure: p.creneaux.length });
    }
    return rep(400, { error: 'action inconnue (preparer | planifier | valider | annuler).' });
  } catch (err) {
    return rep(500, { error: err.message });
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
