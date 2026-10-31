// functions/analyser-fiche.js
//
// POST /.netlify/functions/analyser-fiche
// body : { file_base64: "...", file_name: "fiche.pdf", mime_type: "application/pdf" }
//
// Accepte une photo (jpeg/png/webp), un PDF, un Word (.docx) ou un
// Excel (.xlsx/.xls) représentant une fiche de fabrication ou une
// fiche suiveuse, et en extrait : titre, client, quantité, délai, et
// les opérations concernées (parmi celles déjà dans vos référentiels).
// Le résultat est une PROPOSITION à relire dans le formulaire avant
// de créer l'OF — rien n'est écrit en base par cette fonction.
//
// Variables d'environnement requises en plus de SUPABASE_* :
//   ANTHROPIC_API_KEY
//
// Dépendances npm nécessaires (voir package.json) : mammoth, xlsx

const { getSupabase } = require('./lib/supabaseclient');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

const FORMATS_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const handlerProtege = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée, utiliser POST.' }) };
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY manquant dans les variables d\'environnement Netlify.' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { file_base64, file_name, mime_type } = body;
    if (!file_base64 || !mime_type) {
      return { statusCode: 400, body: JSON.stringify({ error: 'file_base64 et mime_type sont requis.' }) };
    }

    const supabase = getSupabase();
    const { data: operations, error: opsError } = await supabase
      .from('operations').select('code, nom').order('ordre_defaut');
    if (opsError) throw opsError;
    const typesRes = await supabase.from('types_production').select('code, libelle').order('ordre');
    const typesProd = typesRes.error ? [] : (typesRes.data || []);
    const carRes = await supabase.from('caracteristiques_produit').select('cle, libelle, type, unite').order('ordre');
    const catalogueCar = carRes.error ? [] : (carRes.data || []);

    // ------------------------------------------------------------
    // 1. Construire le contenu à envoyer à Claude selon le format.
    //    - image : bloc "image" (lecture visuelle directe)
    //    - pdf   : bloc "document" (Claude lit le PDF nativement)
    //    - docx  : texte extrait côté serveur (mammoth)
    //    - xlsx/xls : texte (CSV) extrait côté serveur (xlsx/SheetJS)
    // ------------------------------------------------------------
    let contentBlocks;

    if (FORMATS_IMAGE.includes(mime_type)) {
      contentBlocks = [
        { type: 'image', source: { type: 'base64', media_type: mime_type, data: file_base64 } },
      ];
    } else if (mime_type === 'application/pdf') {
      contentBlocks = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file_base64 } },
      ];
    } else if (
      mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mime_type === 'application/msword'
    ) {
      const buffer = Buffer.from(file_base64, 'base64');
      const { value: texte } = await mammoth.extractRawText({ buffer });
      if (!texte || !texte.trim()) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Impossible d\'extraire du texte de ce fichier Word (document vide ou non lisible).' }) };
      }
      contentBlocks = [{ type: 'text', text: `Contenu du document Word "${file_name || ''}" :\n\n${texte}` }];
    } else if (
      mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mime_type === 'application/vnd.ms-excel'
    ) {
      const buffer = Buffer.from(file_base64, 'base64');
      const classeur = XLSX.read(buffer, { type: 'buffer' });
      const texte = classeur.SheetNames.map((nom) => {
        const feuille = classeur.Sheets[nom];
        const csv = XLSX.utils.sheet_to_csv(feuille);
        return `--- Feuille "${nom}" ---\n${csv}`;
      }).join('\n\n');
      if (!texte.trim()) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Ce fichier Excel semble vide.' }) };
      }
      contentBlocks = [{ type: 'text', text: `Contenu du fichier Excel "${file_name || ''}" :\n\n${texte}` }];
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Format non supporté : ${mime_type}. Formats acceptés : image (jpg/png/webp), PDF, Word (.docx), Excel (.xlsx/.xls).` }),
      };
    }

    const listeOperations = operations.map(o => `${o.code} = ${o.nom}`).join('\n');
    const anneeCourante = new Date().getFullYear();

    const systemPrompt = `Tu extrais des informations structurées depuis un document d'atelier de reliure industrielle (fiche de fabrication, fiche suiveuse, bon de commande...), fourni en photo, PDF, ou texte extrait d'un fichier Word/Excel. Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant/après, sans balises markdown, selon exactement ce schéma :
{
  "titre": string | null,
  "client": string | null,
  "quantite": number | null,
  "delai": string | null,
  "type_production": string | null,
  "caracteristiques": { [cle: string]: number | string },
  "operation_codes": string[],
  "confiance": "haute" | "moyenne" | "basse",
  "notes": string
}

