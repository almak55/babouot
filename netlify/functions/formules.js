// lib/formules.js
//
// Évaluateur de formules pour les temps standards. Écrit à la main (aucun
// `eval`, aucun `Function`) : une formule ne peut faire que du calcul sur
// les valeurs qu'on lui fournit, rien d'autre.
//
// Syntaxe (à la française, proche d'Excel) :
//   nombres      0,5   0.75   1200
//   texte        "couché"   'offset'
//   variables    largeur_mm   quantite   (sans accent ni espace ; casse indifférente)
//   opérateurs   +  -  *  /  %        comparaisons  ==  !=  <  <=  >  >=
//   logique      et  ou  non  (ou  &&  ||  !)       vrai  faux
//   fonctions    si(condition; si_vrai; si_faux)
//                min(a; b; ...)  max(a; b; ...)  abs(x)
//                arrondi(x; décimales)  plafond(x; pas)  plancher(x; pas)
// Les arguments se séparent par « ; » (la virgule est réservée aux décimales,
// mais « si(a > 1, 2, 3) » est aussi accepté quand la virgule est suivie d'un espace).
// Les comparaisons de texte ignorent la casse et les accents.
// Le résultat est une durée en HEURES (nombre positif ou nul).

class FormuleErreur extends Error {}

const LONGUEUR_MAX = 600;
const PROFONDEUR_MAX = 40;

const FONCTIONS = {
  si: { min: 3, max: 3 },
  min: { min: 1, max: Infinity },
  max: { min: 1, max: Infinity },
  abs: { min: 1, max: 1 },
  arrondi: { min: 1, max: 2 },
  plafond: { min: 1, max: 2 },
  plancher: { min: 1, max: 2 },
};
const MOTS_CLES = ['vrai', 'faux', 'et', 'ou', 'non'];
const RESERVES = new Set([...Object.keys(FONCTIONS), ...MOTS_CLES]);

// minuscules, sans accents, espaces rognés
const normaliser = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// ---------- Analyse lexicale ----------
function lire(src) {
  const jetons = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }

    let m = /^\d+(?:[.,]\d+)?/.exec(src.slice(i));
    if (m) { jetons.push({ t: 'nombre', v: parseFloat(m[0].replace(',', '.')), pos: i }); i += m[0].length; continue; }

    if (c === '"' || c === "'") {
      const fin = src.indexOf(c, i + 1);
      if (fin === -1) throw new FormuleErreur(`Texte non fermé à partir du caractère ${i + 1}.`);
      jetons.push({ t: 'chaine', v: src.slice(i + 1, fin), pos: i });
      i = fin + 1; continue;
    }

    m = /^[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_]*/.exec(src.slice(i));
    if (m) {
      const nom = normaliser(m[0]);
      jetons.push({ t: MOTS_CLES.includes(nom) ? 'mot' : 'id', v: nom, brut: m[0], pos: i });
      i += m[0].length; continue;
    }

    const deux = src.slice(i, i + 2);
    if (['==', '!=', '<>', '<=', '>=', '&&', '||'].includes(deux)) { jetons.push({ t: 'op', v: deux === '<>' ? '!=' : deux, pos: i }); i += 2; continue; }
    if ('+-*/%()<>=!;,'.includes(c)) { jetons.push({ t: 'op', v: c === '=' ? '==' : c, pos: i }); i++; continue; }

    throw new FormuleErreur(`Caractère « ${c} » non reconnu (position ${i + 1}).`);
  }
  return jetons;
}

