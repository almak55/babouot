// functions/importer-planning-annuel.js
//
// POST { file_base64, file_name, mime_type }                  -> APERÇU (rien n'est écrit)
// POST { appliquer: true, changements: [ { type:'creer'|'maj', id?, champs:{...} } ] }  -> applique la sélection
//
// Lit un nouveau planning annuel Gallimard (photo/scan, PDF, Excel, Word) avec l'IA, le compare au planning
// annuel enregistré (pleiade_annuel) et propose, ligne par ligne :
//   • nouveaux titres ; • titres modifiés (date de livraison, quantité, cahiers, carte de dos, tête, peau) ;
//   • titres inchangés (comptés) ; • titres enregistrés mais absents du nouveau planning (à vérifier : jamais supprimés automatiquement).
// L'utilisateur coche ce qu'il veut appliquer. Variable d'environnement requise : ANTHROPIC_API_KEY.

const { getSupabase } = require('./lib/supabaseclient');

const FORMATS_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const CHAMPS_LUS = ['quantite', 'mp', 'carte_dos', 'tete', 'peau', 'mois', 'date_livraison'];
const CHAMPS_AUTORISES = ['titre', 'quantite', 'quantite_alt', 'mp', 'carte_dos', 'tete', 'peau', 'mois', 'date_livraison', 'flags', 'reception', 'livraison_txt', 'notes'];
const rep = (statusCode, obj) => ({ statusCode, body: JSON.stringify(obj) });

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, ' ').trim();
const entier = (v) => { if (v === null || v === undefined || String(v).trim() === '') return null; const n = parseInt(String(v).replace(/[^0-9\-]/g, ''), 10); return Number.isFinite(n) ? n : null; };
const texte = (v) => { const t = v === null || v === undefined ? '' : String(v).trim(); return t === '' ? null : t; };
const dateIso = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
const moisIso = (v) => (/^\d{4}-\d{2}$/.test(String(v || '')) ? String(v) : null);

function normaliserLue(l) {
  const date = dateIso(l.date_livraison);
  const o = {
    titre: texte(l.titre), quantite: entier(l.quantite), mp: entier(l.mp), carte_dos: entier(l.carte_dos),
    tete: texte(l.tete), peau: texte(l.peau), date_livraison: date, mois: date ? date.slice(0, 7) : moisIso(l.mois),
    flags: texte(l.flags), reception: texte(l.reception), livraison_txt: texte(l.livraison_txt),
  };
  return o;
}

