// functions/proposer-delais.js
//
// Propose au client AU PLUS 3 créneaux de livraison, avec 3 tarifs, pour un OF dont la fiche vient d'être lue.
// Rien n'est écrit dans le planning : ce sont des simulations (planifier-of avec appliquer: false).
//
//   rapide : délai rapproché, tarif majoré. L'OF est placé au plus tôt, horaires NORMAUX (pas d'heures supplémentaires),
//            et passe devant le travail pas encore commencé des OF SANS délai ferme (hors Pléiade / Coffret / urgents).
//            Les OF qui ont un délai ne sont jamais décalés.
//   normal : au plus tôt dans le planning tel qu'il est, sans rien décaler. Tarif normal.
//   long   : délai important, tarif réduit : début décalé de N jours ouvrés (réglable) par rapport au délai normal,
//            et vérifié sur le planning réel.
// Pour un OF Pléiade, le lot minimum (3 500 ex. par journée, BDM et pressure en colle) n'est PAS exigé en délai rapproché :
// choisir ce créneau marque l'OF « sans lot minimum » (colonne sans_lot_minimum, migration 56) pour toutes les planifications suivantes.
// Un créneau qui n'apporte aucune autre date que le délai normal n'est pas proposé (d'où « au plus 3 »).
//
// Réglages (table parametres_devis, « Coûts & tarifs ») : supplement_delai_rapide_pct (25), remise_delai_long_pct (10),
// decalage_delai_long_jours (10). Le prix est celui du devis calculé d'après le chiffrage de l'OF (main d'œuvre + machines ;
// les matières se saisissent dans le devis).
//
// POST { action: 'tarifs',  of_id }                                   -> { of, tarifs: { rapide, normal, long }, parametres, avertissements }
// POST { action: 'simuler', of_id, scenario: 'normal' | 'rapide' | 'long', debut_normal?: 'AAAA-MM-JJ' }
//                                                                      -> { scenario, debut, fin, date_livraison, of_decales?, avertissements }
// POST { action: 'choisir', of_id, option: 'rapide' | 'normal' | 'long', date_livraison: 'AAAA-MM-JJ' }
//                                                                      -> inscrit le délai sur l'OF et enregistre le devis correspondant

const { getSupabase } = require('./lib/supabaseclient');
const { construireBase, totaliser, creerDevis, r2 } = require('./lib/devis');
const { aujourdhuiParis } = require('./lib/debut-etape');
const PL = require('./lib/planification');
const LOTS = require('./lib/lots');
const planifierOf = require('./planifier-of');

const PRIORITAIRES = ['pleiade', 'coffret'];
const STATUTS_ACTIFS = ['en attente de validation', 'validé', 'en cours'];
const LIBELLES = { rapide: 'Délai rapproché', normal: 'Délai normal', long: 'Délai important' };

const rep = (code, o) => ({ statusCode: code, body: JSON.stringify(o) });
const maintenantParis = () => `${aujourdhuiParis()}T${new Date().toLocaleTimeString('sv-SE', { timeZone: 'Europe/Paris' }).slice(0, 5)}`;
const dateValide = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

// Date + N jours ouvrés (week-ends et jours fériés sautés).
function ajouterJoursOuvres(dateIso, n, cal) {
  let j = PL.enMinutes(dateIso, '00:00');
  for (let compte = 0, garde = 0; compte < n && garde < 800; garde++) {
    j += PL.MIN_JOUR;
    if (PL.estOuvre(j, cal)) compte++;
  }
  return PL.dateDe(j);
}

// Prix de chaque créneau, d'après le devis de l'OF (hors matières).
function tarifsDe(base) {
  const p = base.parametres;
  const suppl = Math.max(0, Number(p.supplement_delai_rapide_pct) || 0), remise = Math.min(100, Math.max(0, Number(p.remise_delai_long_pct) || 0));
  const saisie = { parametres: base.parametres, mo: base.mo, machine: base.machine, matieres: [], autres: [], remise_pct: 0, quantite: base.of.quantite };
  const normal = totaliser(saisie);
  const brut = normal.totaux.brut_ht;
  const saisieRapide = { ...saisie, autres: [{ libelle: `Supplément délai rapproché (+${suppl} %)`, cout: 0, vente: r2(brut * suppl / 100) }] };
  const saisieLong = { ...saisie, remise_pct: remise };
  const fiche = (code, saisieCode, ecart, texte) => {
    const r = totaliser(saisieCode);
    return { code, libelle: LIBELLES[code], ht: r.totaux.ht, tva: r.totaux.tva, ttc: r.totaux.ttc, prix_mille_ht: r.totaux.prix_mille_ht, ecart_pct: ecart, texte };
  };
  return {
    saisies: { rapide: saisieRapide, normal: saisie, long: saisieLong },
    tarifs: {
      rapide: fiche('rapide', saisieRapide, suppl, `Supplément délai rapproché : +${suppl} %`),
      normal: fiche('normal', saisie, 0, 'Tarif normal'),
      long: fiche('long', saisieLong, -remise, `Remise délai important : −${remise} %`),
    },
  };
}