// ---------- Analyse syntaxique (descente récursive) ----------
function construire(jetons) {
  let p = 0;
  let profondeur = 0;
  const courant = () => jetons[p];
  const estOp = (v) => courant() && courant().t === 'op' && courant().v === v;
  const estMot = (v) => courant() && courant().t === 'mot' && courant().v === v;
  const entrer = () => { if (++profondeur > PROFONDEUR_MAX) throw new FormuleErreur('Formule trop imbriquée.'); };
  const sortir = () => { profondeur--; };
  const attendu = (quoi) => { throw new FormuleErreur(`On attendait ${quoi}${courant() ? ` avant « ${courant().brut ?? courant().v} » (position ${courant().pos + 1})` : ' en fin de formule'}.`); };

  function ou() {
    entrer();
    let a = et();
    while (estMot('ou') || estOp('||')) { p++; a = { k: 'bin', op: 'ou', a, b: et() }; }
    sortir(); return a;
  }
  function et() {
    let a = non();
    while (estMot('et') || estOp('&&')) { p++; a = { k: 'bin', op: 'et', a, b: non() }; }
    return a;
  }
  function non() {
    if (estMot('non') || estOp('!')) { p++; entrer(); const a = non(); sortir(); return { k: 'un', op: 'non', a }; }
    return comparaison();
  }
  function comparaison() {
    const a = addition();
    const t = courant();
    if (t && t.t === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(t.v)) {
      p++;
      const b = addition();
      const suivant = courant();
      if (suivant && suivant.t === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(suivant.v)) {
        throw new FormuleErreur('Plusieurs comparaisons à la suite : utilisez « et » / « ou » (ex. a > 1 et a < 5).');
      }
      return { k: 'bin', op: t.v, a, b };
    }
    return a;
  }
  function addition() {
    let a = multiplication();
    while (estOp('+') || estOp('-')) { const op = courant().v; p++; a = { k: 'bin', op, a, b: multiplication() }; }
    return a;
  }
  function multiplication() {
    let a = unaire();
    while (estOp('*') || estOp('/') || estOp('%')) { const op = courant().v; p++; a = { k: 'bin', op, a, b: unaire() }; }
    return a;
  }
  function unaire() {
    if (estOp('-') || estOp('+')) { const op = courant().v; p++; entrer(); const a = unaire(); sortir(); return op === '-' ? { k: 'un', op: 'neg', a } : a; }
    return primaire();
  }
  function primaire() {
    const t = courant();
    if (!t) attendu('une valeur');
    if (t.t === 'nombre') { p++; return { k: 'num', v: t.v }; }
    if (t.t === 'chaine') { p++; return { k: 'str', v: t.v }; }
    if (t.t === 'mot' && (t.v === 'vrai' || t.v === 'faux')) { p++; return { k: 'bool', v: t.v === 'vrai' }; }
    if (t.t === 'op' && t.v === '(') {
      p++; const e = ou();
      if (!estOp(')')) attendu('une parenthèse fermante « ) »');
      p++; return e;
    }
    if (t.t === 'id') {
      p++;
      if (estOp('(')) {
        const f = FONCTIONS[t.v];
        if (!f) throw new FormuleErreur(`Fonction inconnue : « ${t.brut} » (fonctions disponibles : ${Object.keys(FONCTIONS).join(', ')}).`);
        p++;
        const args = [];
        if (!estOp(')')) {
          for (;;) {
            args.push(ou());
            if (estOp(';') || estOp(',')) { p++; continue; }
            break;
          }
        }
        if (!estOp(')')) attendu('une parenthèse fermante « ) »');
        p++;
        if (args.length < f.min || args.length > f.max) {
          throw new FormuleErreur(`« ${t.brut} » attend ${f.min === f.max ? f.min : f.max === Infinity ? `au moins ${f.min}` : `${f.min} à ${f.max}`} argument(s), ${args.length} fourni(s).`);
        }
        return { k: 'call', nom: t.v, args };
      }
      return { k: 'var', nom: t.v };
    }
    throw new FormuleErreur(`« ${t.brut ?? t.v} » inattendu (position ${t.pos + 1}).`);
  }

  const racine = ou();
  if (p < jetons.length) {
    const t = jetons[p];
    throw new FormuleErreur(`« ${t.brut ?? t.v} » inattendu (position ${t.pos + 1}).`);
  }
  return racine;
}

function variablesDe(ast) {
  const vues = [];
  (function parcourir(n) {
    if (n.k === 'var') { if (!vues.includes(n.nom)) vues.push(n.nom); }
    else if (n.k === 'un') parcourir(n.a);
    else if (n.k === 'bin') { parcourir(n.a); parcourir(n.b); }
    else if (n.k === 'call') n.args.forEach(parcourir);
  })(ast);
  return vues;
}

// Retourne { ok, ast, variables } ou { ok:false, erreur }.
function analyser(formule) {
  try {
    const src = String(formule ?? '');
    if (!src.trim()) throw new FormuleErreur('La formule est vide.');
    if (src.length > LONGUEUR_MAX) throw new FormuleErreur(`Formule trop longue (${LONGUEUR_MAX} caractères maximum).`);
    const ast = construire(lire(src));
    return { ok: true, ast, variables: variablesDe(ast) };
  } catch (e) {
    if (e instanceof FormuleErreur) return { ok: false, erreur: e.message };
    throw e;
  }
}

// ---------- Évaluation ----------
const estNombre = (x) => typeof x === 'number';
const verifNombre = (x, ou_) => { if (!estNombre(x)) throw new FormuleErreur(`${ou_} : un nombre est attendu (reçu : ${typeof x === 'string' ? `le texte « ${x} »` : 'une valeur logique'}).`); return x; };
const vrai = (x) => (typeof x === 'boolean' ? x : estNombre(x) ? x !== 0 : (() => { throw new FormuleErreur('Une condition doit être une comparaison ou un nombre, pas un texte.'); })());
const pas = (x, nom) => { if (!(x > 0)) throw new FormuleErreur(`${nom} : le pas doit être strictement positif.`); return x; };

