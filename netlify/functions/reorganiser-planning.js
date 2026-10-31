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
//                                          -> { session_id, ordre: [ { of_id, numero, titre, delai, groupe, ... } ] }
//   'planifier' { session_id, of_id, refaire_liens? }  replanifie un OF (refaire_liens : refait d'abord ses dépendances d'après le modèle) (au plus tôt, horaires normaux), dans l'ordre fourni
//                                          -> { fin, delai, respecte_delai, retard_min, heures_sup, renforts, bloquants }
//   'valider'   { session_id }            garde la nouvelle organisation
//   'annuler'   { session_id }            remet le planning exactement comme avant 'preparer'

const { getSupabase } = require('./lib/supabaseclient');
const { aujourdhuiParis } = require('./lib/debut-etape');
const planifierOf = require('./planifier-of');

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
      // Étapes à libérer : « planifié », dont aucun créneau n'a commencé.
      const liberables = gammes.filter((g) => g.statut === 'planifié'
        && !creneaux.some((c) => c.gamme_operatoire_id === g.id && debute(c)));
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
      const ordre = classes.map((o) => ({
        of_id: o.id, numero: o.numero, titre: o.titres ? o.titres.nom : '', delai: o.delai, quantite: o.quantite,
        groupe: estPrioritaire(o) ? 'prioritaire' : 'standard', type_production: o.type_production, priorite: o.priorite,
        etapes: gammes.filter((g) => g.of_id === o.id && (g.statut === 'à planifier' || idsLib.has(g.id))).length,
      }));
      return rep(200, { session_id: sauv.session_id, ordre });
    }

    if (b.action === 'planifier') {
      if (!b.of_id) return rep(400, { error: 'of_id requis.' });
      if (b.refaire_liens) { try { await require('./lib/ordre-gamme').normaliserGamme(supabase, b.of_id, { tout: true }); } catch (_) { /* les liens actuels sont conservés */ } }
      const res = await planifierOf.handler({ httpMethod: 'POST', body: JSON.stringify({ of_id: b.of_id, mode: 'avant', appliquer: true, maintenant }) });
      const d = JSON.parse(res.body);
      if (res.statusCode === 409) return rep(200, { ok: false, bloquants: d.bloquants || [], erreur: d.error });
      if (res.statusCode !== 200) return rep(200, { ok: false, erreur: d.error || `HTTP ${res.statusCode}` });
      const r = d.resume;
      const reponse = { ok: true, debut: r.debut, fin: r.fin, delai: r.delai, respecte_delai: r.respecte_delai, retard_min: r.retard_min, heures_sup: d.alternative_heures_sup, renforts: [] };
      if (r.respecte_delai === false) reponse.renforts = suggestionsRenforts(d, r.retard_min);
      return rep(200, reponse);
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
      // Supprimer ce que la réorganisation a recréé pour ces étapes.
      if (idsGammes.length) {
        const { data: actuels } = await supabase.from('planning_jour').select('id, date').in('gamme_operatoire_id', idsGammes).neq('statut', 'annulé');
        const aEffacer = (actuels || []).filter((c) => !idsSauves.has(c.id)).map((c) => c.id);
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
