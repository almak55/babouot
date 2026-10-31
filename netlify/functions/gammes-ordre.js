// functions/gammes-ordre.js
//
// GET /.netlify/functions/gammes-ordre?of_id=uuid
//
// Réponse : [ { id, sequence, statut, operation: { id, code, nom }, sans_machine, en_ligne: { possible, actif, avec, avec_sequence } } ]

const { getSupabase } = require('./lib/supabaseclient');
const EL = require('./lib/en-ligne');

const handlerProtege = async (event) => {
  try {
    const ofId = (event.queryStringParameters || {}).of_id;
    if (!ofId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Paramètre of_id requis.' }) };
    }
    const supabase = getSupabase();
    await require('./lib/ordre-gamme').normaliserGamme(supabase, ofId);
    const { data, error } = await supabase
      .from('gammes_operatoires')
      .select('id, sequence, statut, predecesseurs, dependances, operations(id, code, nom, ordre_defaut)')
      .eq('of_id', ofId)
      .order('sequence');
    if (error) throw error;

    // Ordre d'affichage logique : on respecte d'abord les prédécesseurs déclarés (tri topologique), puis,
    // à égalité, l'ordre de déroulement standard des opérations (operations.ordre_defaut), puis la séquence.
    const parSeq = new Map(data.map((g) => [g.sequence, g]));
    const predsExpl = (g) => (Array.isArray(g.predecesseurs) ? g.predecesseurs.filter((s) => parSeq.has(s) && s !== g.sequence) : []);
    const cle = (g) => [g.operations && g.operations.ordre_defaut != null ? g.operations.ordre_defaut : 1e9, g.sequence];
    const avant = (a, b) => { const x = cle(a), y = cle(b); return x[0] - y[0] || x[1] - y[1]; };
    const restants = new Set(data.map((g) => g.sequence));
    const triees = [];
    while (restants.size) {
      const dispo = Array.from(restants).map((s) => parSeq.get(s)).filter((g) => predsExpl(g).every((s) => !restants.has(s)));
      const pool = dispo.length ? dispo : Array.from(restants).map((s) => parSeq.get(s)); // cycle : on retombe sur l'ordre standard
      // Une étape qui dépend explicitement de celle qu'on vient de placer (ex. coloris tête après massicot) la suit immédiatement.
      const derniere = triees.length ? triees[triees.length - 1].sequence : null;
      const suiveuses = derniere == null ? [] : pool.filter((g) => predsExpl(g).includes(derniere));
      (suiveuses.length ? suiveuses : pool).sort(avant);
      if (suiveuses.length) { triees.push(suiveuses[0]); restants.delete(suiveuses[0].sequence); continue; }
      pool.sort(avant);
      triees.push(pool[0]); restants.delete(pool[0].sequence);
    }
    data.splice(0, data.length, ...triees);
    data.forEach((g, i) => { g.rang = i + 1; });

    // Opérations pouvant tourner en ligne avec leur précédente : possible (règle) et actif (règle non annulée sur ce lien).
    const regles = await EL.chargerRegles(supabase);
    const enLigneDe = (g, i) => {
      const preds = Array.isArray(g.predecesseurs) ? g.predecesseurs : (i > 0 ? [data[i - 1].sequence] : []);
      for (const s of preds) {
        const p = data.find((x) => x.sequence === s);
        if (p && g.operations && p.operations && regles.has(`${g.operations.code}|${p.operations.code}`)) {
          return { possible: true, actif: EL.estEnLigne(regles, g.operations.code, p.operations.code, (g.dependances || {})[String(s)]), avec: p.operations.nom, avec_sequence: s };
        }
      }
      return { possible: false, actif: false };
    };
    // Opération sans machine ? Oui si toutes ses phases standard sont manuelles,
    // ou si elle n'a aucune phase et aucune machine compatible.
    const opIds = Array.from(new Set(data.map((g) => g.operations && g.operations.id).filter(Boolean)));
    if (!opIds.length) return { statusCode: 200, body: JSON.stringify(data.map((g, i) => ({ id: g.id, sequence: g.sequence, rang: g.rang, statut: g.statut, operation: g.operations, sans_machine: false, en_ligne: enLigneDe(g, i) }))) };
    const [phasesRes, machRes, liaisonRes] = await Promise.all([
      supabase.from('phases_standard').select('operation_id, occupe_machine').in('operation_id', opIds),
      supabase.from('machines').select('operation_id').in('operation_id', opIds).eq('actif', true),
      supabase.from('machines_operations').select('operation_id').in('operation_id', opIds),
    ]);
    const phases = phasesRes.error ? [] : (phasesRes.data || []);
    const avecMachine = new Set([...(machRes.error ? [] : machRes.data || []), ...(liaisonRes.error ? [] : liaisonRes.data || [])].map((x) => x.operation_id));
    const sansMachine = (opId) => {
      const ph = phases.filter((p) => p.operation_id === opId);
      if (ph.length) return !ph.some((p) => p.occupe_machine !== false);
      return !avecMachine.has(opId);
    };
    // Quantité, durée et attente calculées automatiquement (ratios de réparation, séchage…), réglables dans le chiffrage de l'OF.
    const infos = new Map();
    try {
      const calcul = await require('./lib/durees').calculerEtapes(supabase, ofId);
      if (calcul) {
        const nomDeSeq = new Map(calcul.etapes.map((e) => [e.sequence, e.operation]));
        calcul.etapes.forEach((e) => {
          infos.set(e.sequence, {
            quantite: e.quantite_etape, quantite_of: calcul.of.quantite, regle: e.quantite_regle || null,
            quantite_manuelle: !!(e.parametres && e.parametres.quantite),
            total_h: e.chiffre ? e.total_h : null, duree_manuelle_h: e.duree_manuelle_h,
            attentes: Object.entries(e.delais_min || {}).map(([s, m]) => ({ apres: nomDeSeq.get(Number(s)) || `étape ${s}`, heures: Math.round(Number(m) / 6) / 10 })),
          });
        });
      }
    } catch (_) { /* chiffrage indisponible : la gamme s'affiche sans ces informations */ }
    return {
      statusCode: 200,
      body: JSON.stringify(data.map((g, i) => ({
        id: g.id, sequence: g.sequence, rang: g.rang, statut: g.statut, operation: g.operations, en_ligne: enLigneDe(g, i),
        info: infos.get(g.sequence) || null,
        sans_machine: !!(g.operations && sansMachine(g.operations.id)),
      }))),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
