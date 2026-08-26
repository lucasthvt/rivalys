import Anthropic from "@anthropic-ai/sdk";
import { isExtractedSiteData, type StoredExtractedData } from "./site-data";

export class ExtractionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ExtractionError";
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
// still, but it supports neither adaptive thinking nor `effort` (both used below), and its
// retirement window opens 2026-10-15.
const EXTRACTION_MODEL = "claude-sonnet-5";

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
async function callClaude(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> {
  try {
    return await getClient().messages.create(params);
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
export async function extractSiteData(input: {
  homepageText: string;
  pricingText: string | null;
  pricingPageFound: boolean;
}): Promise<StoredExtractedData> {
  const response = await callClaude({
    model: EXTRACTION_MODEL,
    // Higher than classifyPositioning's 200: on a pricing-rich page (multiple tiers, lots
    // of features, up to MAX_CLEANED_TEXT_LENGTH=15000 chars of input) adaptive thinking can
    // eat a large chunk of a smaller budget before the JSON is emitted, truncating the
    // response and failing JSON.parse with a misleading "invalid JSON" error instead of a
    // clear "ran out of tokens" one.
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildExtractionUserPrompt(input) }],
  });

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
): Promise<boolean> {
  if (!ownValueProposition.trim() || !competitorValueProposition.trim()) return false;

  try {
    const response = await callClaude({
      model: EXTRACTION_MODEL,
      max_tokens: 200,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: POSITIONING_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Proposition de valeur A (nous) : "${ownValueProposition}"\nProposition de valeur B (concurrent) : "${competitorValueProposition}"`,
        },
      ],
    });

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
