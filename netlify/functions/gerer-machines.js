// functions/gerer-machines.js
//
// GET  /.netlify/functions/gerer-machines
//   -> liste toutes les machines (actives et inactives) avec la liste
//      de leurs opérations (une machine peut en faire plusieurs), leur équipe requise (nb_personnes)
//      et leurs conducteurs : [{ personnel_id, nom, rang }] (rang 1 = titulaire, puis suppléants).
//
// POST /.netlify/functions/gerer-machines
//   body : { code, nom, operation_codes?: string[], notes? }
//   -> crée une nouvelle machine, rattachée à 0, 1 ou plusieurs
//      opérations existantes (ex: ['DORURE', 'FINITION']).
//
// PUT  /.netlify/functions/gerer-machines
//   body : { id, code?, nom?, operation_codes?: string[], actif?, notes?, nb_personnes?: n,
//            conducteurs?: [personnel_id, ...] (dans l'ordre : titulaire d'abord ; remplace la liste) }
//   -> modifie une machine existante. Si operation_codes est fourni,
//      remplace entièrement l'ensemble de ses opérations (liste vide
//      = plus aucune opération rattachée).
//
// DELETE /.netlify/functions/gerer-machines?id=uuid[&force=true]
//   -> supprime une machine. Ses liens avec les opérations, les
//      compétences machine du personnel et ses maintenances partent
//      avec elle. Si elle est encore utilisée par des affectations
//      planning ou des étapes de gamme, la suppression est REFUSÉE
//      (409, avec le détail) — sauf avec force=true, qui retire ces
//      affectations : les étapes de gamme concernées repassent "à
//      planifier". Alternative moins destructive : la désactiver
//      (PUT actif=false), elle disparaît des plannings mais reste
//      en base.

const { getSupabase } = require('./lib/supabaseclient');
const INT = require('./lib/interventions');
const { aujourdhuiParis } = require('./lib/debut-etape');

async function resoudreOperationIds(supabase, codes) {
  if (!codes || codes.length === 0) return [];
  const { data, error } = await supabase.from('operations').select('id, code').in('code', codes);
  if (error) throw error;
  const trouves = data.map((o) => o.code);
  const inconnus = codes.filter((c) => !trouves.includes(c));
  if (inconnus.length > 0) {
    const err = new Error(`Code(s) d'opération inconnu(s) : ${inconnus.join(', ')}`);
    err.isClientError = true;
    throw err;
  }
  return data.map((o) => o.id);
}

