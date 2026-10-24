import Anthropic from "@anthropic-ai/sdk";
import { isExtractedSiteData, type StoredExtractedData } from "./site-data";
import { UNBOUNDED, type Deadline } from "./deadline";

export class ExtractionError extends Error {
  /**
   * `cause` est déclaré et assigné ici plutôt que par une « parameter property » : c'est la
   * seule construction purement TypeScript que le mode strip-only de Node refuse, et ce
   * module doit rester importable par `node --test` et par les scripts de mesure du
   * pipeline. Même contournement que PerplexityError. Comportement inchangé.
   */
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ExtractionError";
    this.cause = cause;
  }
}

let cachedClient: Anthropic | null = null;

// Constructed lazily (not at module load) so importing this file never throws when
// ANTHROPIC_API_KEY is unset — only calling extractSiteData/classifyPositioning does.
function getClient(): Anthropic {
  if (!cachedClient) {
    cachedClient = new Anthropic();
  }
  return cachedClient;
}

// Sonnet 5 rather than Opus 5: this is schema-constrained extraction from already-cleaned
// text, not open-ended reasoning — the task Sonnet is built for, at $2/$10 per MTok instead
// of $5/$25 (roughly half the cost of a full comparison run). Haiku 4.5 would be cheaper
// still, but it supports neither `effort` nor structured outputs (both used below), and its
// retirement window opens 2026-10-15.
const EXTRACTION_MODEL = "claude-sonnet-5";

/**
 * Délais par défaut, bornés en plus par le budget de l'analyse (voir deadline.ts).
 *
 * Le SDK TypeScript compte en MILLISECONDES, et son défaut est de 10 minutes — un appel
 * bloqué y restait donc bien au-delà de la patience de l'utilisateur. Mesuré sur deux paires
 * réelles, l'extraction répond en 1,5 à 5 s une fois le texte plafonné ; 20 s laissent la
 * marge d'un cas lourd sans autoriser un décrochage.
 */
const EXTRACTION_TIMEOUT_MS = 20_000;
const CLASSIFIER_TIMEOUT_MS = 8_000;

/**
 * Ce sont des PLAFONDS, pas des délais effectifs : `capTimeout` rend le plus court entre
 * cette valeur et ce qui reste du budget, divisé par le nombre de tentatives. Sur un budget
 * neuf de 26 s, l'extraction reçoit donc 13 s par tentative et non 20 — mesurée entre 1,5 et
 * 7 s, elle tient largement.
 */

/**
 * Réessais : le SDK en fait DEUX par défaut, et un appel qui expire est réessayé — le pire
 * cas réel valait donc trois fois le délai. L'extraction en garde un (une limite de débit
 * passagère ne doit pas faire échouer toute l'analyse), le classificateur aucun : son échec
 * se solde par « pas d'écart de positionnement », ce qui est déjà son comportement de repli.
 */
const EXTRACTION_MAX_RETRIES = 1;
const CLASSIFIER_MAX_RETRIES = 0;

/**
 * Sortie contrainte par schéma (« structured outputs »), plutôt qu'un schéma décrit en
 * prose dans le prompt et espéré en retour.
 *
 * Deux gains, et le second est la raison d'être du premier :
 *   - la réponse est un JSON valide conforme au schéma par construction. Le mode d'échec
 *     « Claude a répondu autre chose que du JSON » disparaît, et avec lui une analyse
 *     entière perdue sur une virgule ;
 *   - la réflexion du modèle peut donc être coupée sans risque. C'était le poste de latence
 *     dominant du pipeline : 9,3 s mesurées sur une page de tarifs volumineuse. Une
 *     extraction depuis un texte déjà nettoyé n'a rien à délibérer, et sans la garantie du
 *     schéma, couper la réflexion aurait ouvert la porte à de la prose avant le JSON.
 *
 * `additionalProperties: false` et un `required` complet : un champ inventé ou manquant doit
 * être refusé par le schéma, pas rattrapé plus loin par isExtractedSiteData — lequel reste
 * en place, parce qu'un relevé relu depuis la base n'est pas passé par ce schéma.
 */
const EXTRACTION_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "pricing_tiers",
      "has_free_trial",
      "has_free_tier",
      "value_proposition",
      "target_audience",
    ],
    properties: {
      pricing_tiers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "price", "features"],
          properties: {
            name: { type: "string" },
            price: { type: "string" },
            /*
              Plafonné à quatre entrées — mais par le PROMPT, pas ici : l'API refuse
              `maxItems` sur un tableau en sortie contrainte (« For 'array' type, property
              'maxItems' is not supported », 400). La borne est donc une consigne, vérifiée
              à l'usage, et non une garantie de schéma.

              C'est une borne de LATENCE. Les tokens produits sont ce qui coûte du temps
              ici : avec la liste exhaustive des fonctionnalités de chaque palier, une page
              de tarifs fournie (Notion, ClickUp) fait écrire des milliers de tokens de
              JSON, soit plusieurs secondes d'attente par site. Or ce champ n'est lu par
              RIEN — aucune règle de detect-gaps, aucune ligne du relevé comparé, aucun
              écran. Il est conservé parce que les relevés déjà en base le portent et que le
              garde isPricingTier l'exige, pas parce qu'il sert.

              Conséquence à connaître : ce tableau est un ÉCHANTILLON, jamais une liste
              exhaustive. Toute règle future qui en déduirait « ce palier n'inclut pas X »
              serait fausse.
            */
            features: { type: "array", items: { type: "string" } },
          },
        },
      },
      has_free_trial: { type: "boolean" },
      has_free_tier: { type: "boolean" },
      value_proposition: { type: "string" },
      target_audience: { type: "string" },
    },
  },
} as const satisfies Anthropic.JSONOutputFormat;

