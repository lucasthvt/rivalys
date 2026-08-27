// Review-platform PRESENCE detection — "is this product listed on G2 / Capterra / Trustpilot
// / Product Hunt", nothing else.
//
// Deliberately out of scope: ratings, star counts, review counts. A rating read today is
// stale within weeks, so displaying it as current would state something false about a
// competitor, which CLAUDE.md forbids ("aucune donnée privée... jamais prétendre connaître").
// Presence is stable, publicly verifiable, and directly actionable (getting listed is a
// concrete task). Nothing in this file may ever store or surface a score.
//
// Two evidence sources, in this order:
//   1. the site's own published links — a badge linking to its G2 profile is a deterministic,
//      zero-cost, zero-hallucination fact (same approach as social.ts);
//   2. a single web-grounded Perplexity lookup, used only when (1) found nothing, and whose
//      every claim is re-verified in code below before it is allowed to count.

import { askPerplexity, isPerplexityConfigured } from "./perplexity";

export const REVIEW_PLATFORMS = [
  { id: "g2", label: "G2", hosts: ["g2.com"] },
  { id: "capterra", label: "Capterra", hosts: ["capterra.com", "capterra.fr"] },
  // fr.trustpilot.com and the other locale subdomains are matched by the subdomain rule in
  // matchPlatform(), so only the apex host is listed here.
  { id: "trustpilot", label: "Trustpilot", hosts: ["trustpilot.com"] },
  { id: "producthunt", label: "Product Hunt", hosts: ["producthunt.com"] },
] as const;

export type ReviewPlatformId = (typeof REVIEW_PLATFORMS)[number]["id"];

const LABEL_BY_ID = new Map<string, string>(REVIEW_PLATFORMS.map((p) => [p.id, p.label]));
const IDS = new Set<string>(REVIEW_PLATFORMS.map((p) => p.id));

/**
 * A URL only counts as evidence of a listing when its path identifies a specific product or
 * business page. The platforms' homepages, category listings and search pages all live on
 * the same hosts and prove nothing, so each platform declares the shapes its own profile
 * URLs take (badge links and share links included — they carry the same identifying path).
 *
 * Erring strict is the safe direction here: an unrecognised URL shape is dropped, which can
 * only ever suppress a gap, never invent one.
 */
const PROFILE_PATH_PATTERNS: Record<ReviewPlatformId, RegExp[]> = {
  // g2.com/products/<slug>[/reviews], g2.com/sellers/<slug>
  g2: [/^\/products\/[^/]+/i, /^\/sellers\/[^/]+/i],
  // capterra.com/p/<id>/<slug>, capterra.com/reviews/<id>/<slug>,
  // capterra.fr/logiciel/<id>/<slug>, capterra.*/software/<id>/<slug>
  capterra: [
    /^\/p\/\d+/i,
    /^\/reviews\/\d+/i,
    /^\/software\/\d+/i,
    /^\/logiciel\/\d+/i,
  ],
  // trustpilot.com/review/<domain> — /evaluate/<domain> is the "write a review" page, which
  // still names an existing listing, so it counts as presence.
  trustpilot: [/^\/review\/[^/]+/i, /^\/evaluate\/[^/]+/i],
  // producthunt.com/products/<slug>, producthunt.com/posts/<slug>
  producthunt: [/^\/products\/[^/]+/i, /^\/posts\/[^/]+/i],
};

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function matchPlatform(hostname: string): ReviewPlatformId | null {
  const host = normalizeHost(hostname);
  for (const platform of REVIEW_PLATFORMS) {
    if (platform.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return platform.id;
    }
  }
  return null;
}

/** The platform whose profile URL this is, or null when the URL is anything else. */
function platformOfProfileUrl(url: string): ReviewPlatformId | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null; // relative or malformed link — not a profile reference
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const platform = matchPlatform(parsed.hostname);
  if (!platform) return null;

  // A bare link to the platform's root (or to a category/search page) is not evidence of a
  // listing; only a path identifying this specific product is.
  const path = parsed.pathname;
  if (path === "/" || path === "") return null;

  return PROFILE_PATH_PATTERNS[platform].some((re) => re.test(path)) ? platform : null;
}

/**
 * Whether `url` is a profile page on `platformId` specifically. Checks BOTH that the host
 * belongs to that platform (a Capterra URL claimed as "g2" fails) and that the path is
 * profile-shaped rather than the platform's homepage.
 *
 * This is the gate every LLM-returned claim must pass — see parseReviewLookupResponse.
 */
export function isPlatformProfileUrl(url: string, platformId: ReviewPlatformId): boolean {
  return platformOfProfileUrl(url) === platformId;
}

/**
 * Review platforms this set of links points at, in REVIEW_PLATFORMS order (stable output:
 * the result feeds a gap description and is compared between two sides).
 *
 * Sites routinely embed their own "Leader on G2" / Capterra / Product Hunt badge in their
 * footer; that link is a public fact requiring no model call, so it is always tried first.
 */