const handlerProtege = async (event) => {
  try {
    const supabase = getSupabase();

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('machines')
        .select('*, machines_operations(operations(code, nom))')
        .order('code');
      if (error) throw error;
      // Conducteurs (migration 42 : colonne rang ; sans elle, la liste est simplement non ordonnée).
      const [pmRes, persRes] = await Promise.all([
        supabase.from('personnel_machines').select('*'),
        supabase.from('personnel').select('id, nom'),
      ]);
      const nomDe = Object.fromEntries((persRes.data || []).map((p) => [p.id, p.nom]));
      const aidesDe = (mid) => (pmRes.data || []).filter((x) => x.machine_id === mid && (x.rang === null || x.rang === undefined))
        .map((x) => ({ personnel_id: x.personnel_id, nom: nomDe[x.personnel_id] || '?' })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      const conducteursDe = (mid) => (pmRes.data || []).filter((x) => x.machine_id === mid && x.rang !== null && x.rang !== undefined)
        .map((x) => ({ personnel_id: x.personnel_id, nom: nomDe[x.personnel_id] || '?', rang: x.rang ?? null }))
        .sort((a, b) => (a.rang ?? 1e9) - (b.rang ?? 1e9) || a.nom.localeCompare(b.nom, 'fr'));
      const etats = await INT.etatsMachines(supabase, aujourdhuiParis());
      return {
        statusCode: 200,
        body: JSON.stringify(data.map((m) => ({
          id: m.id, code: m.code, nom: m.nom, actif: m.actif, notes: m.notes,
          etat: etats[m.id] || { etat: 'ok', libelle: 'Opérationnelle' },
          nb_personnes: m.nb_personnes || 1,
          conducteurs: conducteursDe(m.id),
          aides: aidesDe(m.id),
          operations: m.machines_operations.map((mo) => mo.operations),
        }))),
      };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { code, nom, operation_codes, notes, nb_personnes: nbPers } = body;
      if (!code || !nom) {
        return { statusCode: 400, body: JSON.stringify({ error: 'code et nom sont requis.' }) };
      }

      let operationIds;
      try { operationIds = await resoudreOperationIds(supabase, operation_codes); }
      catch (e) {
        if (e.isClientError) return { statusCode: 400, body: JSON.stringify({ error: e.message }) };
        throw e;
      }

      const { data: machine, error } = await supabase
        .from('machines')
        .insert({ code, nom, notes: notes || null, ...(Number(nbPers) > 1 ? { nb_personnes: Math.round(Number(nbPers)) } : {}) })
        .select('id, code, nom')
        .single();
      if (error) {
        if (error.code === '23505') {
          return { statusCode: 409, body: JSON.stringify({ error: `Le code "${code}" est déjà utilisé par une autre machine.` }) };
        }
        throw error;
      }

      if (operationIds.length > 0) {
        const { error: linkError } = await supabase
          .from('machines_operations')
          .insert(operationIds.map((operation_id) => ({ machine_id: machine.id, operation_id })));
        if (linkError) throw linkError;
      }

      return { statusCode: 200, body: JSON.stringify(machine) };
    }

    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const { id, code, nom, operation_codes, actif, notes, nb_personnes, conducteurs, aides } = body;
      if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'id requis.' }) };
      }

      const updates = {};
      if (code !== undefined) updates.code = code;
      if (nom !== undefined) updates.nom = nom;
      if (actif !== undefined) updates.actif = actif;
      if (notes !== undefined) updates.notes = notes;
      if (nb_personnes !== undefined) {
        const n = Math.round(Number(nb_personnes));
        if (!Number.isFinite(n) || n < 1) return { statusCode: 400, body: JSON.stringify({ error: 'nb_personnes : entier ≥ 1 attendu.' }) };
        updates.nb_personnes = n;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('machines').update(updates).eq('id', id);
        if (error) {
          if (error.code === '23505') {
            return { statusCode: 409, body: JSON.stringify({ error: `Le code "${code}" est déjà utilisé par une autre machine.` }) };
          }
          throw error;
        }
      }

      if (Array.isArray(conducteurs)) {
        // Liste ordonnée : titulaire d'abord. On conserve le niveau déjà saisi des personnes maintenues.
        const ids = Array.from(new Set(conducteurs.filter(Boolean)));
        const { data: existants, error: eEx } = await supabase.from('personnel_machines').select('*').eq('machine_id', id);
        if (eEx) throw eEx;
        // Conducteurs retirés de la liste : ils deviennent de simples aides potentiels (lien conservé, sans rang)
        // — sauf si la liste des aides est fournie : elle fait alors foi (les personnes absentes des deux listes sont déliées).
        const idsAides = Array.isArray(aides) ? Array.from(new Set(aides.filter((x) => x && !ids.includes(x)))) : null;
        const aRetirer = existants.filter((x) => !ids.includes(x.personnel_id) && x.rang !== null && x.rang !== undefined && !(idsAides && !idsAides.includes(x.personnel_id))).map((x) => x.personnel_id);
        if (aRetirer.length) {
          const { error: eDel } = await supabase.from('personnel_machines').update({ rang: null }).eq('machine_id', id).in('personnel_id', aRetirer);
          if (eDel) throw eDel;
        }
        if (idsAides) {
          const aSupprimer = existants.filter((x) => !ids.includes(x.personnel_id) && !idsAides.includes(x.personnel_id)).map((x) => x.personnel_id);
          if (aSupprimer.length) {
            const { error: eS } = await supabase.from('personnel_machines').delete().eq('machine_id', id).in('personnel_id', aSupprimer);
            if (eS) throw eS;
          }
          for (const pid of idsAides) {
            const ex = existants.find((x) => x.personnel_id === pid);
            const r = ex
              ? (ex.rang !== null && ex.rang !== undefined ? await supabase.from('personnel_machines').update({ rang: null }).eq('machine_id', id).eq('personnel_id', pid) : { error: null })
              : await supabase.from('personnel_machines').insert({ machine_id: id, personnel_id: pid, rang: null });
            if (r.error) throw r.error;
          }
        }
        for (let i = 0; i < ids.length; i++) {
          const existe = existants.some((x) => x.personnel_id === ids[i]);
          const r = existe
            ? await supabase.from('personnel_machines').update({ rang: i + 1 }).eq('machine_id', id).eq('personnel_id', ids[i])
            : await supabase.from('personnel_machines').insert({ machine_id: id, personnel_id: ids[i], rang: i + 1 });
          if (r.error) throw r.error;
        }
      }

      if (operation_codes !== undefined) {
        let operationIds;
        try { operationIds = await resoudreOperationIds(supabase, operation_codes); }
        catch (e) {
          if (e.isClientError) return { statusCode: 400, body: JSON.stringify({ error: e.message }) };
          throw e;
        }

        const { error: delError } = await supabase.from('machines_operations').delete().eq('machine_id', id);
        if (delError) throw delError;

        if (operationIds.length > 0) {
          const { error: insError } = await supabase
            .from('machines_operations')
            .insert(operationIds.map((operation_id) => ({ machine_id: id, operation_id })));
          if (insError) throw insError;
        }
      }

      const { data, error: readError } = await supabase
        .from('machines').select('id, code, nom').eq('id', id).single();
      if (readError) throw readError;

      return { statusCode: 200, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'DELETE') {
      const params = event.queryStringParameters || {};
      const id = params.id;
      const force = params.force === 'true';
      if (!id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Paramètre id requis.' }) };
      }

      const { data: machine, error: machineError } = await supabase
        .from('machines').select('id, code, nom').eq('id', id).maybeSingle();
      if (machineError) throw machineError;
      if (!machine) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Machine introuvable (déjà supprimée ?).' }) };
      }

      const [planRes, gammeRes] = await Promise.all([
        supabase.from('planning_jour').select('id', { count: 'exact', head: true }).eq('machine_id', id),
        supabase.from('gammes_operatoires').select('id', { count: 'exact', head: true }).eq('machine_id', id),
      ]);
      if (planRes.error) throw planRes.error;
      if (gammeRes.error) throw gammeRes.error;
      const nbAffectations = planRes.count || 0;
      const nbEtapes = gammeRes.count || 0;

      if ((nbAffectations > 0 || nbEtapes > 0) && !force) {
        return {
          statusCode: 409,
          body: JSON.stringify({
            error: `${machine.nom} est encore utilisée (${nbAffectations} affectation(s) planning, ${nbEtapes} étape(s) de gamme).`,
            utilisee: { affectations: nbAffectations, etapes_gamme: nbEtapes },
            nom: machine.nom,
          }),
        };
      }

      if (nbAffectations > 0 || nbEtapes > 0) {
        // Suppression forcée : retirer d'abord ce qui référence la machine.
        const { error: delPlanError } = await supabase.from('planning_jour').delete().eq('machine_id', id);
        if (delPlanError) throw delPlanError;

        const { error: resetError } = await supabase
          .from('gammes_operatoires').update({ statut: 'à planifier', machine_id: null })
          .eq('machine_id', id).eq('statut', 'planifié');
        if (resetError) throw resetError;
        const { error: nullGammeError } = await supabase
          .from('gammes_operatoires').update({ machine_id: null }).eq('machine_id', id);
        if (nullGammeError) throw nullGammeError;
      }

      // Simple référence indicative dans les déclarations de disponibilité.
      const { error: dispoError } = await supabase
        .from('personnel_planning_jour').update({ machine_id: null }).eq('machine_id', id);
      if (dispoError) throw dispoError;

      const { error: delError } = await supabase.from('machines').delete().eq('id', id);
      if (delError) throw delError;

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, nom: machine.nom, affectations_retirees: force ? nbAffectations : 0 }),
      };
    }

    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
  } catch (err) {
    console.error('gerer-machines error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