const POSITIONING_FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["very_different"],
    properties: { very_different: { type: "boolean" } },
  },
} as const satisfies Anthropic.JSONOutputFormat;

/**
 * Both prompts below demand bare JSON, but a model can still wrap its answer in a markdown
 * fence. Stripping it here costs nothing and turns an avoidable "invalid JSON" failure into
 * a successful parse; anything else is left untouched so genuinely malformed output still
 * fails loudly rather than being silently patched up.
 */
function stripCodeFence(text: string): string {
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/i.exec(text.trim());
  return fenced ? fenced[1].trim() : text;
}

const EXTRACTION_SYSTEM_PROMPT = `Tu es un extracteur de données factuelles pour Rivalys, un outil qui compare des sites de SaaS entre eux à partir de leurs pages publiques.

Réponds EXCLUSIVEMENT avec un objet JSON valide, sans aucun texte avant ou après, sans balises markdown (pas de \`\`\`), correspondant EXACTEMENT à ce schéma :
{
  "pricing_tiers": [{ "name": "string", "price": "string", "features": ["string"] }],
  "has_free_trial": true,
  "has_free_tier": false,
  "value_proposition": "string",
  "target_audience": "string"
}

Règles strictes, à respecter absolument :
- N'invente et ne devine JAMAIS de donnée. Si une information n'est pas explicitement visible dans le texte fourni, utilise un tableau vide, false, ou une chaîne vide plutôt que de supposer.
- "pricing_tiers" ne doit contenir que les paliers explicitement listés dans le texte, avec leur nom et leur prix tels qu'affichés (garde le prix sous forme de texte, ex: "29€/mois", "Sur devis").
- "features" ne prend QUE les quatre fonctionnalités les plus distinctives de chaque palier, au maximum — pas la liste complète. N'invente rien pour atteindre quatre : moins est correct.
- "has_free_trial" doit être true UNIQUEMENT si le texte mentionne explicitement un essai gratuit (ex: "essai gratuit", "free trial", "14 jours d'essai").
- "has_free_tier" doit être true UNIQUEMENT si un palier de pricing gratuit et utilisable en continu est explicitement proposé (différent d'un essai limité dans le temps).
- "value_proposition" est une courte phrase factuelle résumant la promesse principale mise en avant sur le site (pas une opinion).
- "target_audience" est une courte phrase factuelle décrivant le public visé tel qu'il ressort du texte (ex: "équipes marketing B2B", "freelances").`;

function buildExtractionUserPrompt(input: {
  homepageText: string;
  pricingText: string | null;
  pricingPageFound: boolean;
}): string {
  const intro = input.pricingPageFound
    ? "Voici le contenu textuel de la page d'accueil et de la page de pricing d'un site SaaS."
    : "Voici uniquement le contenu textuel de la page d'accueil d'un site SaaS — aucune page de pricing dédiée (/pricing, /plans, /tarifs, /prix) n'a pu être trouvée. Base ton extraction uniquement sur ce contenu ; si les informations de pricing ne sont pas visibles ici, retourne pricing_tiers: [] et has_free_trial / has_free_tier: false plutôt que de deviner.";

  const sections = [
    intro,
    "\n--- PAGE D'ACCUEIL ---\n" + input.homepageText,
    input.pricingText ? "\n--- PAGE PRICING ---\n" + input.pricingText : "",
  ];

  return sections.join("\n");
}

function extractTextBlock(content: Anthropic.ContentBlock[]): string | null {
  const block = content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return block ? block.text.trim() : null;
}

/** Wraps a Claude Messages API call with the RateLimit -> Authentication -> APIError chain. */
async function callClaude(
  params: Anthropic.MessageCreateParamsNonStreaming,
  options: { timeout: number; maxRetries: number },
): Promise<Anthropic.Message> {
  try {
    // `timeout` est en millisecondes dans le SDK TypeScript, et il s'applique à CHAQUE
    // tentative : le pire cas vaut timeout × (maxRetries + 1), d'où un plafond de réessais
    // volontairement bas.
    return await getClient().messages.create(params, options);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      throw new ExtractionError(
        "Limite de débit atteinte sur l'API Claude — réessaie dans quelques instants.",
        err,
      );
    }
    if (err instanceof Anthropic.AuthenticationError) {
      throw new ExtractionError("Authentification à l'API Claude invalide (clé API manquante ou incorrecte).", err);
    }
    if (err instanceof Anthropic.APIError) {
      throw new ExtractionError(`Erreur de l'API Claude : ${err.message}`, err);
    }
    throw new ExtractionError("Erreur réseau lors de l'appel à l'API Claude.", err);
  }
}

