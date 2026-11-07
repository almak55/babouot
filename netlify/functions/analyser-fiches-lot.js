// functions/analyser-fiches-lot.js
//
// POST /.netlify/functions/analyser-fiches-lot
// body : { pages: [{ image_base64, mime_type, page }] }   (1 à 3 pages à la fois, déjà converties en image par le navigateur)
//
// Lit des fiches de fabrication scannées (une ou plusieurs par appel) et renvoie, pour chacune, une PROPOSITION :
//   { page, titre, client, quantite, delai, delai_libelle, reception: { etat: 'ici'|'date'|'inconnue', date },
//     type_production, caracteristiques, operation_codes, confiance, notes }
// Rien n'est écrit en base. Le navigateur envoie les pages une par une (limite de 10 s par fonction Netlify)
// puis classe les fiches, vous laisse corriger, et crée les OF via creer-ordre.
//
// Variable d'environnement : ANTHROPIC_API_KEY

const { getSupabase } = require('./lib/supabaseclient');

const iso = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') && !Number.isNaN(Date.parse(d)) ? d : null);

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY manquant dans les variables d\'environnement Netlify.' }) };
    const body = JSON.parse(event.body || '{}');
    const pages = Array.isArray(body.pages) ? body.pages.filter((p) => p && p.image_base64) : [];
    if (!pages.length) return { statusCode: 400, body: JSON.stringify({ error: 'pages (images) requises.' }) };
    if (pages.length > 3) return { statusCode: 400, body: JSON.stringify({ error: '3 pages maximum par appel.' }) };

    const supabase = getSupabase();
    const [opsRes, typesRes, carRes] = await Promise.all([
      supabase.from('operations').select('code, nom').order('ordre_defaut'),
      supabase.from('types_production').select('code, libelle').order('ordre'),
      supabase.from('caracteristiques_produit').select('cle, libelle, type, unite').order('ordre'),
    ]);
    if (opsRes.error) throw opsRes.error;
    const operations = opsRes.data;
    const typesProd = typesRes.error ? [] : (typesRes.data || []);
    const catalogueCar = carRes.error ? [] : (carRes.data || []);
    const aujourdhui = new Date().toISOString().slice(0, 10);
    const annee = aujourdhui.slice(0, 4);

    const systemPrompt = `Tu lis des FICHES DE FABRICATION scannées d'un atelier de reliure industrielle. Chaque image est une page ; une page = en principe une fiche (en-tête « FICHE DE FABRICATION »). Si une page est la suite d'une fiche précédente (pas d'en-tête, pas de titre), mets "suite": true. Si la page n'est pas une fiche (page blanche, couverture), mets "fiche": false.
Réponds UNIQUEMENT avec un JSON valide, sans texte autour ni balises markdown : { "fiches": [ ... ] } avec exactement un objet par image reçue, dans l'ordre des images, de la forme :
{
  "page": number,                       // numéro de la page indiqué avant l'image
  "fiche": boolean, "suite": boolean,
  "titre": string | null,
  "client": string | null,
  "quantite": number | null,
  "delai": string | null,               // AAAA-MM-JJ
  "delai_libelle": string | null,       // texte exact lu (ex. « Mise à dispo : 20/11/2026 »)
  "reception_etat": "ici" | "date" | "inconnue",
  "reception_date": string | null,      // AAAA-MM-JJ si une date est écrite
  "type_production": string | null,
  "caracteristiques": { [cle: string]: number | string },
  "composition": [ { "pages": number, "cahiers": number, "poses": number | null } ],
  "operation_codes": string[],
  "confiance": "haute" | "moyenne" | "basse",
  "notes": string
}
Règles :
- "titre" : après « TITRE ». "client" : après « EDITEUR » ou « CLIENT ».
- "quantite" : le tirage (« Tirage : 500 ex + 2 justificatifs » → 500 ; « 9300 couvertures » → 9300). Nombre entier, sans les justificatifs.
- "delai" = date de LIVRAISON ou de MISE À DISPOSITION (« LIVRAISON LE », « Mise à dispo (le) »). Les mentions du type « RDSL », « ici », un mot sans date, ou un champ vide → null. Si seuls jour et mois sont écrits, année ${annee} (ou ${Number(annee) + 1} si la date serait déjà passée de plus de 2 mois). Dates françaises : JJ/MM/AAAA.
- « Réception du papier » : "ici" si écrit « ici » (papier déjà reçu à l'atelier) ; "date" avec reception_date si une date est écrite (« 28-oct » → ${annee}-10-28 ; « le 02/10/2025 » → 2025-10-02) ; "inconnue" si le champ est vide. Ne confonds JAMAIS cette date avec la date de livraison.
- "type_production" : ${typesProd.length ? `seulement si la fiche l'indique explicitement, un code parmi : ${typesProd.map((t) => `${t.code} (${t.libelle})`).join(', ')}` : 'toujours null'} ; sinon null.
- "caracteristiques" : valeurs techniques lues, uniquement pour ces clés (clé = libellé [unité]) :
${catalogueCar.length ? catalogueCar.map((c) => `  ${c.cle} = ${c.libelle}${c.unite ? ' [' + c.unite + ']' : ''}${c.type === 'texte' ? ' (texte)' : ' (nombre)'}`).join('\n') : '  (aucune)'}
  Nombres sans unité ; objet vide {} si rien de clair.