Règles :
- "titre" : le titre de l'ouvrage (souvent après "TITRE" ou dans l'en-tête).
- "client" : l'éditeur ou le client (souvent après "EDITEUR", "AUTEUR" ou le nom en haut du document).
- "quantite" : le tirage ou la quantité à relier (cherche "Tirage", "Quantité à relier"). Un seul nombre entier, sans texte autour.
- "delai" : une date de livraison si présente (cherche "Livraison le", "LIVRAISON"), au format AAAA-MM-JJ. Si seuls jour/mois sont donnés, utilise l'année ${anneeCourante}. null si aucune date trouvée.
- "type_production" : ${typesProd.length ? `uniquement si la fiche indique explicitement le type de travail, un code parmi : ${typesProd.map(t => `${t.code} (${t.libelle})`).join(', ')}` : 'toujours null'} ; sinon null. N'en déduis pas à partir du seul nom de l'éditeur.
- "caracteristiques" : les valeurs techniques lues sur la fiche, uniquement pour les clés de cette liste (clé = libellé [unité]) :
${catalogueCar.length ? catalogueCar.map(c => `  ${c.cle} = ${c.libelle}${c.unite ? ' [' + c.unite + ']' : ''}${c.type === 'texte' ? ' (texte)' : ' (nombre)'}`).join('\n') : '  (aucune)'}
  N'inclus que les valeurs clairement présentes (ex. grammage du papier, nombre de cahiers, nombre de coupes) ; objet vide {} sinon. Nombres sans unité ni texte autour.
- "operation_codes" : uniquement des codes choisis dans la liste ci-dessous, correspondant aux opérations clairement indiquées comme applicables (mention "oui", case cochée, quantité renseignée). N'invente aucun code hors de cette liste. Dans l'ordre le plus plausible d'une gamme de fabrication.
- "confiance" : "haute" si l'essentiel est net et lisible, "moyenne" si certains champs sont incertains, "basse" si le document est difficile à exploiter.
- "notes" : une phrase en français signalant les champs douteux, illisibles, ou les opérations non rattachées à la liste.

Liste des opérations disponibles (code = nom) :
${listeOperations}`;

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [
            ...contentBlocks,
            { type: 'text', text: 'Voici le document à analyser. Réponds uniquement avec le JSON demandé.' },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      throw new Error(`Anthropic API: ${anthropicRes.status} ${errText}`);
    }
    const anthropicData = await anthropicRes.json();
    const texteReponse = anthropicData.content.map((b) => b.text || '').join('');
    const nettoye = texteReponse.replace(/```json|```/g, '').trim();

    let resultat;
    try { resultat = JSON.parse(nettoye); }
    catch (e) { throw new Error(`Réponse non exploitable de l'IA : ${nettoye.slice(0, 200)}`); }

    const codesValides = new Set(operations.map(o => o.code));
    resultat.operation_codes = (resultat.operation_codes || []).filter(c => codesValides.has(c));
    if (!typesProd.some((t) => t.code === resultat.type_production)) resultat.type_production = null;
    // Emboîtage par défaut (tranchefile/signet + finitions ; toujours pour un OF Pléiade) et assemblage avant la couture : voir lib/emboitage.js
    const emb = require('./lib/emboitage').completer(resultat.operation_codes, operations, { type_production: resultat.type_production, couleur_peau: (resultat.caracteristiques || {}).couleur_peau });
    resultat.operation_codes = emb.codes;
    [emb.ajoute_assemblage, emb.ajoute_paves, emb.ajoute].filter(Boolean).forEach((x) => { resultat.notes = [resultat.notes, `« ${x.nom} » ajouté automatiquement (${x.raison}).`].filter(Boolean).join(' '); });
    // Caractéristiques : on ne garde que les clés du catalogue, valeurs converties selon leur type.
    const propres = {};
    Object.entries(resultat.caracteristiques || {}).forEach(([cle, val]) => {
      const def = catalogueCar.find((c) => c.cle === cle);
      if (!def || val === null || val === undefined || String(val).trim() === '') return;
      if (def.type === 'texte') { propres[cle] = String(val).trim(); return; }
      const n = Number(String(val).replace(',', '.').replace(/[^0-9.\-]/g, ''));
      if (Number.isFinite(n)) propres[cle] = n;
    });
    resultat.caracteristiques = propres;

    return { statusCode: 200, body: JSON.stringify(resultat) };
  } catch (err) {
    console.error('analyser-fiche error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

// Accès réservé aux utilisateurs connectés (voir lib/auth.js).
exports.handler = require('./lib/auth').avecAuth(handlerProtege);
