// lib/en-ligne.js
//
// Opérations « en ligne » : deux opérations qui tournent en même temps, la seconde alimentée
// ou contrôlée au fil de la première (ex. pressure en colle -> massicot trilame -> coloris tête ;
// pose de signets -> emboîtage Kolbus ; contrôle couvertures pendant le montage).
//
// Règle : l'opération « en ligne » démarre avec son prédécesseur (son réglage se fait en parallèle),
// puis sa PRODUCTION (hors mise en route, réglage et nettoyage) a la même durée et se déroule dans la
// même fenêtre que la production du prédécesseur. Le nettoyage vient après.
//
// Les couples sont déclarés dans la table liaisons_en_ligne (operation_code, avec_operation_code).
// Un lien précis d'un OF peut forcer ou annuler la règle : dependances[seq].en_ligne = true | false.

// Type d'une phase d'après son nom : 'reglage' | 'nettoyage' | 'production'.
function typePhase(nom) {
  const n = String(nom || '');
  if (/nettoy/i.test(n)) return 'nettoyage';
  if (/mise en route|r[ée]glage|\bMER\b|calage/i.test(n)) return 'reglage';
  return 'production';
}

// Identité d'une opération pour les règles : son code « de base » (accents/casse neutralisés, suffixes _PLEIADE /
// _CARTONNES retirés) ET son nom nettoyé (sans « de », « pléiade », « cartonnés », pluriels ignorés, mots triés).
// Ainsi « Montage couverture Pléiade » est reconnu comme « Montage de couverture », quel que soit son code.
const sansAccents = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const baseCode = (c) => sansAccents(c).toUpperCase().replace(/_(PLEIADE|CARTONNES?)(?=_|$)/g, '');
const cleNom = (nom) => sansAccents(nom).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
  .filter((m) => m && !['de', 'des', 'du', 'la', 'le', 'les', 'd', 'et', 'en', 'pleiade', 'cartonne', 'cartonnes'].includes(m))
  .map((m) => m.replace(/s$/, '')).sort().join(' ');

class Regles extends Set {
  constructor() { super(); this.noms = new Map(); }
  // Clés d'identité d'un code d'opération (nom connu par la table operations).
  cles(code) {
    const ks = [baseCode(code)];
    const n = this.noms.get(code);
    if (n) { const c = cleNom(n); if (c) ks.push('N:' + c); }
    return ks;
  }
  has(cle) {
    if (super.has(cle)) return true;
    const [a, b] = String(cle).split('|');
    const ka = this.cles(a), kb = this.cles(b);
    return ka.some((x) => kb.some((y) => super.has(`${x}|${y}`)));
  }
}

// Ensemble des couples "OPERATION|PREDECESSEUR". Table absente (migration 34 pas encore exécutée) : aucun couple.
async function chargerRegles(supabase) {
  const r = new Regles();
  try {
    const [liens, ops] = await Promise.all([
      supabase.from('liaisons_en_ligne').select('operation_code, avec_operation_code'),
      supabase.from('operations').select('code, nom'),
    ]);
    if (!ops.error) (ops.data || []).forEach((o) => r.noms.set(o.code, o.nom));
    if (liens.error) return r;
    (liens.data || []).forEach((x) => {
      r.add(`${x.operation_code}|${x.avec_operation_code}`);
      r.cles(x.operation_code).forEach((ka) => r.cles(x.avec_operation_code).forEach((kb) => r.add(`${ka}|${kb}`)));
    });
  } catch (_) { /* aucune règle */ }
  return r;
}

function estEnLigne(regles, opCode, opPredCode, lien) {
  if (lien && lien.en_ligne === false) return false;
  if (lien && lien.en_ligne === true) return true;
  return regles.has(`${opCode}|${opPredCode}`);
}

const somme = (phases, type) => phases.filter((p) => typePhase(p.nom) === type).reduce((t, p) => t + (Number(p.duree_h) || 0), 0);
const arrondi = (x) => Math.round(x * 100) / 100;

// Marque les étapes en ligne et aligne la durée de leur production sur celle de leur prédécesseur.
// `etapes` : résultat de calculerEtapes (un prédécesseur de numéro inférieur est traité avant).
function appliquerEnLigne(etapes, regles) {
  if (!regles || !regles.size) {
    // Seuls les liens forcés (en_ligne: true) restent possibles : on continue sans court-circuiter.
  }
  const tri = etapes.slice().sort((a, b) => a.sequence - b.sequence);
  const parSeq = new Map(tri.map((e) => [e.sequence, e]));
  tri.forEach((e, i) => {
    const preds = Array.isArray(e.predecesseurs) ? e.predecesseurs : (i > 0 ? [tri[i - 1].sequence] : []);
    const enLigne = preds.map((s) => parSeq.get(s)).filter((p) => p && estEnLigne(regles || new Set(), e.operation_code, p.operation_code, (e.dependances || {})[p.sequence]));
    if (!enLigne.length) return;
    e.en_ligne = enLigne.map((p) => ({ sequence: p.sequence, operation: p.operation }));
    if (e.duree_manuelle_h !== null && e.duree_manuelle_h !== undefined) return;   // durée saisie à la main : prioritaire
    const ref = enLigne.slice().sort((a, b) => somme(b.phases, 'production') - somme(a.phases, 'production'))[0];
    const prodRef = somme(ref.phases, 'production');
    const prodMoi = somme(e.phases, 'production');
    if (!(prodRef > 0) || !(prodMoi > 0) || !e.phases.length) return;
    const k = prodRef / prodMoi;
    e.phases.forEach((p) => {
      if (typePhase(p.nom) !== 'production') return;
      p.duree_h = arrondi(p.duree_h * k);
      p.detail = `en ligne avec « ${ref.operation} » : ${arrondi(prodRef)} h de production`;
    });
    const total = e.phases.reduce((s, p) => s + p.duree_h, 0);
    e.total_h = arrondi(total);
    e.heures_machine = arrondi(e.phases.filter((p) => p.occupe_machine).reduce((s, p) => s + p.duree_h, 0));
    e.heures_personnes = arrondi(e.phases.reduce((s, p) => s + p.duree_h * p.nb_personnes, 0));
  });
}

module.exports = { typePhase, chargerRegles, estEnLigne, appliquerEnLigne, baseCode, cleNom };
