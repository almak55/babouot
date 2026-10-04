// lib/excel-standards.js
//
// Export / import Excel des temps standards (phases) et des caractéristiques
// produit. Les règles de validation sont EXACTEMENT celles de l'écran de saisie
// (lib/phases.js) : un fichier ne peut pas faire entrer ce que l'écran refuserait.
//
// Fichier (feuilles) :
//   « Phases »          Opération | Machine | Ordre | Phase | Mode | Durée (h) |
//                       Ce que l'on compte | Cadence (/h) | Formule (heures) |
//                       Personnes | Occupe la machine
//   « Caractéristiques » Clé | Libellé | Type | Unité
//   « Aide » et « Listes » : explications et listes de référence (ignorées à l'import)
// Une ligne dont la 1re cellule commence par # est un commentaire (ignorée).
// Une phase est identifiée par (opération, machine, nom de phase) : si elle existe
// déjà elle est mise à jour, sinon créée.

const XLSX = require('xlsx');
const { normaliser } = require('./formules');
const { cleParam, verifierCle, valider } = require('./phases');

const ENTETES_PHASES = ['Opération', 'Machine', 'Ordre', 'Phase', 'Mode', 'Durée (h)', 'Ce que l\'on compte', 'Cadence (/h)', 'Formule (heures)', 'Personnes', 'Occupe la machine'];
const ENTETES_CARAC = ['Clé', 'Libellé', 'Type', 'Unité'];

const LIBELLE_MODE = { fixe: 'forfait', par_element: 'durée × nombre', cadence: 'cadence', formule: 'formule' };

// ---------- Export ----------
function construireClasseur({ phases, operations, machines, caracteristiques }) {
  const wb = XLSX.utils.book_new();

  const lignes = phases.map((p) => [
    p.operations.nom, p.machines ? p.machines.nom : '', p.ordre, p.nom, LIBELLE_MODE[p.type_calcul],
    p.type_calcul === 'fixe' || p.type_calcul === 'par_element' ? Number(p.duree_h) : '',
    p.element_label || '', p.cadence_par_h !== null && p.cadence_par_h !== undefined ? Number(p.cadence_par_h) : '',
    p.formule || '', p.nb_personnes, p.occupe_machine ? 'oui' : 'non',
  ]);
  const exemples = lignes.length ? [] : [
    ['# EXEMPLE (cette ligne est ignorée) — remplacez par vos opérations et machines', '', '', '', '', '', '', '', '', '', ''],
    ['# Plieuse', '# MBO', 1, '# Mise en route', 'forfait', 0.5, '', '', '', 1, 'oui'],
    ['# Plieuse', '# MBO', 2, '# Réglage de format', 'formule', '', '', '', '0,25 + 0,001 * largeur_mm', 1, 'oui'],
    ['# Plieuse', '# MBO', 3, '# Roulage', 'formule', '', '', '', 'quantite / si(grammage_g > 150; 6000; 9000)', 2, 'oui'],
  ];
  const wsPhases = XLSX.utils.aoa_to_sheet([ENTETES_PHASES, ...lignes, ...exemples]);
  wsPhases['!cols'] = [28, 22, 7, 28, 16, 10, 22, 12, 50, 10, 16].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsPhases, 'Phases');

  const wsCarac = XLSX.utils.aoa_to_sheet([ENTETES_CARAC, ...caracteristiques.map((c) => [c.cle, c.libelle, c.type, c.unite || ''])]);
  wsCarac['!cols'] = [22, 34, 10, 10].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, wsCarac, 'Caractéristiques');

  const aide = [
    ['Comment remplir ce fichier'],
    [''],
    ['Une ligne = une phase d\'une opération (mise en route, réglage, roulage, nettoyage…).'],
    ['Machine : laissez vide pour le STANDARD de l\'opération (toutes machines) ; sinon le nom exact de la machine (ses réglages remplacent le standard).'],
    ['Mode « forfait » : renseignez « Durée (h) » (ex. 0,5 pour 30 min).'],
    ['Mode « durée × nombre » : « Durée (h) » pour UN élément et « Ce que l\'on compte » (ex. Nombre de fers).'],
    ['Mode « cadence » : renseignez « Cadence (/h) » (unités par heure) ; durée = quantité ÷ cadence.'],
    ['Mode « formule » : renseignez « Formule (heures) » ; le résultat est en HEURES.'],
    ['   Opérateurs : + - * / %   Comparaisons : == != < <= > >=   Logique : et ou non   Texte entre guillemets.'],
    ['   Fonctions : si(condition; si_vrai; si_faux)  min(a; b)  max(a; b)  abs(x)  arrondi(x; décimales)  plafond(x; pas)  plancher(x; pas)'],
    ['   Variables : « quantite » (nombre d\'exemplaires) et les clés de la feuille « Caractéristiques » (ex. largeur_mm, grammage_g).'],
    ['   Exemples : 0,5 + 0,002 * largeur_mm      si(largeur_mm > 300; 1; 0,75)      quantite / si(grammage_g > 150; 6000; 9000)'],
    ['Personnes : nombre de personnes requises. Occupe la machine : oui / non (ex. le traçage des fers n\'occupe pas la machine).'],
    ['Les opérations et machines doivent déjà exister dans l\'application (voir la feuille « Listes »).'],
    ['Une ligne dont la première cellule commence par # est ignorée (commentaire).'],
    ['À l\'import, une phase déjà connue (même opération, machine et nom) est mise à jour ; sinon elle est créée. Rien n\'est jamais supprimé.'],
  ];
  const wsAide = XLSX.utils.aoa_to_sheet(aide);
  wsAide['!cols'] = [{ wch: 150 }];
  XLSX.utils.book_append_sheet(wb, wsAide, 'Aide');

  const n = Math.max(operations.length, machines.length);
  const listes = [['Opérations', 'Machines']];
  for (let i = 0; i < n; i++) listes.push([operations[i] ? operations[i].nom : '', machines[i] ? machines[i].nom : '']);
  const wsListes = XLSX.utils.aoa_to_sheet(listes);
  wsListes['!cols'] = [{ wch: 34 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, wsListes, 'Listes');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ---------- Lecture ----------
const nettoye = (s) => normaliser(s).replace(/[^a-z0-9]+/g, ' ').trim();
const SYNONYMES = {
  operation: ['operation'], machine: ['machine'], ordre: ['ordre'], phase: ['phase', 'nom'], mode: ['mode', 'calcul'],
  duree: ['duree h', 'duree'], compte: ['ce que l on compte', 'compte', 'element'], cadence: ['cadence h', 'cadence'],
  formule: ['formule heures', 'formule'], personnes: ['personnes', 'nb personnes'], occupe: ['occupe la machine', 'occupe machine'],
  cle: ['cle'], libelle: ['libelle'], type: ['type'], unite: ['unite'],
};

function colonnes(entete) {
  const idx = {};
  entete.forEach((h, i) => { const n = nettoye(h); Object.entries(SYNONYMES).forEach(([k, noms]) => { if (noms.includes(n) && idx[k] === undefined) idx[k] = i; }); });
  return idx;
}

function lireFeuille(wb, nomsPossibles) {
  const nom = wb.SheetNames.find((n) => nomsPossibles.includes(nettoye(n)));
  if (!nom) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[nom], { header: 1, defval: '', raw: true });
}