// Une simulation de planning (rien n'est écrit).
async function simuler(ofId, extra) {
  const res = await planifierOf.handler({
    httpMethod: 'POST',
    body: JSON.stringify({ of_id: ofId, mode: 'avant', appliquer: false, maintenant: maintenantParis(), lots: 'liberes', ...extra }),
  });
  const d = JSON.parse(res.body);
  if (res.statusCode !== 200) return { erreur: d.error || `HTTP ${res.statusCode}`, bloquants: d.bloquants || [] };
  if (!d.resume.complet || (d.bloquants || []).length) return { erreur: 'Planification impossible : certaines étapes ne peuvent pas être placées (étape non chiffrée, personne ou machine manquante).', bloquants: d.bloquants || [] };
  return { d };
}

async function ofsAFaireReculer(supabase, ofId) {
  const { data, error } = await supabase.from('ordres_fabrication').select('id, numero, delai, priorite, type_production, statut').in('statut', STATUTS_ACTIFS);
  if (error) throw error;
  return (data || []).filter((o) => o.id !== ofId && !o.delai && !PRIORITAIRES.includes(o.type_production) && o.priorite !== 'urgente');
}

// OF dont du travail planifié (pas encore commencé) tombe sur une machine et un horaire pris par le nouvel OF.
async function ofsDecales(supabase, candidats, plan, maintenant) {
  if (!candidats.length) return [];
  const { data, error } = await supabase.from('planning_jour').select('of_id, date, heure_debut, heure_fin, machine_id, statut')
    .in('of_id', candidats.map((o) => o.id)).eq('statut', 'planifié').gte('date', maintenant.slice(0, 10));
  if (error) throw error;
  const hm = (t, defaut) => (t ? PL.hhmm(String(t).slice(0, 5)) : defaut);
  const pris = [];   // { machine, jour, d, f } du nouvel OF
  (plan.etapes || []).forEach((e) => (e.phases || []).forEach((ph) => {
    if (!ph.besoin_machine || !e.machine) return;
    (ph.tranches || []).forEach((t) => pris.push({ machine: e.machine.id, jour: t.date, d: PL.hhmm(t.debut), f: PL.hhmm(t.fin) }));
  }));
  const touches = new Set();
  (data || []).forEach((l) => {
    if (!l.machine_id || `${l.date}T${String(l.heure_debut || '00:00').slice(0, 5)}` < maintenant) return;
    const d = hm(l.heure_debut, 0), f = hm(l.heure_fin, PL.MIN_JOUR);
    if (pris.some((x) => x.machine === l.machine_id && x.jour === l.date && x.d < f && x.f > d)) touches.add(l.of_id);
  });
  return candidats.filter((o) => touches.has(o.id)).map((o) => o.numero).sort();
}

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return rep(405, { error: 'Méthode non autorisée, utiliser POST.' });
    const b = JSON.parse(event.body || '{}');
    if (!b.of_id) return rep(400, { error: 'of_id requis.' });
    const supabase = getSupabase();
    const base = await construireBase(supabase, b.of_id);
    if (!base) return rep(404, { error: 'OF introuvable.' });
    const { tarifs, saisies } = tarifsDe(base);
    const P = base.parametres;
    const parametres = { supplement_pct: Number(P.supplement_delai_rapide_pct) || 0, remise_pct: Number(P.remise_delai_long_pct) || 0, decalage_jours: Math.max(1, Math.round(Number(P.decalage_delai_long_jours) || 10)) };

    if (b.action === 'tarifs') {
      return rep(200, { of: base.of, tarifs, parametres, avertissements: base.avertissements });
    }

    if (b.action === 'simuler') {
      const scenario = b.scenario;
      if (!['normal', 'rapide', 'long'].includes(scenario)) return rep(400, { error: 'scenario invalide (normal | rapide | long).' });
      const maintenant = maintenantParis();
      const extra = {};
      let candidats = [];
      if (scenario === 'rapide') {
        candidats = await ofsAFaireReculer(supabase, b.of_id);
        extra.liberer_ofs = candidats.map((o) => o.id);
      }
      if (scenario === 'long') {
        if (!dateValide(b.debut_normal)) return rep(400, { error: 'debut_normal requis (date de début du délai normal).' });
        const cal = { code: 'normal', debut: '08:00', fin: '16:30', pause_debut: '12:00', pause_minutes: 30 };
        extra.debut_souhaite = `${ajouterJoursOuvres(b.debut_normal, parametres.decalage_jours, cal)}T${cal.debut}`;
      }
      const r = await simuler(b.of_id, extra);
      if (r.erreur) return rep(200, { scenario, erreur: r.erreur, bloquants: r.bloquants });
      const d = r.d;
      const reponseExtra = {};
      const avertissements = [];
      {
        // Règle des lots minimum (OF Pléiade seulement) : l'estimation suppose un lot complet, sauf en délai rapproché (règle levée).
        const regles = await LOTS.chargerRegles(supabase);
        const { data: tOf } = await supabase.from('ordres_fabrication').select('type_production').eq('id', b.of_id).single();
        const { data: gs } = await supabase.from('gammes_operatoires').select('id, operations(code)').eq('of_id', b.of_id);
        const concernees = (gs || []).map((g) => g.operations && g.operations.code).filter((c) => c && LOTS.regleDe(regles, c, tOf && tOf.type_production) && Number(base.of.quantite) < LOTS.regleDe(regles, c, tOf && tOf.type_production).quantite_min);
        if (concernees.length) {
          const min = LOTS.regleDe(regles, concernees[0], tOf.type_production).quantite_min;
          if (scenario === 'rapide') { avertissements.push(`Pléiade : le lot minimum de ${min} ex. par journée n'est pas exigé en délai rapproché (l'OF peut tourner seul).`); reponseExtra.lot_leve = true; }
          else avertissements.push(`Lot minimum : ${concernees.length} étape(s) (montage couvertures / pressure en colle Pléiade) exigent un lot de ${min} ex. par journée. Les dates supposent que cet OF soit regroupé avec d'autres titres.`);
        }
      }
      const reponse = { ...reponseExtra, scenario, debut: d.resume.debut, fin: d.resume.fin, date_livraison: String(d.resume.fin).slice(0, 10), calendrier: d.calendrier, avertissements };
      if (scenario === 'rapide') reponse.of_decales = await ofsDecales(supabase, candidats, d, maintenant);
      return rep(200, reponse);
    }

    if (b.action === 'choisir') {
      const option = b.option;
      if (!['rapide', 'normal', 'long'].includes(option)) return rep(400, { error: 'option invalide (rapide | normal | long).' });
      if (!dateValide(b.date_livraison) || b.date_livraison < aujourdhuiParis()) return rep(400, { error: 'date_livraison invalide.' });
      const { error: eU } = await supabase.from('ordres_fabrication').update({ delai: b.date_livraison }).eq('id', b.of_id);
      if (eU) throw eU;
      // Délai rapproché : lot minimum levé pour cet OF ; autre choix : règle normale (colonne facultative, migration 56).
      const { error: eL } = await supabase.from('ordres_fabrication').update({ sans_lot_minimum: option === 'rapide' }).eq('id', b.of_id);
      const lotLeve = option === 'rapide' && !eL;
      const t = tarifs[option];
      const jour = new Date(`${b.date_livraison}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const devis = await creerDevis(supabase, {
        of_id: b.of_id, client: base.of.client, titre: base.of.titre, saisie: saisies[option],
        notes: `${LIBELLES[option]} : livraison prévue le ${jour} (${t.texte}). Prix hors matières premières.`,
      });
      return rep(200, { ok: true, delai: b.date_livraison, option, lot_minimum_leve: lotLeve, devis: { id: devis.id, numero: devis.numero, total_ht: devis.resultat.totaux.ht } });
    }

    return rep(400, { error: 'action inconnue (tarifs | simuler | choisir).' });
  } catch (e) {
    console.error('proposer-delais error:', e);
    return rep(500, { error: e.message || String(e) });
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
