// functions/rapport-of.js
//
// GET  /.netlify/functions/rapport-of?of_id=<uuid>
//      Rapport de production d'un OF : traçabilité complète (chronologie, changements, prévu / réel par étape, personnel, machines,
//      interventions, absences), respect du délai, retour d'expérience et plan d'amélioration (analyse : lib/rapport-analyse.js).
//      Utilisable sur un OF terminé (rapport définitif) ou en cours (rapport provisoire).
//
// POST /.netlify/functions/rapport-of   body : { of_id, observation }
//      Ajoute une observation libre (incident, cause d'un retard, remarque qualité…) au journal de l'OF.
//
// Les données non saisies ne sont jamais estimées : elles sont signalées dans « qualite_donnees ».

const { getSupabase } = require('./lib/supabaseclient');
const { aujourdhuiParis } = require('./lib/debut-etape');
const { analyser } = require('./lib/rapport-analyse');
const EL = require('./lib/en-ligne');

const PAGE = 1000;
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
// Table facultative (migration absente) : liste vide au lieu d'une erreur.
async function facultatif(promesse) {
  try { const r = await promesse; return r.error ? [] : (r.data || []); } catch (e) { return []; }
}
const rep = (code, obj) => ({ statusCode: code, body: JSON.stringify(obj) });

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();

    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      const texte = String(b.observation || '').trim();
      if (!b.of_id) return rep(400, { error: 'of_id requis.' });
      if (!texte) return rep(400, { error: 'Observation vide.' });
      const { data: of } = await supabase.from('ordres_fabrication').select('id').eq('id', b.of_id).maybeSingle();
      if (!of) return rep(404, { error: 'OF introuvable.' });
      const { error } = await supabase.from('of_journal').insert({ of_id: b.of_id, type: 'observation', resume: texte.slice(0, 600), details: { saisie_manuelle: true } });
      if (error) return rep(500, { error: /of_journal/.test(error.message || '') ? 'Le journal n\'existe pas : exécutez la migration 58 dans Supabase.' : error.message });
      return rep(200, { ok: true });
    }
    if (event.httpMethod !== 'GET') return rep(405, { error: 'Méthode non autorisée.' });

    const ofId = (event.queryStringParameters || {}).of_id;
    if (!ofId) return rep(400, { error: 'of_id requis.' });

    const { data: of, error: eOf } = await supabase.from('ordres_fabrication').select('*, titres(nom, client)').eq('id', ofId).maybeSingle();
    if (eOf) throw eOf;
    if (!of) return rep(404, { error: 'OF introuvable.' });

    const { data: gammes, error: eG } = await supabase.from('gammes_operatoires')
      .select('id, sequence, statut, avancement_pct, quantite_realisee, date_fin_reelle, machine_id, predecesseurs, parametres, operations(nom), machines(nom)').eq('of_id', ofId).order('sequence');
    if (eG) throw eG;

    const [planning, prodJour, prodPers, journal, personnelListe] = await Promise.all([
      toutLire(() => supabase.from('planning_jour').select('id, date, heure_debut, heure_fin, phase, statut, gamme_operatoire_id, machine_id, personnel_id, machines(nom), planning_jour_personnel(personnel_id)').eq('of_id', ofId).order('date').order('id')),
      toutLire(() => supabase.from('production_jour').select('*').eq('of_id', ofId).order('date').order('id')),
      facultatif(supabase.from('production_jour_personne').select('*').eq('of_id', ofId).order('date')),
      facultatif(supabase.from('of_journal').select('*').eq('of_id', ofId).order('date_evt')),
      facultatif(supabase.from('personnel').select('id, nom, poste')),
    ]);

    // Temps standards actuels de la gamme (heures·personne) : base de comparaison avec le réel.
    let calcul = null;
    try { calcul = await require('./lib/durees').calculerEtapes(supabase, ofId); } catch (e) { console.warn('rapport-of : temps standards indisponibles :', e.message); }
    const stdDe = {};
    ((calcul && calcul.etapes) || []).forEach((e) => {
      const pers = (p) => Number(p.duree_h) * (Number(p.nb_personnes) || 1);
      const reg = e.phases.filter((p) => ['reglage', 'nettoyage'].includes(EL.typePhase(p.nom))).reduce((t, p) => t + pers(p), 0);
      const prod = e.phases.filter((p) => EL.typePhase(p.nom) === 'production').reduce((t, p) => t + pers(p), 0);
      const manuelle = e.duree_manuelle_h !== null && e.duree_manuelle_h !== undefined;
      const attentes = Object.values(e.delais_min || {}).map(Number).filter((x) => x > 0);
      stdDe[e.gamme_id] = {
        heures_personnes: Number(e.heures_personnes) || 0, total_h: Number(e.total_h) || 0,
        reglage_h: manuelle ? null : reg, production_h: manuelle ? Number(e.duree_manuelle_h) : prod,
        chiffre: !!e.chiffre, manuelle, quantite_etape: e.quantite_etape, unite_quantite: e.unite_quantite || null,
        delai_attente_h: attentes.length ? Math.max(...attentes) / 60 : null,
      };
    });

    const personnel = Object.fromEntries(personnelListe.map((p) => [p.id, { nom: p.nom, poste: p.poste || '' }]));
    const etapes = gammes.map((g) => {
      const s = stdDe[g.id] || {};
      return {
        gamme_id: g.id, sequence: g.sequence, operation: g.operations ? g.operations.nom : '?', statut: g.statut, avancement_pct: g.avancement_pct,
        date_fin_reelle: g.date_fin_reelle, machine: g.machines ? g.machines.nom : null, predecesseurs: g.predecesseurs,
        quantite_etape: s.quantite_etape ?? ((g.parametres && Number(g.parametres.quantite) > 0) ? Number(g.parametres.quantite) : of.quantite), unite_quantite: s.unite_quantite || null,
        std: { heures_personnes: s.heures_personnes ?? null, reglage_h: s.reglage_h ?? null, production_h: s.production_h ?? null, chiffre: s.chiffre, manuelle: s.manuelle, delai_attente_h: s.delai_attente_h ?? null },
        creneaux: planning.filter((l) => l.gamme_operatoire_id === g.id && l.statut !== 'annulé').map((l) => ({
          date: String(l.date).slice(0, 10), debut: l.heure_debut ? String(l.heure_debut).slice(0, 5) : null, fin: l.heure_fin ? String(l.heure_fin).slice(0, 5) : null,
          phase: l.phase || '', machine: l.machines ? l.machines.nom : null, statut: l.statut,
          personnes: Array.from(new Set([...(l.personnel_id ? [l.personnel_id] : []), ...(l.planning_jour_personnel || []).map((x) => x.personnel_id)])),
        })),
        saisies: prodJour.filter((l) => l.gamme_operatoire_id === g.id),
        saisies_personne: prodPers.filter((l) => l.gamme_operatoire_id === g.id),
      };
    });

    // Fenêtre de la production (dates planifiées et saisies).
    const toutesDates = [...planning.map((l) => String(l.date).slice(0, 10)), ...prodJour.map((l) => String(l.date).slice(0, 10))].sort();
    const fenDebut = toutesDates[0] || null, fenFin = toutesDates[toutesDates.length - 1] || null;
    const idsMachines = Array.from(new Set(gammes.map((g) => g.machine_id).concat(planning.map((l) => l.machine_id)).filter(Boolean)));
    const idsPersonnes = Array.from(new Set([...planning.flatMap((l) => [l.personnel_id, ...(l.planning_jour_personnel || []).map((x) => x.personnel_id)]), ...prodPers.map((l) => l.personnel_id)].filter(Boolean)));

    const [interventionsBrutes, absencesBrutes, partagesBruts, paramsDevis] = await Promise.all([
      idsMachines.length ? facultatif(supabase.from('maintenance_machine').select('*, machines(nom)').in('machine_id', idsMachines)) : [],
      idsPersonnes.length && fenDebut ? facultatif(supabase.from('personnel_planning_jour').select('personnel_id, date, statut').in('personnel_id', idsPersonnes).in('statut', ['absent', 'en arrêt']).gte('date', fenDebut).lte('date', fenFin)) : [],
      idsMachines.length && fenDebut ? facultatif(supabase.from('planning_jour').select('date, machine_id, of_id, machines(nom), ordres_fabrication(numero)').in('machine_id', idsMachines).gte('date', fenDebut).lte('date', fenFin).neq('of_id', ofId).neq('statut', 'annulé')) : [],
      facultatif(supabase.from('parametres_devis').select('cle, valeur').eq('cle', 'cout_horaire_personnel')),
    ]);

    const interventions = interventionsBrutes.map((iv) => ({ machine: iv.machines ? iv.machines.nom : '?', type: iv.type, date_debut: iv.date_debut, date_fin: iv.date_fin, date_fin_prevue: iv.date_fin_prevue || null, bloquant: iv.bloquant !== false, statut: iv.statut, description: iv.description || '' }));
    const absences = absencesBrutes.map((a) => ({ personnel_id: a.personnel_id, date: String(a.date).slice(0, 10) }));   // aucun motif n'est lu ni transmis
    const partagesMap = new Map();
    partagesBruts.forEach((p) => {
      const cle = `${p.machines ? p.machines.nom : '?'}|${String(p.date).slice(0, 10)}`;
      const x = partagesMap.get(cle) || { machine: p.machines ? p.machines.nom : '?', date: String(p.date).slice(0, 10), autres_of: [] };
      const n = p.ordres_fabrication ? p.ordres_fabrication.numero : null; if (n && !x.autres_of.includes(n)) x.autres_of.push(n);
      partagesMap.set(cle, x);
    });
    const taux = paramsDevis.length ? Number(paramsDevis[0].valeur) : null;

    const rapport = analyser({
      of: { id: of.id, numero: of.numero, titre: of.titres ? of.titres.nom : '', client: of.titres ? of.titres.client : '', type_production: of.type_production, quantite: of.quantite, delai: of.delai,
        priorite: of.priorite, statut: of.statut, created_at: of.created_at, date_reception: of.date_reception || null, sans_lot_minimum: of.sans_lot_minimum === true, caracteristiques: of.caracteristiques || {} },
      aujourdhui: aujourdhuiParis(), etapes, personnel, journal, interventions, absences, partages: Array.from(partagesMap.values()), taux_horaire: Number.isFinite(taux) ? taux : null,
    });
    return rep(200, rapport);
  } catch (e) {
    console.error('rapport-of error:', e);
    return rep(500, { error: e.message || String(e) });
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
