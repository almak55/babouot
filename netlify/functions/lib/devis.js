// lib/devis.js
//
// Calcul d'un devis à partir du chiffrage d'un OF (heures personnes / machine par opération),
// des coûts (personnel, amortissement machine, matières) et des tarifs de vente.
//
//   Main d'œuvre : heures personnes × taux facturé au client (60 €/h par défaut).
//                  Coût de revient = heures × coût horaire réel du personnel.
//   Machines     : heures machine × coût horaire d'amortissement.
//                  Facturé (avec marge) si « facturer_machine » = 1, sinon inclus dans la main d'œuvre.
//   Matières     : quantité × prix unitaire ; vendu avec la marge matière.
//   Autres frais : libellé, coût, prix de vente.
//   Remise, TVA, prix par exemplaire et marge en découlent.

const { calculerEtapes } = require('./durees');
const { evaluer } = require('./formules');

const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;
const num = (v, d = null) => { if (v === null || v === undefined || v === '') return d; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : d; };

const PARAMS_DEFAUT = { taux_horaire_client: 60, cout_horaire_personnel: 28, marge_matiere_pct: 15, facturer_machine: 1, marge_machine_pct: 10, tva_pct: 20, validite_jours: 30 };

function coutHoraireMachine(m) {
  const force = num(m.cout_horaire_force);
  if (force !== null) return r2(force);
  const prix = num(m.prix_achat), ans = num(m.duree_amortissement_ans), h = num(m.heures_an, 1600);
  if (prix === null || !ans || !h) return null;
  return r2(prix / (ans * h) + (num(m.entretien_an, 0) / h));
}

async function lireParametres(supabase) {
  const { data, error } = await supabase.from('parametres_devis').select('cle, valeur');
  if (error) throw error;
  const p = { ...PARAMS_DEFAUT };
  (data || []).forEach((x) => { p[x.cle] = Number(x.valeur); });
  return p;
}

// Postes calculés d'après le chiffrage de l'OF (sans les saisies manuelles).
async function construireBase(supabase, ofId) {
  const calcul = await calculerEtapes(supabase, ofId);
  if (!calcul) return null;
  const params = await lireParametres(supabase);
  const [machRes, persRes, compRes, stockRes, ofRes] = await Promise.all([
    supabase.from('machines').select('id, nom, prix_achat, duree_amortissement_ans, heures_an, entretien_an, cout_horaire_force'),
    supabase.from('personnel').select('id, cout_horaire, actif'),
    supabase.from('personnel_competences').select('personnel_id, operation_id'),
    supabase.from('stocks').select('id, nom, unite, prix_unitaire, conso_formule').order('nom'),
    supabase.from('ordres_fabrication').select('numero, quantite, delai, caracteristiques, titres(nom, client)').eq('id', ofId).single(),
  ]);
  for (const r of [machRes, persRes, compRes, stockRes, ofRes]) if (r.error) throw r.error;
  const machines = Object.fromEntries(machRes.data.map((m) => [m.id, m]));
  const actifs = new Set(persRes.data.filter((p) => p.actif !== false).map((p) => p.id));
  const coutPers = Object.fromEntries(persRes.data.map((p) => [p.id, num(p.cout_horaire)]));

  const avertissements = [];
  const mo = [], machine = [];
  calcul.etapes.forEach((e) => {
    if (!e.chiffre) { avertissements.push(`« ${e.operation} » n'est pas chiffrée : aucun coût calculé pour cette opération.`); return; }
    // Coût horaire personnel : moyenne des coûts renseignés des personnes compétentes, sinon coût moyen des réglages.
    const couts = compRes.data.filter((c) => c.operation_id === e.operation_id && actifs.has(c.personnel_id)).map((c) => coutPers[c.personnel_id]).filter((x) => x !== null);
    const coutH = couts.length ? r2(couts.reduce((s, x) => s + x, 0) / couts.length) : params.cout_horaire_personnel;
    const hp = r2(e.heures_personnes);
    if (hp > 0) mo.push({ id: e.gamme_id, operation: e.operation, heures: hp, cout_horaire: coutH });

    const hm = r2(e.heures_machine);
    if (hm > 0) {
      const mId = e.machine_id || (e.machines_compatibles.length === 1 ? e.machines_compatibles[0].id : null);
      const m = mId ? machines[mId] : null;
      const cm = m ? coutHoraireMachine(m) : null;
      if (!m) avertissements.push(`« ${e.operation} » : aucune machine retenue, utilisation machine non chiffrée.`);
      else if (cm === null) avertissements.push(`Machine « ${m.nom} » : prix d'achat / durée d'amortissement non renseignés (Coûts & tarifs).`);
      machine.push({ id: e.gamme_id, operation: e.operation, machine: m ? m.nom : '—', heures: hm, cout_horaire: cm === null ? 0 : cm });
    }
  });

  // Matières : propositions de quantité d'après la fiche (formule de consommation), à valider.
  const typesCar = {};
  const car = calcul.of.caracteristiques || {};
  const matieres_disponibles = stockRes.data.map((s) => {
    let quantite = null;
    if (s.conso_formule) {
      const r = evaluer(s.conso_formule, { ...car, quantite: calcul.of.quantite }, { quantite: 'nombre' });
      if (r.ok && r.valeur !== null) quantite = r2(r.valeur);
    }
    return { stock_id: s.id, nom: s.nom, unite: s.unite, prix_unitaire: num(s.prix_unitaire), quantite_proposee: quantite };
  });

  const of = ofRes.data;
  return {
    of: { id: ofId, numero: of.numero, quantite: of.quantite, delai: of.delai, titre: of.titres ? of.titres.nom : '', client: of.titres ? of.titres.client : '' },
    parametres: params, mo, machine, matieres_disponibles, avertissements,
  };
}