// Retourne { phases: [{ligne, ...champs}], caracteristiques: [...], erreurs: [] }
function lireClasseur(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sortie = { phases: [], caracteristiques: [], erreurs: [] };

  const fp = lireFeuille(wb, ['phases']);
  if (!fp) sortie.erreurs.push('Feuille « Phases » introuvable.');
  else {
    const idx = colonnes(fp[0] || []);
    const manquantes = ['operation', 'phase', 'mode'].filter((k) => idx[k] === undefined);
    if (manquantes.length) sortie.erreurs.push(`Colonnes obligatoires absentes de « Phases » : ${manquantes.join(', ')}.`);
    else {
      fp.slice(1).forEach((row, i) => {
        const get = (k) => (idx[k] === undefined ? '' : row[idx[k]]);
        const vide = row.every((c) => String(c).trim() === '');
        const premier = String(row[0] ?? '').trim();
        if (vide || premier.startsWith('#')) return;
        sortie.phases.push({ ligne: i + 2, operation: get('operation'), machine: get('machine'), ordre: get('ordre'), nom: get('phase'), mode: get('mode'),
          duree: get('duree'), compte: get('compte'), cadence: get('cadence'), formule: get('formule'), personnes: get('personnes'), occupe: get('occupe') });
      });
    }
  }

  const fc = lireFeuille(wb, ['caracteristiques']);
  if (fc) {
    const idx = colonnes(fc[0] || []);
    fc.slice(1).forEach((row, i) => {
      const get = (k) => (idx[k] === undefined ? '' : row[idx[k]]);
      if (row.every((c) => String(c).trim() === '') || String(row[0] ?? '').trim().startsWith('#')) return;
      sortie.caracteristiques.push({ ligne: i + 2, cle: get('cle'), libelle: get('libelle'), type: get('type'), unite: get('unite') });
    });
  }
  return sortie;
}

// ---------- Analyse (validation sans rien écrire) ----------
const MODES = { forfait: 'fixe', fixe: 'fixe', 'duree x nombre': 'par_element', 'par element': 'par_element', 'duree nombre': 'par_element', cadence: 'cadence', formule: 'formule' };
const OUI = ['oui', 'o', 'yes', 'y', '1', 'vrai', 'x', 'true'];
const NON = ['non', 'n', 'no', '0', 'faux', 'false'];