function evalNoeud(n, valeurs) {
  switch (n.k) {
    case 'num': case 'str': case 'bool': return n.v;
    case 'var': return valeurs[n.nom];
    case 'un': {
      const a = evalNoeud(n.a, valeurs);
      return n.op === 'non' ? !vrai(a) : -verifNombre(a, 'Signe moins');
    }
    case 'bin': {
      if (n.op === 'et') return vrai(evalNoeud(n.a, valeurs)) && vrai(evalNoeud(n.b, valeurs));
      if (n.op === 'ou') return vrai(evalNoeud(n.a, valeurs)) || vrai(evalNoeud(n.b, valeurs));
      const a = evalNoeud(n.a, valeurs); const b = evalNoeud(n.b, valeurs);
      if (['==', '!='].includes(n.op)) {
        if (typeof a !== typeof b) throw new FormuleErreur('Comparaison entre un nombre et un texte : vérifiez le type de la caractéristique.');
        const egal = typeof a === 'string' ? normaliser(a) === normaliser(b) : a === b;
        return n.op === '==' ? egal : !egal;
      }
      if (['<', '<=', '>', '>='].includes(n.op)) {
        verifNombre(a, 'Comparaison'); verifNombre(b, 'Comparaison');
        return n.op === '<' ? a < b : n.op === '<=' ? a <= b : n.op === '>' ? a > b : a >= b;
      }
      verifNombre(a, `Opérateur « ${n.op} »`); verifNombre(b, `Opérateur « ${n.op} »`);
      if (n.op === '+') return a + b;
      if (n.op === '-') return a - b;
      if (n.op === '*') return a * b;
      if (b === 0) throw new FormuleErreur('Division par zéro.');
      return n.op === '/' ? a / b : a % b;
    }
    case 'call': {
      if (n.nom === 'si') return vrai(evalNoeud(n.args[0], valeurs)) ? evalNoeud(n.args[1], valeurs) : evalNoeud(n.args[2], valeurs);
      const v = n.args.map((x) => verifNombre(evalNoeud(x, valeurs), `Fonction « ${n.nom} »`));
      if (n.nom === 'min') return Math.min(...v);
      if (n.nom === 'max') return Math.max(...v);
      if (n.nom === 'abs') return Math.abs(v[0]);
      if (n.nom === 'arrondi') {
        const d = v.length > 1 ? Math.round(v[1]) : 0; const k = 10 ** d;
        return Math.round((v[0] + Number.EPSILON) * k) / k;
      }
      const p = v.length > 1 ? pas(v[1], n.nom) : 1;
      return n.nom === 'plafond' ? Math.ceil(v[0] / p - 1e-9) * p : Math.floor(v[0] / p + 1e-9) * p;
    }
    default: throw new FormuleErreur('Formule invalide.');
  }
}

// Évalue `formule` avec `valeurs` ({ variable: valeur }).
//   types : { variable: 'nombre' | 'texte' } (optionnel ; sinon déduit de la valeur)
// Retour :
//   { ok:true, valeur, variables, manquantes: [] }               calcul fait
//   { ok:true, valeur:null, variables, manquantes:[...] }        valeurs à fournir
//   { ok:false, erreur }                                         formule ou valeur invalide
function evaluer(formule, valeurs = {}, types = {}) {
  const a = analyser(formule);
  if (!a.ok) return { ok: false, erreur: a.erreur };

  const propres = Object.create(null);
  const manquantes = [];
  try {
    a.variables.forEach((nom) => {
      const brut = Object.prototype.hasOwnProperty.call(valeurs, nom) ? valeurs[nom] : undefined;
      if (brut === undefined || brut === null || String(brut).trim() === '') { manquantes.push(nom); return; }
      const type = types[nom];
      const nb = typeof brut === 'number' ? brut : Number(String(brut).trim().replace(',', '.'));
      if (type === 'texte') propres[nom] = String(brut).trim();
      else if (type === 'nombre') {
        if (!Number.isFinite(nb)) throw new FormuleErreur(`La valeur de « ${nom} » n'est pas un nombre : « ${brut} ».`);
        propres[nom] = nb;
      } else propres[nom] = Number.isFinite(nb) && String(brut).trim() !== '' && typeof brut !== 'boolean' ? nb : String(brut).trim();
    });
    if (manquantes.length) return { ok: true, valeur: null, variables: a.variables, manquantes };

    const r = evalNoeud(a.ast, propres);
    if (!estNombre(r)) throw new FormuleErreur(`La formule doit donner un nombre d'heures (elle donne ${typeof r === 'string' ? 'un texte' : 'une valeur logique'}).`);
    if (!Number.isFinite(r)) throw new FormuleErreur('Résultat non fini.');
    if (r < 0) throw new FormuleErreur(`Résultat négatif (${Math.round(r * 1000) / 1000} h) : vérifiez la formule.`);
    return { ok: true, valeur: r, variables: a.variables, manquantes: [] };
  } catch (e) {
    if (e instanceof FormuleErreur) return { ok: false, erreur: e.message, variables: a.variables };
    throw e;
  }
}

module.exports = { analyser, evaluer, normaliser, RESERVES, FONCTIONS, FormuleErreur };
