// Minimal HTML-to-text cleanup for feeding page content to Claude for extraction.
// Deliberately a simple regex-based strip (no cheerio/jsdom dependency) — good enough
// to preserve visible text and rough pricing structure for a single-page extraction pass.

const SCRIPT_STYLE_RE = /<(script|style|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi;
const COMMENT_RE = /<!--[\s\S]*?-->/g;
const BLOCK_BREAK_RE = /<\/(p|div|section|article|li|tr|h[1-6])\s*>/gi;
const LINE_BREAK_RE = /<br\s*\/?>/gi;
const TAG_RE = /<[^>]+>/g;
const INLINE_WHITESPACE_RE = /[ \t\f\v]+/g;
const MULTI_NEWLINE_RE = /\n{3,}/g;

const NAMED_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/g, (match) => NAMED_ENTITIES[match] ?? match)
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)));
}

/** Cap on cleaned text length sent to Claude, to keep prompts small and cheap. */
export const MAX_CLEANED_TEXT_LENGTH = 15_000;

const HREF_RE = /<a\b[^>]*?\shref\s*=\s*["']([^"']+)["']/gi;

/**
 * Pulls absolute outbound links out of raw HTML, resolved against `baseUrl`. Used only on
 * the direct-fetch fallback path — when Firecrawl handles the page it returns a `links`
 * array of its own, built after JS rendering, which is strictly better.
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(HREF_RE)) {
    const href = decodeEntities(match[1]).trim();
    if (!href || href.startsWith("#")) continue;
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        links.add(resolved.toString());
      }
    } catch {
      continue; // unparseable href (javascript:, mailto:, malformed) — skip
    }
  }
  return [...links];
}

/**
 * Strips scripts/styles/tags from raw HTML, keeping visible text and a rough line
 * structure (one line per block-level element) so pricing rows stay legible.
 */
export function stripHtml(html: string): string {
  const withoutNoise = html.replace(SCRIPT_STYLE_RE, " ").replace(COMMENT_RE, " ");
  const withLineBreaks = withoutNoise.replace(BLOCK_BREAK_RE, "\n").replace(LINE_BREAK_RE, "\n");
  const textOnly = withLineBreaks.replace(TAG_RE, " ");
  const decoded = decodeEntities(textOnly);

  const collapsed = decoded
    .split("\n")
    .map((line) => line.replace(INLINE_WHITESPACE_RE, " ").trim())
    .filter(Boolean)
    .join("\n")
    .replace(MULTI_NEWLINE_RE, "\n\n")
    .trim();

  return collapsed.length > MAX_CLEANED_TEXT_LENGTH
    ? `${collapsed.slice(0, MAX_CLEANED_TEXT_LENGTH)}\n[...contenu tronqué...]`
    : collapsed;
}