function analyserImport(lu, ref) {
  const { operations, machines, caracteristiques, phases: existantes } = ref;
  const resultat = { phases: [], caracteristiques: [], resume: { creations: 0, mises_a_jour: 0, inchangees: 0, erreurs: 0 } };
  const compter = (statut) => { resultat.resume[{ creation: 'creations', mise_a_jour: 'mises_a_jour', inchangee: 'inchangees', erreur: 'erreurs' }[statut]]++; };

  // ----- Caractéristiques -----
  const cleCat = new Set(caracteristiques.map((c) => c.cle));
  const vuesCar = new Set();
  lu.caracteristiques.forEach((c) => {
    const libelle = String(c.libelle || '').trim();
    let cle = cleParam(c.cle || libelle);
    if (/^[0-9]/.test(cle)) cle = `c_${cle}`;
    const erreur = !libelle ? 'Libellé manquant.' : verifierCle(cle) || (vuesCar.has(cle) ? `Clé « ${cle} » en double dans le fichier.` : null);
    const type = nettoye(c.type) === 'texte' ? 'texte' : 'nombre';
    const connue = caracteristiques.find((x) => x.cle === cle);
    let erreurType = null;
    if (connue && connue.type !== type) erreurType = `Le type de « ${cle} » ne peut pas être changé par import (${connue.type} → ${type}).`;
    const e = erreur || erreurType;
    const statut = e ? 'erreur' : !connue ? 'creation' : (connue.libelle === libelle && (connue.unite || '') === String(c.unite || '').trim() ? 'inchangee' : 'mise_a_jour');
    if (!e) { vuesCar.add(cle); cleCat.add(cle); }
    resultat.caracteristiques.push({ ligne: c.ligne, statut, erreur: e, resume: `${cle} — ${libelle}`, valeurs: e ? null : { cle, libelle, type, unite: String(c.unite || '').trim() || null } });
    compter(statut);
  });

  // ----- Phases -----
  const trouver = (liste, valeur, champs) => {
    const n = nettoye(valeur);
    const trouves = liste.filter((x) => champs.some((ch) => x[ch] && nettoye(x[ch]) === n));
    return trouves.length === 1 ? trouves[0] : trouves.length > 1 ? 'ambigu' : null;
  };
  const vues = new Map();
  lu.phases.forEach((p) => {
    const nomOp = String(p.operation || '').trim(); const nomMachine = String(p.machine || '').trim();
    const resume = `${nomOp || '?'}${nomMachine ? ' / ' + nomMachine : ''} — ${String(p.nom || '').trim() || '?'}`;
    const echec = (message) => { resultat.phases.push({ ligne: p.ligne, statut: 'erreur', erreur: message, resume, valeurs: null }); compter('erreur'); };

    const op = nomOp ? trouver(operations, nomOp, ['nom', 'code']) : null;
    if (!op) return echec(nomOp ? `Opération « ${nomOp} » introuvable dans l'application.` : 'Opération manquante.');
    if (op === 'ambigu') return echec(`Opération « ${nomOp} » ambiguë (plusieurs correspondances).`);
    let machine = null;
    if (nomMachine) {
      machine = trouver(machines, nomMachine, ['nom', 'code']);
      if (!machine) return echec(`Machine « ${nomMachine} » introuvable dans l'application.`);
      if (machine === 'ambigu') return echec(`Machine « ${nomMachine} » ambiguë.`);
    }
    const mode = MODES[nettoye(p.mode)];
    if (!mode) return echec(`Mode « ${p.mode} » inconnu (forfait, durée × nombre, cadence, formule).`);

    let occupe = true;
    if (String(p.occupe).trim() !== '') {
      const o = nettoye(p.occupe);
      if (OUI.includes(o)) occupe = true; else if (NON.includes(o)) occupe = false;
      else return echec(`« Occupe la machine » : « ${p.occupe} » non compris (oui / non).`);
    }
    const corps = { operation_id: op.id, machine_id: machine ? machine.id : null, nom: p.nom, ordre: p.ordre, type_calcul: mode,
      duree_h: p.duree, cadence_par_h: p.cadence, element_label: p.compte, formule: p.formule, nb_personnes: p.personnes, occupe_machine: occupe };
    const { erreur, valeurs } = valider(corps, cleCat);
    if (erreur) return echec(erreur);

    const cle = `${op.id}|${machine ? machine.id : ''}|${nettoye(valeurs.nom)}`;
    if (vues.has(cle)) return echec(`Phase en double dans le fichier (même opération, machine et nom que la ligne ${vues.get(cle)}).`);
    vues.set(cle, p.ligne);

    const existante = existantes.find((x) => `${x.operation_id}|${x.machine_id || ''}|${nettoye(x.nom)}` === cle);
    const champs = ['ordre', 'type_calcul', 'duree_h', 'cadence_par_h', 'element_param', 'element_label', 'formule', 'occupe_machine', 'nb_personnes'];
    const identique = existante && champs.every((ch) => {
      const a = existante[ch] ?? null; const b = valeurs[ch] ?? null;
      return typeof a === 'number' || typeof b === 'number' ? Number(a) === Number(b) : a === b;
    });
    const statut = !existante ? 'creation' : identique ? 'inchangee' : 'mise_a_jour';
    resultat.phases.push({ ligne: p.ligne, statut, erreur: null, resume, valeurs, id: existante ? existante.id : null });
    compter(statut);
  });
  return resultat;
}

module.exports = { construireClasseur, lireClasseur, analyserImport, ENTETES_PHASES, ENTETES_CARAC };