// Totaux d'un devis. `saisie` : { parametres?, mo, machine, matieres, autres, remise_pct, quantite }
function totaliser(saisie) {
  const p = { ...PARAMS_DEFAUT, ...(saisie.parametres || {}) };
  const taux = num(p.taux_horaire_client, 60);
  const factM = Number(p.facturer_machine) === 1;
  const mm = 1 + num(p.marge_machine_pct, 0) / 100;
  const mmat = 1 + num(p.marge_matiere_pct, 0) / 100;

  const mo = (saisie.mo || []).map((l) => {
    const h = num(l.heures, 0), ch = num(l.cout_horaire, 0);
    return { ...l, heures: h, cout: r2(h * ch), vente: r2(h * taux) };
  });
  const machine = (saisie.machine || []).map((l) => {
    const h = num(l.heures, 0), ch = num(l.cout_horaire, 0);
    return { ...l, heures: h, cout: r2(h * ch), vente: factM ? r2(h * ch * mm) : 0 };
  });
  const matieres = (saisie.matieres || []).map((l) => {
    const q = num(l.quantite, 0), pu = num(l.prix_unitaire, 0);
    return { ...l, quantite: q, prix_unitaire: pu, cout: r2(q * pu), vente: r2(q * pu * mmat) };
  });
  const autres = (saisie.autres || []).map((l) => ({ ...l, cout: r2(num(l.cout, 0)), vente: r2(num(l.vente, 0)) }));

  const somme = (liste, k) => r2(liste.reduce((s, l) => s + l[k], 0));
  const t = {
    mo_vente: somme(mo, 'vente'), mo_cout: somme(mo, 'cout'), mo_heures: r2(mo.reduce((s, l) => s + l.heures, 0)),
    machine_vente: somme(machine, 'vente'), machine_cout: somme(machine, 'cout'), machine_heures: r2(machine.reduce((s, l) => s + l.heures, 0)),
    matieres_vente: somme(matieres, 'vente'), matieres_cout: somme(matieres, 'cout'),
    autres_vente: somme(autres, 'vente'), autres_cout: somme(autres, 'cout'),
  };
  const brutHt = r2(t.mo_vente + t.machine_vente + t.matieres_vente + t.autres_vente);
  const remisePct = num(saisie.remise_pct, 0);
  const remise = r2(brutHt * remisePct / 100);
  const ht = r2(brutHt - remise);
  const tva = r2(ht * num(p.tva_pct, 20) / 100);
  const coutRevient = r2(t.mo_cout + t.machine_cout + t.matieres_cout + t.autres_cout);
  const quantite = num(saisie.quantite, 0);
  return {
    parametres: p, mo, machine, matieres, autres, remise_pct: remisePct, quantite,
    totaux: {
      ...t, brut_ht: brutHt, remise, ht, tva, ttc: r2(ht + tva), cout_revient: coutRevient,
      marge: r2(ht - coutRevient), marge_pct: ht > 0 ? Math.round(((ht - coutRevient) / ht) * 1000) / 10 : 0,
      prix_unitaire_ht: quantite > 0 ? Math.round((ht / quantite) * 1000) / 1000 : null,
      prix_mille_ht: quantite > 0 ? r2((ht / quantite) * 1000) : null,
    },
  };
}

module.exports = { construireBase, totaliser, lireParametres, coutHoraireMachine, PARAMS_DEFAUT, r2, num };