function ressemble(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const ta = new Set(a.split(' ')), tb = new Set(b.split(' '));
  const commun = [...ta].filter((t) => tb.has(t)).length;
  return commun / Math.max(ta.size, tb.size) >= 0.85;
}

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return rep(405, { error: 'Méthode non autorisée, utiliser POST.' });
    const body = JSON.parse(event.body || '{}');
    const supabase = getSupabase();

    // ---------- Application de la sélection ----------
    if (body.appliquer) {
      const liste = Array.isArray(body.changements) ? body.changements : [];
      let crees = 0, maj = 0;
      for (const c of liste) {
        const champs = {};
        CHAMPS_AUTORISES.forEach((k) => { if (c.champs && c.champs[k] !== undefined) champs[k] = c.champs[k]; });
        if (champs.date_livraison) { if (!dateIso(champs.date_livraison)) continue; champs.mois = champs.date_livraison.slice(0, 7); }
        if (c.type === 'creer') {
          if (!champs.titre || !(champs.mois || champs.date_livraison)) continue;
          const { error } = await supabase.from('pleiade_annuel').insert({ ordre: 9999, statut: 'a_produire', a_verifier: true, ...champs });
          if (error) throw error; crees++;
        } else if (c.type === 'maj' && c.id) {
          if (!Object.keys(champs).length) continue;
          if ('mois' in champs && !('date_livraison' in champs)) champs.date_livraison = null;   // déplacé de mois sans date précise
          if ('mois' in champs || 'date_livraison' in champs) champs.a_verifier = true;
          const { data: ligne } = await supabase.from('pleiade_annuel').select('of_id').eq('id', c.id).maybeSingle();
          const { error } = await supabase.from('pleiade_annuel').update(champs).eq('id', c.id);
          if (error) throw error; maj++;
          if (ligne && ligne.of_id && champs.date_livraison) await supabase.from('ordres_fabrication').update({ delai: champs.date_livraison }).eq('id', ligne.of_id);
        }
      }
      return rep(200, { crees, maj });
    }

    // ---------- Aperçu : lecture du document ----------
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return rep(500, { error: 'ANTHROPIC_API_KEY manquant dans les variables d\'environnement Netlify.' });
    const { file_base64, file_name, mime_type } = body;
    if (!file_base64 || !mime_type) return rep(400, { error: 'file_base64 et mime_type sont requis.' });

    let blocs;
    if (FORMATS_IMAGE.includes(mime_type)) blocs = [{ type: 'image', source: { type: 'base64', media_type: mime_type, data: file_base64 } }];
    else if (mime_type === 'application/pdf') blocs = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file_base64 } }];
    else if (/spreadsheetml|ms-excel/.test(mime_type)) {
      const XLSX = require('xlsx');
      const cl = XLSX.read(Buffer.from(file_base64, 'base64'), { type: 'buffer' });
      const t = cl.SheetNames.map((n) => `--- Feuille "${n}" ---\n${XLSX.utils.sheet_to_csv(cl.Sheets[n])}`).join('\n\n');
      if (!t.trim()) return rep(400, { error: 'Ce fichier Excel semble vide.' });
      blocs = [{ type: 'text', text: `Contenu du fichier Excel "${file_name || ''}" :\n\n${t}` }];
    } else if (/wordprocessingml|msword/.test(mime_type)) {
      const mammoth = require('mammoth');
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(file_base64, 'base64') });
      if (!value || !value.trim()) return rep(400, { error: 'Impossible de lire ce fichier Word.' });
      blocs = [{ type: 'text', text: `Contenu du document Word "${file_name || ''}" :\n\n${value}` }];
    } else return rep(400, { error: `Format non supporté : ${mime_type}. Acceptés : photo (jpg/png/webp), PDF, Excel, Word.` });

    const auj = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
    const systeme = `Tu lis le planning annuel de fabrication « Pléiade » d'un éditeur (une ligne par titre à fabriquer), fourni en photo/scan, PDF ou texte. Réponds UNIQUEMENT avec un tableau JSON valide (pas de texte autour, pas de markdown) : une entrée par titre, dans l'ordre du document :
[{"titre": string, "quantite": number|null, "mp": number|null, "carte_dos": number|null, "tete": string|null, "peau": string|null, "date_livraison": "AAAA-MM-JJ"|null, "mois": "AAAA-MM"|null, "livraison_txt": string|null, "flags": string|null, "reception": string|null}]
Règles :
- "titre" : auteur + titre de l'ouvrage, sans la lettre de légende (S solde, N nouveauté, T train, R réimpression), que tu mets dans "flags".
- "quantite" : tirage. "mp" : nombre de cahiers (le chiffre qui précède la largeur de la carte de dos). "carte_dos" : largeur de la carte de dos en mm.
- "tete" : couleur de tête (orange, vert, gris clair, gris foncé, bleu, sable…). "peau" : couleur de peau (havane, v. antique, v. émeraude, bleu, r. vénitien, corinthe, violet, gris…).
- Livraison : "date_livraison" si une date précise est lisible, sinon "mois" (AAAA-MM) d'après la rubrique ou la date approximative. Recopie le libellé d'origine dans "livraison_txt". Nous sommes le ${auj} : déduis l'année en conséquence (le planning avance dans le temps).
- "reception" : mention de réception des blocs/papier si présente (ex. « ici », « ici le 09/9 »).
- N'invente rien : mets null quand une valeur est illisible ou absente. Ignore les lignes de total et les en-têtes.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8000, system: systeme, messages: [{ role: 'user', content: [...blocs, { type: 'text', text: 'Voici le planning. Réponds uniquement avec le tableau JSON.' }] }] }),
    });
    if (!res.ok) throw new Error(`Anthropic API: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const d = await res.json();
    const brut = d.content.map((b) => b.text || '').join('').replace(/```json|```/g, '').trim();
    let lues;
    try { lues = JSON.parse(brut); } catch (e) { throw new Error(`Réponse non exploitable de l'IA (document trop long ou illisible ?) : ${brut.slice(0, 160)}`); }
    if (!Array.isArray(lues)) throw new Error('Réponse inattendue de l\'IA.');
    lues = lues.map(normaliserLue).filter((l) => l.titre);

    // ---------- Comparaison avec l'existant ----------
    const { data: existantes, error } = await supabase.from('pleiade_annuel').select('*');
    if (error) throw error;
    const utilisees = new Set();
    const nouveaux = [], modifies = []; let inchanges = 0; const ignores = [];
    for (const l of lues) {
      const nt = norm(l.titre);
      const candidates = existantes.filter((e) => !utilisees.has(e.id));
      const e = candidates.find((x) => norm(x.titre) === nt) || candidates.find((x) => ressemble(norm(x.titre), nt));
      if (!e) { nouveaux.push({ titre: l.titre, champs: Object.fromEntries(Object.entries({ titre: l.titre, quantite: l.quantite, mp: l.mp, carte_dos: l.carte_dos, tete: l.tete, peau: l.peau, mois: l.mois, date_livraison: l.date_livraison, flags: l.flags, reception: l.reception, livraison_txt: l.livraison_txt }).filter(([, v]) => v !== null)), sans_date: !(l.mois || l.date_livraison) }); continue; }
      utilisees.add(e.id);
      if (e.statut === 'fait') { ignores.push({ titre: e.titre, raison: 'déjà fabriqué' }); continue; }
      const diffs = [];
      CHAMPS_LUS.forEach((k) => {
        const nv = l[k]; if (nv === null || nv === undefined) return;
        const ancien = e[k] === undefined ? null : e[k];
        const egal = (k === 'tete' || k === 'peau') ? norm(ancien) === norm(nv) : String(ancien === null ? '' : ancien) === String(nv);
        if (k === 'mois' && l.date_livraison) return;       // la date précise l'emporte
        if (k === 'date_livraison' && ancien === null && e.mois === nv.slice(0, 7)) { /* précision d'une date dans le même mois : modification mineure */ }
        if (!egal) diffs.push({ champ: k, ancien, nouveau: nv });
      });
      if (!diffs.length) { inchanges++; continue; }
      modifies.push({ id: e.id, titre: e.titre, statut: e.statut, diffs, champs: Object.fromEntries(diffs.map((x) => [x.champ, x.nouveau])) });
    }
    const absents = existantes.filter((e) => !utilisees.has(e.id) && e.statut === 'a_produire').map((e) => ({ id: e.id, titre: e.titre, mois: e.mois }));
    return rep(200, { lues: lues.length, nouveaux, modifies, inchanges, ignores, absents });
  } catch (err) {
    console.error('importer-planning-annuel error:', err);
    return rep(500, { error: err.message });
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
