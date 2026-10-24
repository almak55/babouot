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

// Ensemble des couples "OPERATION|PREDECESSEUR". Table absente (migration 34 pas encore exécutée) : aucun couple.
async function chargerRegles(supabase) {
  try {
    const { data, error } = await supabase.from('liaisons_en_ligne').select('operation_code, avec_operation_code');
    if (error) return new Set();
    return new Set((data || []).map((r) => `${r.operation_code}|${r.avec_operation_code}`));
  } catch (_) { return new Set(); }
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

module.exports = { typePhase, chargerRegles, estEnLigne, appliquerEnLigne };
