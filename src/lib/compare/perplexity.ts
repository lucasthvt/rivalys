// Perplexity Agent API — used ONLY to add factual colour to a social-presence gap that has
// already been detected deterministically from the competitor's own site links (see
// social.ts). The gap itself is never created by this call, so a Perplexity failure, outage,
// or missing key degrades the description, never the detection.
//
// Endpoint note: this targets the Agent API (POST /v1/agent), not the legacy Sonar
// /chat/completions endpoint, which Perplexity retires on 2026-09-27.

export class PerplexityError extends Error {
  // `cause` is declared and assigned here rather than through a constructor parameter
  // property: parameter properties are the one TS-only construct Node's strip-only type
  // stripping refuses outright, and reviews.ts (which imports this module for its lookup)
  // is unit-tested under `node --test`. Behaviour is unchanged.
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PerplexityError";
    this.cause = cause;
  }
}

const AGENT_ENDPOINT = "https://api.perplexity.ai/v1/agent";
/**
 * Délai par défaut, quand l'appelant n'en impose pas.
 *
 * 8 s et non 30 : le préréglage `fast` effectue UNE recherche web et répond en 2 à 6 s.
 * Les 30 s d'avant ne servaient qu'à attendre les cas pathologiques — or chaque appel ici
 * est un ENRICHISSEMENT optionnel (une ligne de contexte, une présence de fiche), et il y
 * en a jusqu'à cinq par analyse. Attendre une demi-minute pour un bonus, c'est faire payer
 * à l'utilisateur un relevé dont il se passerait volontiers.
 */
const AGENT_TIMEOUT_MS = 8_000;

export function isPerplexityConfigured(): boolean {
  return Boolean(process.env.PERPLEXITY_API_KEY?.trim());
}

interface AgentResponse {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
}

/** Pulls the assistant's text out of the Agent API's `output` item array. */
function readOutputText(payload: AgentResponse): string | null {
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const block of item.content ?? []) {
      if (block.type === "output_text" && typeof block.text === "string" && block.text.trim()) {
        return block.text.trim();
      }
    }
  }
  return null;
}

/**
 * Runs one web-grounded query on the `fast` preset (1 web search, ~1k input tokens — the
 * cheapest configuration). Returns null rather than throwing on any failure: every caller
 * treats this as optional enrichment.
 */
export async function askPerplexity(
  input: string,
  { timeoutMs = AGENT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<string | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(AGENT_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ preset: "fast", input }),
    });

    if (!res.ok) {
      console.warn(`askPerplexity: réponse ${res.status}, enrichissement ignoré.`);
      return null;
    }

    const payload = (await res.json()) as AgentResponse;
    return readOutputText(payload);
  } catch (err) {
    console.warn("askPerplexity: appel impossible, enrichissement ignoré.", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
