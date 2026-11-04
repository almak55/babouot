// functions/feuille-semaine.js
//
// GET /.netlify/functions/feuille-semaine?date=2026-11-04
//   (n'importe quel jour de la semaine voulue : la semaine commence le lundi)
//
// Données de la feuille de placement de la SEMAINE (à titre indicatif) :
//   • pour chaque personne affectée : ses travaux jour par jour (titre, n° d'OF, machines ou équipements),
//     avec les jours d'absence marqués « absent » SANS motif ;
//   • les absents de la semaine avec la date de reprise prévisionnelle (jamais le motif de l'absence) ;
//   • les personnes présentes sans affectation ; les travaux planifiés sans personne.
//
// Jours : lundi à vendredi ; le samedi n'est ajouté que s'il contient des créneaux (samedi exceptionnel).

const { getSupabase } = require('./lib/supabaseclient');
const { purgerObsoletes } = require('./lib/obsoletes');

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PAGE = 1000;
const HORIZON_JOURS = 200;                       // au-delà : « fin inconnue » (180 jours posés par gerer-disponibilite)
const STATUTS_ABSENCE = ['absent', 'en arrêt'];

const ajoute = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const jourSemaine = (iso) => new Date(iso + 'T12:00:00Z').getUTCDay();     // 0 = dimanche
const estOuvre = (iso) => { const j = jourSemaine(iso); return j !== 0 && j !== 6; };
const lundiDe = (iso) => ajoute(iso, -((jourSemaine(iso) + 6) % 7));
const suivantOuvre = (iso) => { let d = ajoute(iso, 1); while (!estOuvre(d)) d = ajoute(d, 1); return d; };
const sansCode = (nom) => String(nom || '').replace(/\s*\(.*\)$/, '').trim();

// Lecture page par page (PostgREST plafonne à 1000 lignes par requête).
async function toutLire(fabrique) {
  const lignes = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await fabrique().range(debut, debut + PAGE - 1);
    if (error) throw error;
    lignes.push(...(data || []));
    if (!data || data.length < PAGE) break;
    if (debut > 50 * PAGE) break;                // garde-fou
  }
  return lignes;
}

// Périodes d'absence (jours ouvrés consécutifs) qui touchent la semaine, avec date de reprise prévisionnelle.
function periodesAbsence(jours, indispos, finInconnue, limite) {
  const periodes = [];
  let couvert = null;
  for (const jour of jours) {
    if (!indispos.has(jour) || (couvert && jour <= couvert)) continue;
    let dernier = jour;
    for (let i = 0; i < 400; i++) { const n = suivantOuvre(dernier); if (indispos.has(n)) dernier = n; else break; }
    const inconnue = dernier >= limite || [...finInconnue].some((j) => j >= jour && j <= dernier);
    periodes.push({ du: jour, au: dernier, reprise: inconnue ? null : suivantOuvre(dernier), reprise_inconnue: inconnue });
    couvert = dernier;
  }
  return periodes;
}

