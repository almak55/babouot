// lib/droits.js
//
// Rôles et droits d'accès. Une PERMISSION = une famille d'actions ; un RÔLE = un ensemble de permissions ;
// chaque fonction Netlify exige une ou plusieurs permissions (REGLES) selon la méthode HTTP (lecture / écriture).
// Le contrôle est fait côté serveur par lib/auth.js ; l'écran ne fait que masquer les boutons correspondants.
//
// Permissions :
//   lire         consulter planning, OF, reporting, machines, personnel…
//   messagerie   écrire dans la messagerie interne
//   ordres       créer / valider / supprimer des OF, importer le planning annuel, générer des OF Pléiade et coffrets
//   planifier    planifier, replanifier, réorganiser, affecter le personnel, déclarer les absences, optimiser
//   production   saisir la production réalisée
//   referentiels temps standards, machines, opérations, personnel, compétences, caractéristiques, modèle de gamme
//   maintenance  interventions et état des machines
//   devis        devis, coûts, tarifs et propositions de délais
//   admin        utilisateurs et rôles

const PERMISSIONS = ['lire', 'messagerie', 'ordres', 'planifier', 'production', 'referentiels', 'maintenance', 'devis', 'admin'];

const ROLES = {
  administrateur: {
    libelle: 'Administrateur',
    description: 'Accès complet, y compris la gestion des utilisateurs et des rôles.',
    permissions: PERMISSIONS.slice(),
  },
  chef_atelier: {
    libelle: "Chef d'atelier",
    description: 'Planification, ordres de fabrication, production, personnel, machines et temps standards. Pas d’accès aux devis, coûts et tarifs.',
    permissions: ['lire', 'messagerie', 'ordres', 'planifier', 'production', 'referentiels', 'maintenance'],
  },
  direction: {
    libelle: 'Direction',
    description: 'Consultation de tout, création et validation des OF, devis, coûts, tarifs et délais. Ne modifie pas le planning.',
    permissions: ['lire', 'messagerie', 'ordres', 'devis'],
  },
  maintenance: {
    libelle: 'Maintenance',
    description: 'Consultation de tout ; interventions et état des machines.',
    permissions: ['lire', 'messagerie', 'maintenance'],
  },
  lecture: {
    libelle: 'Lecture seule',
    description: 'Consultation du planning, des OF et du reporting, sans aucune modification.',
    permissions: ['lire'],
  },
};
const ROLES_VALIDES = Object.keys(ROLES);
const ROLE_PAR_DEFAUT = 'lecture';      // compte créé directement dans Supabase, jamais encore attribué
const TOUTES = (roleId) => (ROLES[roleId] ? ROLES[roleId].permissions : []);