export function detectReviewPlatformsFromLinks(links: readonly string[]): ReviewPlatformId[] {
  const found = new Set<ReviewPlatformId>();

  for (const link of links) {
    const platform = platformOfProfileUrl(link);
    if (platform) found.add(platform);
  }

  return REVIEW_PLATFORMS.filter((p) => found.has(p.id)).map((p) => p.id);
}

/** Human-readable labels for a list of platform ids, in the same stable order. */
export function labelReviewPlatforms(ids: readonly string[]): string[] {
  return ids.map((id) => LABEL_BY_ID.get(id) ?? id);
}

/** Platforms the competitor is listed on and we are not. */
export function missingReviewPlatforms(
  ownPlatforms: readonly string[],
  competitorPlatforms: readonly string[],
): string[] {
  const owned = new Set(ownPlatforms);
  return competitorPlatforms.filter((p) => !owned.has(p));
}

/** Union of two platform lists, deduped and re-sorted into REVIEW_PLATFORMS order. */
export function mergeReviewPlatforms(
  a: readonly string[],
  b: readonly string[],
): ReviewPlatformId[] {
  const found = new Set<string>([...a, ...b]);
  return REVIEW_PLATFORMS.filter((p) => found.has(p.id)).map((p) => p.id);
}

/**
 * Same fence-stripping as extract.ts: the prompt demands bare JSON, but a model can still
 * wrap its answer in a markdown fence. Duplicated rather than imported to keep this module
 * out of extract.ts's Anthropic-SDK import graph (it is unit-tested without network access).
 */
function stripCodeFence(text: string): string {
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/i.exec(text.trim());
  return fenced ? fenced[1].trim() : text;
}

function buildReviewLookupPrompt(siteName: string, siteUrl: string): string {
  return (
    `Recherche si le SaaS "${siteName}" (site officiel : ${siteUrl}) possède une fiche publique ` +
    `sur ces plateformes d'avis : G2 (g2.com), Capterra (capterra.com ou capterra.fr), ` +
    `Trustpilot (trustpilot.com), Product Hunt (producthunt.com).\n\n` +
    `Réponds EXCLUSIVEMENT avec un tableau JSON valide, sans aucun texte avant ou après, ` +
    "sans balises markdown (pas de ```), de la forme :\n" +
    `[{"platform": "g2", "url": "https://www.g2.com/products/exemple/reviews"}]\n\n` +
    `Règles strictes :\n` +
    `- "platform" vaut exactement l'une de ces valeurs : g2, capterra, trustpilot, producthunt.\n` +
    `- "url" est l'URL exacte et complète de la fiche que tu as réellement consultée. ` +
    `Ne devine, ne construis et ne complète JAMAIS une URL toi-même.\n` +
    `- N'inclus une plateforme QUE si tu as vu une fiche correspondant à ce SaaS précis ` +
    `(même produit, même éditeur). En cas de doute, d'homonyme ou de produit approchant, ne l'inclus pas.\n` +
    `- Si tu ne trouves aucune fiche, réponds exactement : []\n` +
    `- Ne renvoie ni note, ni étoiles, ni nombre d'avis : uniquement la présence et l'URL.`
  );
}

/**
 * Pure verification step over the model's raw answer — exported so it can be tested without
 * any network call.
 *
 * Every returned entry is re-checked against isPlatformProfileUrl: a claim whose URL does not
 * resolve to a profile page on the platform it names is DISCARDED, not trusted. The model's
 * word alone never creates a task in the user's list; only a URL we can point at does.
 *
 * Returns null (not []) whenever the answer is missing or unusable, so the caller can tell
 * "never checked" from "checked and found nothing" — see readReviewPlatforms in site-data.ts.
 */
export function parseReviewLookupResponse(raw: string | null): ReviewPlatformId[] | null {
  if (!raw || !raw.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const found = new Set<ReviewPlatformId>();
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const { platform, url } = entry as Record<string, unknown>;
    if (typeof platform !== "string" || typeof url !== "string") continue;

    const id = platform.trim().toLowerCase();
    if (!IDS.has(id)) continue;

    // The verification gate: an unverifiable claim is dropped silently.
    if (!isPlatformProfileUrl(url, id as ReviewPlatformId)) continue;

    found.add(id as ReviewPlatformId);
  }

  return REVIEW_PLATFORMS.filter((p) => found.has(p.id)).map((p) => p.id);
}

/**
 * One web-grounded lookup of a site's review-platform listings.
 *
 * Returns null on any failure (no API key, network error, unparseable answer) — never [],
 * because [] is a factual claim ("we looked and this site is listed nowhere") that a failed
 * call has not earned. The caller stores nothing at all in that case, so no comparison is
 * built on an observation that never happened.
 */
export async function lookupReviewPresence(
  siteName: string,
  siteUrl: string,
): Promise<ReviewPlatformId[] | null> {
  if (!isPerplexityConfigured()) return null;
  return parseReviewLookupResponse(await askPerplexity(buildReviewLookupPrompt(siteName, siteUrl)));
}
