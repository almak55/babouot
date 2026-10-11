// functions/extraire-production.js
//
// POST /.netlify/functions/extraire-production
// body : { file_base64, file_name, mime_type, date?: 'AAAA-MM-JJ' }
//
// Lit un relevé de production (Excel .xlsx/.xls/.csv, PDF, photo) et le rapproche des
// tâches de l'atelier (OF + opération + machine). Le résultat est une PROPOSITION à relire
// dans l'écran de saisie : rien n'est écrit en base par cette fonction.
//
// Réponse : { date, propositions: [ { gamme_id, quantite, pct, termine, heures_reelles, commentaire,
//             texte_source, confiance, tache: {...} } ], non_rapprochees: [ { texte_source, raison } ], notes }
//
// Variables d'environnement : ANTHROPIC_API_KEY (+ SUPABASE_*). Dépendance npm : xlsx.

const { getSupabase } = require('./lib/supabaseclient');

const FORMATS_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const nombre = (v) => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY manquant dans les variables d\'environnement Netlify.' }) };

    const { file_base64, file_name, mime_type, date } = JSON.parse(event.body || '{}');
    if (!file_base64 || !mime_type) return { statusCode: 400, body: JSON.stringify({ error: 'file_base64 et mime_type sont requis.' }) };
    const jour = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : new Date().toISOString().slice(0, 10);

    // ---- 1. Contenu du fichier ----
    let contentBlocks;
    const nomFichier = String(file_name || '');
    const estExcel = /sheet|excel/.test(mime_type) || /\.(xlsx|xls)$/i.test(nomFichier);
    const estCsv = /csv/.test(mime_type) || /\.csv$/i.test(nomFichier);
    if (estExcel || estCsv) {
      const XLSX = require('xlsx');
      const classeur = XLSX.read(Buffer.from(file_base64, 'base64'), { type: 'buffer', cellDates: true });
      const texte = classeur.SheetNames.map((nom) => `--- Feuille "${nom}" ---\n${XLSX.utils.sheet_to_csv(classeur.Sheets[nom], { blankrows: false })}`).join('\n\n');
      if (!texte.replace(/---[^\n]*---/g, '').trim()) return { statusCode: 400, body: JSON.stringify({ error: 'Ce fichier semble vide.' }) };
      contentBlocks = [{ type: 'text', text: `Contenu du fichier "${nomFichier}" :\n\n${texte.slice(0, 120000)}` }];
    } else if (mime_type === 'application/pdf') {
      contentBlocks = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file_base64 } }];
    } else if (FORMATS_IMAGE.includes(mime_type)) {
      contentBlocks = [{ type: 'image', source: { type: 'base64', media_type: mime_type, data: file_base64 } }];
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: `Format non supporté : ${mime_type}. Formats acceptés : Excel (.xlsx/.xls), CSV, PDF, photo.` }) };
    }

    // ---- 2. Tâches candidates (OF actifs, étapes non terminées) ----
    const supabase = getSupabase();
    const { data: gammes, error: gErr } = await supabase.from('gammes_operatoires')
      .select('id, of_id, statut, parametres, avancement_pct, quantite_realisee, operations(nom), machines(nom), ordres_fabrication(numero, quantite, statut, titres(nom, client))')
      .in('statut', ['planifié', 'en cours', 'à planifier']);
    if (gErr) throw gErr;
    const actives = gammes.filter((g) => g.ordres_fabrication && !['terminé', 'annulé'].includes(g.ordres_fabrication.statut)).slice(0, 400);
    if (!actives.length) return { statusCode: 200, body: JSON.stringify({ date: null, propositions: [], non_rapprochees: [], notes: 'Aucune tâche active à rapprocher.' }) };
    const ids = actives.map((g) => g.id);
    const { data: planJour, error: pErr } = await supabase.from('planning_jour').select('gamme_operatoire_id').eq('date', jour).neq('statut', 'annulé').in('gamme_operatoire_id', ids);
    if (pErr) throw pErr;
    const ceJour = new Set(planJour.map((l) => l.gamme_operatoire_id));
    const { data: dejaSaisi, error: sErr } = await supabase.from('production_jour').select('gamme_operatoire_id, date, quantite').in('gamme_operatoire_id', ids);
    if (sErr) throw sErr;

    const liste = actives.map((g) => `${g.id} | ${g.ordres_fabrication.numero} | ${(g.ordres_fabrication.titres && g.ordres_fabrication.titres.nom) || ''} | ${(g.ordres_fabrication.titres && g.ordres_fabrication.titres.client) || ''} | ${g.operations ? g.operations.nom : ''} | ${g.machines ? g.machines.nom : 'sans machine'} | ${ceJour.has(g.id) ? 'planifiée ce jour' : '-'}`).join('\n');

    const systemPrompt = `Tu lis un relevé de production d'un atelier de reliure industrielle (tableau Excel, PDF, photo) et tu le rapproches des tâches connues de l'atelier. Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans balises markdown :
{
  "date": string | null,            // date de production lue dans le document (AAAA-MM-JJ, année ${new Date().getFullYear()} par défaut), null si absente
  "lignes": [ {
    "gamme_id": string | null,      // identifiant EXACT pris dans la liste ci-dessous, null si aucune tâche ne correspond
    "texte_source": string,         // la ligne ou les cellules lues, abrégées
    "quantite": number | null,      // quantité produite (en exemplaires de l'OF)
    "quantite_est_cumul": boolean,  // true si la quantité est un cumul depuis le début de la tâche et non la production du jour
    "pct": number | null,           // avancement en % si le document en donne un (0-100)
    "termine": boolean,             // true si la tâche est indiquée terminée / soldée
    "heures_reelles": number | null,
    "commentaire": string | null,
    "confiance": "haute" | "moyenne" | "basse"
  } ],
  "notes": string                   // en français : points douteux, colonnes ignorées, unités différentes...
}
Règles :
- Rapproche chaque ligne du document avec UNE tâche de la liste : même numéro d'OF ou même titre, et opération/machine concordantes. Prends en compte les noms abrégés ou approximatifs (ex. « BDM » pour la machine, « pliure » pour une opération). En cas de doute, gamme_id = null et confiance basse.
- Si une tâche de la liste est marquée « planifiée ce jour » et que le document n'indique pas l'opération avec certitude, privilégie-la.
- Ne crée jamais d'identifiant. N'invente aucune quantité : null si absente.
- Si la quantité est exprimée dans une autre unité que des exemplaires (cahiers, feuilles, mètres...), ne la convertis pas : quantite = null et explique-le dans commentaire.
- Ignore les lignes de total, d'en-tête et les lignes vides.

Tâches de l'atelier (gamme_id | OF | titre | client | opération | machine | planning) :
${liste}`;

    const rep = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 4096, system: systemPrompt,
        messages: [{ role: 'user', content: [...contentBlocks, { type: 'text', text: 'Voici le relevé de production à analyser. Réponds uniquement avec le JSON demandé.' }] }],
      }),
    });
    if (!rep.ok) throw new Error(`Anthropic API: ${rep.status} ${await rep.text()}`);
    const donnees = await rep.json();
    const brut = donnees.content.map((b) => b.text || '').join('').replace(/```json|```/g, '').trim();
    let lu;
    try { lu = JSON.parse(brut); } catch (e) { throw new Error(`Réponse non exploitable de l'IA : ${brut.slice(0, 200)}`); }

    // ---- 3. Validation et conversion ----
    const parId = Object.fromEntries(actives.map((g) => [g.id, g]));
    const dateDoc = /^\d{4}-\d{2}-\d{2}$/.test(lu.date || '') ? lu.date : null;
    const dateEffective = dateDoc || jour;
    const propositions = new Map();
    const nonRapprochees = [];
    (Array.isArray(lu.lignes) ? lu.lignes : []).forEach((l) => {
      const g = parId[l.gamme_id];
      if (!g) { nonRapprochees.push({ texte_source: l.texte_source || '', raison: 'Aucune tâche de l\'atelier ne correspond.' }); return; }
      let quantite = nombre(l.quantite);
      if (quantite !== null && l.quantite_est_cumul) {
        const avant = dejaSaisi.filter((x) => x.gamme_operatoire_id === g.id && x.date !== dateEffective).reduce((t, x) => t + Number(x.quantite), 0);
        quantite = Math.max(0, quantite - avant);
      }
      const pct = nombre(l.pct);
      const prec = propositions.get(g.id);
      const o = g.ordres_fabrication;
      const totalQte = nombre(g.parametres && g.parametres.quantite) || o.quantite;
      const p = prec || {
        gamme_id: g.id, quantite: null, pct: null, termine: false, heures_reelles: null, commentaire: null, texte_source: '', confiance: 'haute',
        tache: {
          gamme_id: g.id, of_id: g.of_id, of: o.numero, titre: (o.titres && o.titres.nom) || '', client: (o.titres && o.titres.client) || '',
          operation: g.operations ? g.operations.nom : '', machine: g.machines ? g.machines.nom : 'Travail manuel', debut: null, fin: null, personnel: [],
          quantite_totale: totalQte || null, avancement_pct: Number(g.avancement_pct || 0), quantite_realisee: Number(g.quantite_realisee || 0), statut: g.statut, saisie: null,
        },
      };
      if (quantite !== null) p.quantite = (p.quantite || 0) + quantite;
      if (pct !== null && pct >= 0 && pct <= 100) p.pct = pct;
      if (l.termine) p.termine = true;
      if (nombre(l.heures_reelles) !== null) p.heures_reelles = (p.heures_reelles || 0) + nombre(l.heures_reelles);
      if (l.commentaire) p.commentaire = p.commentaire ? `${p.commentaire} ; ${l.commentaire}` : l.commentaire;
      p.texte_source = p.texte_source ? `${p.texte_source} / ${l.texte_source || ''}` : (l.texte_source || '');
      const ordre = { haute: 0, moyenne: 1, basse: 2 };
      if ((ordre[l.confiance] ?? 2) > (ordre[p.confiance] ?? 0)) p.confiance = l.confiance || 'basse';
      propositions.set(g.id, p);
    });

    return { statusCode: 200, body: JSON.stringify({ date: dateDoc, propositions: Array.from(propositions.values()), non_rapprochees: nonRapprochees, notes: lu.notes || '' }) };
  } catch (e) {
    console.error('extraire-production error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || String(e) }) };
  }
};
