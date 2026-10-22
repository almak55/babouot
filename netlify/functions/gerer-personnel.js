// functions/gerer-personnel.js
//
// Fiche personnel : création, lecture, modification, retrait de l'équipe.
//
// GET    ?id=uuid              -> fiche complète + operation_codes[] + machine_ids[]
// POST   { prenom, nom_famille, nom?, poste, role_type, equipe, type_contrat, heures_semaine, cout_horaire,
//          matricule, email, telephone, date_entree, habilitations, notes, operation_codes?, machine_ids? }
//                              -> crée la personne (le nom affiché est « Prénom Nom » s'il n'est pas fourni)
// PUT    { id, ...mêmes champs, actif?, date_sortie? }  -> modifie ; operation_codes / machine_ids remplacent l'existant
// DELETE ?id=uuid              -> retire de l'équipe (actif = false, date de sortie du jour) : l'historique du planning est conservé
//
// Nécessite la migration 33 (colonnes supplémentaires).

const { getSupabase } = require('./lib/supabaseclient');

const rep = (code, o) => ({ statusCode: code, body: JSON.stringify(o) });
const TEXTE = ['prenom', 'nom_famille', 'nom', 'poste', 'equipe', 'type_contrat', 'matricule', 'email', 'telephone', 'habilitations', 'notes'];
const NOMBRE = ['heures_semaine', 'cout_horaire'];
const DATES = ['date_entree', 'date_sortie'];
const ROLES = ['opérateur', 'encadrement'];

function lireChamps(b) {
  const o = {};
  TEXTE.forEach((k) => { if (b[k] !== undefined) { const v = String(b[k] == null ? '' : b[k]).trim(); o[k] = v === '' ? null : v.slice(0, 200); } });
  NOMBRE.forEach((k) => { if (b[k] !== undefined) { const v = b[k] === '' || b[k] === null ? null : Number(String(b[k]).replace(',', '.')); if (v !== null && !Number.isFinite(v)) throw new Error(`Valeur numérique invalide : ${k}.`); o[k] = v; } });
  DATES.forEach((k) => { if (b[k] !== undefined) { const v = b[k] ? String(b[k]).slice(0, 10) : null; if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`Date invalide : ${k}.`); o[k] = v; } });
  if (b.role_type !== undefined) { if (!ROLES.includes(b.role_type)) throw new Error('Rôle invalide (opérateur ou encadrement).'); o.role_type = b.role_type; }
  if (b.actif !== undefined) o.actif = !!b.actif;
  return o;
}

async function remplacerCompetences(supabase, id, b) {
  if (Array.isArray(b.operation_codes)) {
    let opIds = [];
    if (b.operation_codes.length) {
      const { data: ops, error } = await supabase.from('operations').select('id, code').in('code', b.operation_codes);
      if (error) throw error;
      opIds = ops.map((o) => o.id);
    }
    const { error: d } = await supabase.from('personnel_competences').delete().eq('personnel_id', id);
    if (d) throw d;
    if (opIds.length) { const { error: i } = await supabase.from('personnel_competences').insert(opIds.map((operation_id) => ({ personnel_id: id, operation_id }))); if (i) throw i; }
  }
  if (Array.isArray(b.machine_ids)) {
    const { error: d } = await supabase.from('personnel_machines').delete().eq('personnel_id', id);
    if (d) throw d;
    if (b.machine_ids.length) { const { error: i } = await supabase.from('personnel_machines').insert(b.machine_ids.map((machine_id) => ({ personnel_id: id, machine_id }))); if (i) throw i; }
  }
}

const messageErreur = (e) => {
  const m = String(e.message || e);
  if (/duplicate key|unique/i.test(m)) return 'Une personne porte déjà ce nom affiché : modifiez le « nom affiché » (ex. ajoutez l\'initiale du nom).';
  if (/column .* does not exist|schema cache/i.test(m)) return `Colonne introuvable (${m}). Exécutez la migration 33 (migration_33_personnel.sql) dans Supabase, puis lancez : notify pgrst, 'reload schema';`;
  return m;
};

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();
    const m = event.httpMethod;
    const q = event.queryStringParameters || {};

    if (m === 'GET') {
      if (!q.id) return rep(400, { error: 'id requis.' });
      const { data, error } = await supabase.from('personnel').select('*').eq('id', q.id).single();
      if (error) throw error;
      const [c, mc] = await Promise.all([
        supabase.from('personnel_competences').select('operations(code)').eq('personnel_id', q.id),
        supabase.from('personnel_machines').select('machine_id').eq('personnel_id', q.id),
      ]);
      if (c.error) throw c.error; if (mc.error) throw mc.error;
      return rep(200, { ...data, operation_codes: c.data.map((x) => x.operations && x.operations.code).filter(Boolean), machine_ids: mc.data.map((x) => x.machine_id) });
    }

    if (m === 'POST') {
      const b = JSON.parse(event.body || '{}');
      const o = lireChamps(b);
      if (!o.prenom) return rep(400, { error: 'Le prénom est obligatoire.' });
      if (!o.nom) o.nom = [o.prenom, o.nom_famille].filter(Boolean).join(' ');
      if (!o.role_type) o.role_type = 'opérateur';
      o.actif = true;
      const { data, error } = await supabase.from('personnel').insert(o).select('id, nom').single();
      if (error) throw error;
      await remplacerCompetences(supabase, data.id, b);
      return rep(200, { ok: true, id: data.id, nom: data.nom });
    }

    if (m === 'PUT') {
      const b = JSON.parse(event.body || '{}');
      if (!b.id) return rep(400, { error: 'id requis.' });
      const o = lireChamps(b);
      if (o.nom === null) delete o.nom;
      if (Object.keys(o).length) { const { error } = await supabase.from('personnel').update(o).eq('id', b.id); if (error) throw error; }
      await remplacerCompetences(supabase, b.id, b);
      return rep(200, { ok: true });
    }

    if (m === 'DELETE') {
      if (!q.id) return rep(400, { error: 'id requis.' });
      const aujourdhui = new Date().toISOString().slice(0, 10);
      let { error } = await supabase.from('personnel').update({ actif: false, date_sortie: aujourdhui }).eq('id', q.id);
      if (error && /date_sortie/.test(error.message)) ({ error } = await supabase.from('personnel').update({ actif: false }).eq('id', q.id));
      if (error) throw error;
      return rep(200, { ok: true });
    }

    return rep(405, { error: 'Méthode non autorisée.' });
  } catch (err) {
    console.error('gerer-personnel error:', err);
    return rep(/obligatoire|invalide/i.test(err.message) ? 400 : 500, { error: messageErreur(err) });
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