/**
 * Sends cleaned homepage (+ optional pricing page) text to Claude for structured
 * extraction. Never fabricates data on failure: any parse/schema/refusal failure throws
 * ExtractionError instead of returning a best-guess object, so the caller can skip
 * persisting a snapshot for this site rather than storing invented data.
 */
export async function extractSiteData(
  input: {
    homepageText: string;
    pricingText: string | null;
    pricingPageFound: boolean;
  },
  deadline: Deadline = UNBOUNDED,
): Promise<StoredExtractedData> {
  const response = await callClaude(
    {
      model: EXTRACTION_MODEL,
      // Large enough for a pricing-rich page: multiple tiers, each with a feature list, from
      // up to MAX_CLEANED_TEXT_LENGTH=15000 chars of input. Hitting the cap truncates the
      // JSON, and a truncated response fails the schema instead of saying it ran out.
      max_tokens: 8000,
      // Réflexion coupée : l'extraction lit un texte déjà nettoyé et remplit un schéma, elle
      // n'a rien à délibérer. C'était le poste de latence dominant du pipeline. Explicite et
      // non omis : sur claude-sonnet-5, omettre `thinking` ACTIVE le mode adaptatif.
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: EXTRACTION_FORMAT },
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildExtractionUserPrompt(input) }],
    },
    {
      // Divisé par le nombre de tentatives : le SDK réapplique ce même délai au réessai.
      timeout: deadline.capTimeout(EXTRACTION_TIMEOUT_MS, EXTRACTION_MAX_RETRIES + 1),
      maxRetries: EXTRACTION_MAX_RETRIES,
    },
  );

  if (response.stop_reason === "refusal") {
    throw new ExtractionError("Claude a refusé d'extraire les données de ce site.");
  }

  const text = extractTextBlock(response.content);
  if (!text) {
    throw new ExtractionError("Aucune réponse texte reçue de Claude pour l'extraction.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch (err) {
    throw new ExtractionError("La réponse de Claude n'est pas un JSON valide.", err);
  }

  if (!isExtractedSiteData(parsed)) {
    throw new ExtractionError("La réponse de Claude ne correspond pas au schéma d'extraction attendu.");
  }

  return { ...parsed, pricing_page_found: input.pricingPageFound };
}

const POSITIONING_SYSTEM_PROMPT =
  'Tu compares deux propositions de valeur de produits SaaS pour juger si leur positionnement est très différent (public visé, angle marketing, promesse principale). Réponds EXCLUSIVEMENT avec un objet JSON valide de la forme {"very_different": true} ou {"very_different": false}, sans aucun autre texte ni balise markdown.';

/**
 * Single lightweight classification call for the positioning rule. Best-effort signal for
 * a low-priority gap only — on any failure (network, refusal, malformed JSON) this resolves
 * to `false` (no gap) rather than throwing, so a classifier hiccup never fails the whole
 * comparison pipeline.
 */
export async function classifyPositioning(
  ownValueProposition: string,
  competitorValueProposition: string,
  deadline: Deadline = UNBOUNDED,
): Promise<boolean> {
  if (!ownValueProposition.trim() || !competitorValueProposition.trim()) return false;

  // Étage optionnel : il n'alimente qu'un écart de priorité BASSE. Quand le budget ne le
  // couvre plus, on le saute franchement plutôt que de lancer un appel condamné à expirer —
  // le repli est le même que sur échec, « pas d'écart de positionnement ».
  if (!deadline.hasRoomFor(CLASSIFIER_TIMEOUT_MS)) return false;

  try {
    const response = await callClaude(
      {
        model: EXTRACTION_MODEL,
        max_tokens: 200,
        // Même raison que pour l'extraction : un classificateur binaire à sortie contrainte
        // n'a pas de délibération à produire, et omettre le champ activerait l'adaptatif.
        thinking: { type: "disabled" },
        output_config: { effort: "low", format: POSITIONING_FORMAT },
        system: POSITIONING_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Proposition de valeur A (nous) : "${ownValueProposition}"\nProposition de valeur B (concurrent) : "${competitorValueProposition}"`,
          },
        ],
      },
      {
        timeout: deadline.capTimeout(CLASSIFIER_TIMEOUT_MS, CLASSIFIER_MAX_RETRIES + 1),
        maxRetries: CLASSIFIER_MAX_RETRIES,
      },
    );

    if (response.stop_reason === "refusal") return false;

    const text = extractTextBlock(response.content);
    if (!text) return false;

    const parsed = JSON.parse(stripCodeFence(text)) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).very_different === "boolean"
    ) {
      return (parsed as { very_different: boolean }).very_different;
    }
    return false;
  } catch (err) {
    console.warn("classifyPositioning: skipping positioning gap after classifier failure", err);
    return false;
  }
}