- "composition" : la composition EXACTE de l'intérieur du livre telle qu'écrite sur la fiche, une ligne par pagination différente : "pages" = nombre de pages du cahier (4, 8, 16, 32…), "cahiers" = combien de cahiers de cette pagination composent UN exemplaire, "poses" = nombre de cahiers identiques imprimés sur une même feuille (« 2 poses », « 16 poses ») si la fiche l'indique, sinon null. Tableau vide [] si la fiche ne détaille pas les cahiers. Ne compte pas les couvertures, gardes ni hors-texte.
- "operation_codes" : codes choisis UNIQUEMENT dans la liste ci-dessous, pour les opérations demandées par la fiche, dans l'ordre plausible d'une gamme. Chaque ligne de la fiche est une opération demandée si elle est à « oui » ou renseignée, et exclue si « non » : Cousu, Encollé, Dos carré / Dos rond, Signet, Tranchefile, Carton, Dorure, Perfo, Film, Passage coupe 3 faces / Coupe massicot, Pliage (« A plier »), Finition (mise sous film, étuis, mise en caisse, mise sur palette). N'invente aucun code.
- "confiance" : "haute" si net, "moyenne" si des champs sont incertains, "basse" si difficile à lire.
- "notes" : une phrase en français sur les champs douteux ou les mentions sans code correspondant (ex. « ATTENTION MODELE : LIVRE LECTURE INVERSEE »).

Opérations disponibles (code = nom) :
${operations.map((o) => `${o.code} = ${o.nom}`).join('\n')}`;

    const content = [];
    pages.forEach((p, i) => {
      content.push({ type: 'text', text: `Page ${p.page ?? i + 1} :` });
      content.push({ type: 'image', source: { type: 'base64', media_type: p.mime_type || 'image/jpeg', data: p.image_base64 } });
    });
    content.push({ type: 'text', text: 'Réponds uniquement avec le JSON demandé.' });

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, system: systemPrompt, messages: [{ role: 'user', content }] }),
    });
    if (!res.ok) throw new Error(`Anthropic API: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const texte = data.content.map((b) => b.text || '').join('').replace(/```json|```/g, '').trim();
    let parse;
    try { parse = JSON.parse(texte); } catch (e) { throw new Error(`Réponse non exploitable de l'IA : ${texte.slice(0, 200)}`); }
    const brutes = Array.isArray(parse) ? parse : (parse.fiches || []);

    const codesValides = new Set(operations.map((o) => o.code));
    const fiches = brutes.map((f, i) => {
      const propres = {};
      Object.entries(f.caracteristiques || {}).forEach(([cle, val]) => {
        const def = catalogueCar.find((c) => c.cle === cle);
        if (!def || val === null || val === undefined || String(val).trim() === '') return;
        if (def.type === 'texte') { propres[cle] = String(val).trim(); return; }
        const n = Number(String(val).replace(',', '.').replace(/[^0-9.\-]/g, ''));
        if (Number.isFinite(n)) propres[cle] = n;
      });
      // Composition du livre (cahiers, paginations, poses) -> calcul précis de la refente au massicot droit.
      let noteComposition = '';
      if (catalogueCar.some((c) => c.cle === 'composition_cahiers')) noteComposition = require('./lib/refente').integrerCompositionFiche(f.composition, propres);
      const etat = ['ici', 'date', 'inconnue'].includes(f.reception_etat) ? f.reception_etat : 'inconnue';
      // Emboîtage par défaut (tranchefile/signet + finitions ; toujours pour un OF Pléiade) et assemblage avant la couture : voir lib/emboitage.js
      const typeProd = typesProd.some((t) => t.code === f.type_production) ? f.type_production : null;
      const emb = require('./lib/emboitage').completer((f.operation_codes || []).filter((c) => codesValides.has(c)), operations, { type_production: typeProd, couleur_peau: (f.caracteristiques || {}).couleur_peau });
      const recDate = iso(f.reception_date);
      return {
        page: f.page ?? (pages[i] && pages[i].page) ?? i + 1,
        fiche: f.fiche !== false, suite: !!f.suite,
        titre: f.titre ? String(f.titre).trim() : null,
        client: f.client ? String(f.client).trim() : null,
        quantite: Number.isFinite(Number(f.quantite)) && Number(f.quantite) > 0 ? Math.round(Number(f.quantite)) : null,
        delai: iso(f.delai), delai_libelle: f.delai_libelle || null,
        reception: { etat: etat === 'date' && !recDate ? 'inconnue' : etat, date: recDate },
        type_production: typesProd.some((t) => t.code === f.type_production) ? f.type_production : null,
        caracteristiques: propres,
        operation_codes: emb.codes,
        emboitage_auto: emb.ajoute, assemblage_auto: emb.ajoute_assemblage, signes_emboitage: emb.signes, emboitage_code: emb.emboitage_code, assemblage_code: emb.assemblage_code,
        confiance: ['haute', 'moyenne', 'basse'].includes(f.confiance) ? f.confiance : 'moyenne',
        notes: [f.notes, noteComposition, ...[emb.ajoute_assemblage, emb.ajoute_paves, emb.ajoute].filter(Boolean).map((x) => `« ${x.nom} » ajouté automatiquement (${x.raison}).`)].filter(Boolean).join(' '),
      };
    });
    return { statusCode: 200, body: JSON.stringify({ fiches, aujourdhui }) };
  } catch (e) {
    console.error('analyser-fiches-lot error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || String(e) }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