// Règles par fonction. get : permission(s) pour la lecture (GET) ; ecrire : pour POST / PUT / DELETE.
// Une liste = « l'une quelconque ». lectures : valeurs de body.action qui sont des lectures (exigent « get »).
// ecritures : si présent, seules ces valeurs de body.action exigent « ecrire », les autres exigent « get ».
const REGLES = {
  'affecter-planning': { ecrire: 'planifier' },
  'alertes-stock': { get: 'lire', ecrire: 'referentiels' },
  'analyser-fiche': { ecrire: 'ordres' },
  'analyser-fiches-lot': { ecrire: 'ordres' },
  'calculer-devis': { get: 'devis', ecrire: 'devis' },
  'calculer-durees': { get: 'lire', ecrire: ['planifier', 'ordres'] },
  'charge-machine': { get: 'lire' },
  'conflits-absence': { get: 'lire', ecrire: 'planifier' },
  'creer-ordre': { ecrire: 'ordres' },
  'deplanifier-etape': { ecrire: 'planifier' },
  'detail-etape': { get: 'lire' },
  'detection-conflits': { get: 'lire' },
  'dispo-machine': { get: 'lire' },
  'evaluer-formule': { get: 'lire', ecrire: 'lire' },
  'exporter-temps-standards': { get: 'lire' },
  'extraire-production': { ecrire: 'production' },
  'feuille-journaliere': { get: 'lire' },
  'feuille-semaine': { get: 'lire' },
  'gammes-ordre': { get: 'lire' },
  'generer-coffret': { get: 'lire', ecrire: 'ordres', lectures: ['apercu'] },
  'generer-of-pleiade': { get: 'lire', ecrire: 'ordres' },
  'gerer-affectation': { get: 'lire', ecrire: 'planifier' },
  'gerer-caracteristiques': { get: 'lire', ecrire: 'referentiels' },
  'gerer-competences': { get: 'lire', ecrire: 'referentiels' },
  'gerer-couts': { get: 'devis', ecrire: 'devis' },
  'gerer-dependances': { get: 'lire', ecrire: 'referentiels' },
  'gerer-devis': { get: 'devis', ecrire: 'devis' },
  'gerer-disponibilite': { get: 'lire', ecrire: 'planifier' },
  'gerer-en-ligne': { get: 'lire', ecrire: 'referentiels' },
  'gerer-interventions': { get: 'lire', ecrire: 'maintenance' },
  'gerer-machines': { get: 'lire', ecrire: ['referentiels', 'maintenance'] },
  'gerer-operations': { get: 'lire', ecrire: 'referentiels' },
  'gerer-personnel': { get: 'lire', ecrire: 'referentiels' },
  'gerer-pleiade': { get: 'lire', ecrire: 'referentiels' },
  'gerer-temps-standards': { get: 'lire', ecrire: 'referentiels' },
  'gerer-utilisateurs': { get: 'admin', ecrire: 'admin' },
  'importer-planning-annuel': { ecrire: 'ordres' },
  'importer-temps-standards': { ecrire: 'referentiels' },
  'jour-debut-etape': { get: 'lire' },
  'lecture-planning': { get: 'lire' },
  'lecture-production': { get: 'lire' },
  'messagerie': { get: 'lire', ecrire: 'messagerie' },
  'modifier-gamme': { ecrire: ['planifier', 'ordres'] },
  'optimiser-production': { get: 'planifier', ecrire: 'planifier' },
  'ordonnancement': { get: 'lire', ecrire: 'planifier' },
  'planifier-of': { ecrire: 'planifier' },
  'planning-annuel': { get: 'lire', ecrire: 'ordres' },
  'profils-machine': { get: 'lire', ecrire: 'referentiels' },
  'proposer-affectation': { get: 'lire' },
  'proposer-delais': { get: 'lire', ecrire: ['devis', 'planifier', 'ordres'] },
  'rapport-of': { get: 'lire', ecrire: ['ordres', 'planifier'] },
  'rapport-mensuel': { get: 'lire' },
  'recaler-durees': { get: 'lire', ecrire: 'planifier' },
  'referentiels': { get: 'lire' },
  'reorganiser-planning': { get: 'planifier', ecrire: 'planifier' },
  'reporter-retards': { get: 'lire', ecrire: 'planifier' },
  'saisir-production': { get: 'lire', ecrire: 'production' },
  'supprimer-ordre': { ecrire: 'ordres' },
  'temps-libres': { get: 'lire', ecrire: 'planifier' },
  'valider-of': { ecrire: 'ordres' },
  'vue-globale': { get: 'lire' },
};

const LIBELLES_PERMISSIONS = {
  lire: 'consulter', messagerie: 'écrire dans la messagerie', ordres: 'gérer les ordres de fabrication', planifier: 'modifier le planning',
  production: 'saisir la production', referentiels: 'modifier les référentiels (machines, temps standards, personnel…)',
  maintenance: 'gérer la maintenance des machines', devis: 'accéder aux devis, coûts et tarifs', admin: 'administrer les utilisateurs',
};

const enListe = (x) => (Array.isArray(x) ? x : x ? [x] : []);

// Nom de la fonction à partir de l'URL réelle (/.netlify/functions/<nom>).
function nomFonction(event) {
  const chemin = String((event && (event.path || event.rawUrl)) || '').split('?')[0];
  const m = chemin.match(/\/functions\/([a-z0-9-]+)/i);
  return m ? m[1].toLowerCase() : '';
}

// Permission(s) exigée(s) par l'appel (liste « l'une quelconque »).
function exigence(nom, methode, action) {
  const m = String(methode || 'GET').toUpperCase();
  const r = REGLES[nom];
  if (!r) return enListe(m === 'GET' || m === 'HEAD' ? 'lire' : 'planifier');          // fonction inconnue : prudent
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return enListe(r.get || 'lire');
  if (action && enListe(r.lectures).includes(action)) return enListe(r.get || 'lire');
  return enListe(r.ecrire || 'planifier');
}

const estLecture = (nom, methode, action) => {
  const ex = exigence(nom, methode, action);
  return ex.length === 1 && ex[0] === 'lire' ? true : ['GET', 'HEAD', 'OPTIONS'].includes(String(methode || 'GET').toUpperCase());
};

function autorise(roleId, nom, methode, action) {
  const permissions = TOUTES(roleId);
  return exigence(nom, methode, action).some((p) => permissions.includes(p));
}

module.exports = { PERMISSIONS, ROLES, ROLES_VALIDES, ROLE_PAR_DEFAUT, REGLES, LIBELLES_PERMISSIONS, nomFonction, exigence, autorise, estLecture, permissionsDe: TOUTES };