const handlerProtege = async (event) => {
  try {
    const date = (event.queryStringParameters || {}).date;
    if (!ISO.test(date || '')) return { statusCode: 400, body: JSON.stringify({ error: 'Paramètre date (AAAA-MM-JJ) requis.' }) };
    const lundi = lundiDe(date);
    const samedi = ajoute(lundi, 5);
    const limite = ajoute(lundi, HORIZON_JOURS);
    const supabase = getSupabase();
    await purgerObsoletes(supabase);   // créneaux restants d'étapes déjà terminées

    const [personnel, planning, dispos] = await Promise.all([
      toutLire(() => supabase.from('personnel').select('id, nom, poste').eq('actif', true).order('nom').order('id')),
      toutLire(() => supabase.from('planning_jour')
        .select('id, date, heure_debut, heure_fin, phase, machine_id, personnel_id, of_id, operation_id, machines(code, nom), operations(nom), ordres_fabrication(numero, quantite, titres(nom, client)), planning_jour_personnel(personnel_id)')
        .gte('date', lundi).lte('date', samedi).order('date').order('id')),
      toutLire(() => supabase.from('personnel_planning_jour').select('personnel_id, date, statut, commentaire').gte('date', lundi).lte('date', limite).order('date').order('personnel_id')),
    ]);

    const parId = Object.fromEntries(personnel.map((p) => [p.id, p]));
    const creneaux = planning.map((c) => {
      const of = c.ordres_fabrication || {};
      const ids = (c.planning_jour_personnel || []).map((l) => l.personnel_id);
      const personnel_ids = Array.from(new Set([...(c.personnel_id ? [c.personnel_id] : []), ...ids]));
      return {
        date: c.date,
        of: of.numero || '',
        titre: (of.titres && of.titres.nom) || '',
        client: (of.titres && of.titres.client) || '',
        quantite: of.quantite ?? null,
        operation: (c.operations && c.operations.nom) || c.phase || '',
        phase: c.phase || '',
        machine: c.machines ? sansCode(c.machines.nom) : '',
        personnel_ids,
      };
    });

    // Jours affichés : lundi → vendredi (+ samedi seulement s'il est planifié).
    const jours = [0, 1, 2, 3, 4].map((i) => ajoute(lundi, i));
    if (creneaux.some((c) => c.date === samedi)) jours.push(samedi);

    // Indisponibilités (jours entiers) par personne.
    const indispos = {}, finInconnue = {};
    dispos.forEach((d) => {
      if (!STATUTS_ABSENCE.includes(d.statut)) return;
      (indispos[d.personnel_id] = indispos[d.personnel_id] || new Set()).add(d.date);
      if (/fin inconnue/i.test(d.commentaire || '')) (finInconnue[d.personnel_id] = finInconnue[d.personnel_id] || new Set()).add(d.date);
    });

    // Travaux par personne et par jour : un « travail » = un OF (ou un travail hors OF), avec ses machines.
    const travaux = {};   // personnel_id -> date -> Map(cle -> travail)
    const sansPersonnel = new Map();
    creneaux.forEach((c) => {
      const cle = c.of || `libre:${c.phase || c.operation}`;
      const titre = c.titre || (c.of ? '' : (c.phase || c.operation));
      const ajouter = (m) => {
        let t = m.get(cle);
        if (!t) { t = { cle, titre, of: c.of, client: c.client, quantite: c.quantite, machines: new Set(), operations: new Set(), libre: !c.of }; m.set(cle, t); }
        if (c.machine) t.machines.add(c.machine);
        if (c.operation) t.operations.add(c.operation);
      };
      if (!c.personnel_ids.length) { ajouter(sansPersonnel.has(c.date) ? sansPersonnel.get(c.date) : sansPersonnel.set(c.date, new Map()).get(c.date)); return; }
      c.personnel_ids.forEach((pid) => {
        if (!parId[pid]) return;
        const jp = (travaux[pid] = travaux[pid] || {});
        ajouter(jp[c.date] = jp[c.date] || new Map());
      });
    });
    const sortie = (t) => ({ cle: t.cle, titre: t.titre, of: t.of, client: t.client, quantite: t.quantite, machines: [...t.machines], operations: [...t.operations], libre: t.libre });

    const personnes = personnel.filter((p) => travaux[p.id]).map((p) => ({
      id: p.id, nom: p.nom, poste: p.poste || '',
      jours: Object.fromEntries(jours.map((j) => [j, {
        absent: !!(indispos[p.id] && indispos[p.id].has(j)),
        travaux: travaux[p.id][j] ? [...travaux[p.id][j].values()].map(sortie) : [],
      }])),
    }));

    // Absents de la semaine : périodes + reprise prévisionnelle (aucun motif).
    const absents = [];
    personnel.forEach((p) => {
      if (!indispos[p.id]) return;
      const dansSemaine = jours.filter((j) => estOuvre(j) && indispos[p.id].has(j));
      if (!dansSemaine.length) return;
      periodesAbsence(dansSemaine, indispos[p.id], finInconnue[p.id] || new Set(), limite).forEach((per) => absents.push({ nom: p.nom, poste: p.poste || '', ...per }));
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        semaine: { debut: lundi, fin: jours[jours.length - 1] },
        jours,
        personnes,
        absents,
        sans_affectation: personnel.filter((p) => !travaux[p.id] && !(indispos[p.id] && jours.some((j) => estOuvre(j) && indispos[p.id].has(j)))).map((p) => ({ nom: p.nom, poste: p.poste || '' })),
        sans_personnel: [...sansPersonnel.entries()].sort((a, b) => a[0].localeCompare(b[0])).flatMap(([jour, m]) => [...m.values()].map((t) => ({ jour, ...sortie(t) }))),
        nb_creneaux: creneaux.length,
      }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message || String(e) }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
