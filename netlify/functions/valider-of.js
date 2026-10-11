// functions/valider-of.js
//
// POST /.netlify/functions/valider-of
// body : { of_id: "uuid" }
//
// Vérifie les 3 conditions de validation d'un OF et met à jour son
// statut en conséquence :
//   1. MACHINES — pour chaque étape de la gamme déjà affectée à une
//      machine, celle-ci doit être active et ne pas être en
//      maintenance/réparation en cours. Pour une étape pas encore
//      affectée, il doit exister au moins une machine compatible
//      disponible (active, sans maintenance en cours).
//   2. MATIÈRES — si l'OF a des matières déclarées (table
//      of_matieres), chacune doit être en stock en quantité
//      suffisante. Sans déclaration, ce critère est considéré ok.
//   3. PERSONNEL — pour chaque opération de la gamme, il doit exister
//      au moins une personne compétente (par opération ou par
//      machine précise) et non absente aujourd'hui.
//
// Si les 3 critères passent : statut -> 'validé'.
// Sinon : statut -> 'en attente de validation', avec le détail des
// blocages renvoyé pour affichage.
//
// Réponse :
// {
//   statut: 'validé' | 'en attente de validation',
//   criteres: { machines: bool, matieres: bool, personnel: bool },
//   blocages: [ { etape, type, detail } ]
// }

const { getSupabase } = require('./lib/supabaseclient');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    }
    const body = JSON.parse(event.body || '{}');
    const { of_id } = body;
    if (!of_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'of_id requis.' }) };
    }

    const supabase = getSupabase();
    const aujourdHui = new Date().toISOString().slice(0, 10);

    const { data: of, error: ofError } = await supabase
      .from('ordres_fabrication').select('id, numero, statut').eq('id', of_id).single();
    if (ofError) throw ofError;

    const { data: gammes, error: gammesError } = await supabase
      .from('gammes_operatoires')
      .select('id, sequence, operation_id, machine_id, operations(nom)')
      .eq('of_id', of_id).order('sequence');
    if (gammesError) throw gammesError;

    if (gammes.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          statut: 'en attente de validation',
          criteres: { machines: false, matieres: false, personnel: false },
          blocages: [{ etape: null, type: 'gamme', detail: 'Cet OF n\'a aucune étape de gamme opératoire.' }],
        }),
      };
    }

    const [machinesRes, machinesOpsRes, maintenanceRes, competencesRes, persMachinesRes,
           absencesRes, personnelRes, matieresRes] = await Promise.all([
      supabase.from('machines').select('id, nom, operation_id, actif'),
      supabase.from('machines_operations').select('machine_id, operation_id'),
      supabase.from('maintenance_machine').select('machine_id, statut, date_debut, date_fin').eq('statut', 'en cours'),
      supabase.from('personnel_competences').select('personnel_id, operation_id'),
      supabase.from('personnel_machines').select('personnel_id, machine_id'),
      supabase.from('personnel_planning_jour').select('personnel_id, statut').eq('date', aujourdHui),
      supabase.from('personnel').select('id, nom').eq('actif', true),
      supabase.from('of_matieres').select('stock_id, quantite_requise, stocks(nom, quantite, unite)').eq('of_id', of_id),
    ]);
    for (const r of [machinesRes, machinesOpsRes, maintenanceRes, competencesRes, persMachinesRes, absencesRes, personnelRes, matieresRes]) {
      if (r.error) throw r.error;
    }

    const machineEnMaintenance = (machineId) => maintenanceRes.data.some((m) =>
      m.machine_id === machineId && m.date_debut <= aujourdHui && (!m.date_fin || m.date_fin >= aujourdHui)
    );
    const machineOperationnelle = (m) => m.actif && !machineEnMaintenance(m.id);

    const machinesParOp = (operationId) => {
      const direct = machinesRes.data.filter((m) => m.operation_id === operationId);
      const viaTable = machinesOpsRes.data
        .filter((mo) => mo.operation_id === operationId)
        .map((mo) => machinesRes.data.find((m) => m.id === mo.machine_id))
        .filter(Boolean);
      return Array.from(new Map([...direct, ...viaTable].map((m) => [m.id, m])).values());
    };

    const absentsAujourdhui = new Set(
      absencesRes.data.filter((a) => a.statut === 'absent' || a.statut === 'en arrêt').map((a) => a.personnel_id)
    );
    const personnelActifIds = new Set(personnelRes.data.map((p) => p.id));

    const personnelDisponiblePourOp = (operationId) => {
      const parCompetence = competencesRes.data
        .filter((c) => c.operation_id === operationId).map((c) => c.personnel_id);
      const machinesCompatibles = machinesParOp(operationId).map((m) => m.id);
      const parMachine = persMachinesRes.data
        .filter((pm) => machinesCompatibles.includes(pm.machine_id)).map((pm) => pm.personnel_id);
      const candidats = Array.from(new Set([...parCompetence, ...parMachine]));
      return candidats.some((id) => personnelActifIds.has(id) && !absentsAujourdhui.has(id));
    };

    // ---- 1. Critère machines ----
    const blocages = [];
    let machinesOk = true;
    for (const g of gammes) {
      if (g.machine_id) {
        const m = machinesRes.data.find((x) => x.id === g.machine_id);
        if (!m || !machineOperationnelle(m)) {
          machinesOk = false;
          blocages.push({ etape: g.sequence, type: 'machine', detail: `${g.operations.nom} : la machine affectée (${m ? m.nom : '?'}) n'est pas opérationnelle (inactive ou en maintenance).` });
        }
      } else {
        const compatibles = machinesParOp(g.operation_id);
        if (!compatibles.some(machineOperationnelle)) {
          machinesOk = false;
          blocages.push({ etape: g.sequence, type: 'machine', detail: `${g.operations.nom} : aucune machine opérationnelle disponible pour cette opération.` });
        }
      }
    }

    // ---- 2. Critère matières ----
    let matieresOk = true;
    matieresRes.data.forEach((ligne) => {
      if (ligne.stocks.quantite < ligne.quantite_requise) {
        matieresOk = false;
        blocages.push({ etape: null, type: 'matiere', detail: `${ligne.stocks.nom} : ${ligne.stocks.quantite} ${ligne.stocks.unite} en stock, ${ligne.quantite_requise} ${ligne.stocks.unite} requis.` });
      }
    });

    // ---- 3. Critère personnel ----
    let personnelOk = true;
    for (const g of gammes) {
      if (!personnelDisponiblePourOp(g.operation_id)) {
        personnelOk = false;
        blocages.push({ etape: g.sequence, type: 'personnel', detail: `${g.operations.nom} : personne de compétent·e disponible aujourd'hui (tout le monde absent ou aucune compétence déclarée).` });
      }
    }

    const tousOk = machinesOk && matieresOk && personnelOk;
    const nouveauStatut = tousOk ? 'validé' : 'en attente de validation';

    const { error: updateError } = await supabase
      .from('ordres_fabrication').update({ statut: nouveauStatut }).eq('id', of_id);
    if (updateError) throw updateError;

    return {
      statusCode: 200,
      body: JSON.stringify({
        statut: nouveauStatut,
        criteres: { machines: machinesOk, matieres: matieresOk, personnel: personnelOk },
        blocages,
      }),
    };
  } catch (err) {
    console.error('valider-of error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
