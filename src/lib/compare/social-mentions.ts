// Third-party CONTENT detection — "does publicly visible content mentioning this product
// exist on TikTok / YouTube / Instagram", nothing else.
//
// Why this exists: social.ts only reads the links a site publishes about itself, so a brand
// with heavy TikTok circulation that never links TikTok from its own footer is invisible to
// it. That is a false negative (the safe direction) but a real blind spot.
//
// THE LINE THIS FILE MUST NOT CROSS. Content ABOUT a brand can come from its official
// account, a paid partner, a sincere customer, or someone trashing it — from the outside
// these are indistinguishable. So this module observes exactly one thing: "a public piece of
// content mentioning this product exists at this URL". It never characterises who published
// it, why, or on whose behalf, and it never carries a follower count, a view count, an
// engagement figure or any volume estimate — none of which we can verify, and all of which
// CLAUDE.md forbids us from asserting about a competitor.
//
// Same two-part shape as reviews.ts: one web-grounded Perplexity lookup, whose every claim is
// re-verified in code (isContentUrl) before it is allowed to count. A URL we cannot check is
// dropped, never trusted.

import { askPerplexity, isPerplexityConfigured } from "./perplexity";
import { SOCIAL_PLATFORMS, type SocialPlatformId } from "./social";

/**
 * Scoped to the platforms where third-party content is both meaningful and checkable: an
 * individual post lives at a stable, public, verifiable URL.
 *
 * LinkedIn, GitHub, Discord and Facebook are deliberately out: their content model is
 * different (feed posts behind auth walls, repositories, private servers), so "a piece of
 * content mentioning X" there is neither reliably reachable nor comparable.
 *
 * The ids are the SAME ids as social.ts on purpose — the two features must speak one
 * vocabulary, so a mention on "tiktok" and a published link to "tiktok" compare directly
 * (see detectThirdPartyPresenceGap). `Extract` ties this union to SocialPlatformId at
 * compile time: dropping one of these ids from SOCIAL_PLATFORMS breaks this file loudly
 * instead of silently forking a second id scheme.
 */
export type MentionPlatformId = Extract<SocialPlatformId, "instagram" | "youtube" | "tiktok">;

const MENTION_ID_SET: ReadonlySet<string> = new Set<string>(["instagram", "youtube", "tiktok"]);

export function isMentionPlatformId(id: string): id is MentionPlatformId {
  return MENTION_ID_SET.has(id);
}

/** Hosts are read from SOCIAL_PLATFORMS rather than re-declared, for the same reason. */
const HOSTS_BY_ID = new Map<string, readonly string[]>(
  SOCIAL_PLATFORMS.map((p) => [p.id, p.hosts]),
);

/**
 * Derived from SOCIAL_PLATFORMS, so the ordering here is the ordering there — stable output
 * matters because these ids feed a gap description that is deduped by exact string.
 */
export const MENTION_PLATFORM_IDS: readonly MentionPlatformId[] = SOCIAL_PLATFORMS.map(
  (p) => p.id,
).filter(isMentionPlatformId);

/** One verified piece of public content mentioning a product. Nothing about its author. */
export interface ThirdPartyMention {
  platform: MentionPlatformId;
  url: string;
}

/**
 * Two URLs per platform is enough for the user to click through and judge for themselves,
 * which is the entire point — a longer dump would read as a volume claim we cannot make.
 */
const MAX_URLS_PER_PLATFORM = 2;

/**
 * Paths that are explicitly NOT an individual piece of content, listed first so the intent is
 * documented rather than implied by the accept patterns failing to match.
 *
 * A search-results or hashtag page proves nothing: those URLs can be constructed for any
 * string whatsoever, so "https://www.tiktok.com/search?q=acme" would let a model manufacture
 * evidence for a product with zero content about it. Profile and homepage URLs are excluded
 * by the accept patterns below for the same reason (a profile is presence, not content — and
 * presence on the site's own terms is already social.ts's job).
 */
const NON_CONTENT_PATH_PATTERNS = [
  /^\/search(\/|$)/i,
  /^\/results(\/|$)/i,
  /^\/tags?(\/|$)/i,
  /^\/hashtag(\/|$)/i,
  /^\/discover(\/|$)/i,
  /^\/explore(\/|$)/i,
];

/**
 * The shapes an individual piece of content takes on each platform. Erring strict is the safe
 * direction: an unrecognised URL shape is dropped, which can only ever suppress a gap, never
 * invent one.
 */
const CONTENT_PATH_PATTERNS: Record<MentionPlatformId, RegExp[]> = {
  // instagram.com/p/<code>, /reel/<code>, /reels/<code>, /tv/<code>, and the
  // /<handle>/p/<code> and /<handle>/reel/<code> variants.
  instagram: [
    /^\/p\/[^/]+/i,
    /^\/reels?\/[^/]+/i,
    /^\/tv\/[^/]+/i,
    /^\/[^/]+\/(?:p|reels?|tv)\/[^/]+/i,
  ],
  // youtube.com/shorts/<id>, /live/<id>, /embed/<id>. The /watch?v=<id> and youtu.be/<id>
  // forms need the query string / the host, so they're handled in isContentLocation below.
  youtube: [/^\/shorts\/[^/]+/i, /^\/live\/[^/]+/i, /^\/embed\/[^/]+/i],
  // tiktok.com/@<handle>/video/<id> and /@<handle>/photo/<id>. A bare /@<handle> is a
  // profile, not a piece of content, so it is not listed here.
  tiktok: [/^\/@[^/]+\/video\/\d+/i, /^\/@[^/]+\/photo\/\d+/i],
};

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function matchMentionPlatform(hostname: string): MentionPlatformId | null {
  const host = normalizeHost(hostname);
  for (const id of MENTION_PLATFORM_IDS) {
    const hosts = HOSTS_BY_ID.get(id) ?? [];
    // Exact host or a real subdomain of it — "tiktok.com.evil.example" matches neither.
    if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) return id;
  }
  return null;
}

function isContentLocation(platform: MentionPlatformId, parsed: URL): boolean {
  const path = parsed.pathname;

  if (platform === "youtube") {
    const host = normalizeHost(parsed.hostname);
    // youtu.be/<videoId>: the whole path IS the id.
    if (host === "youtu.be" || host.endsWith(".youtu.be")) {
      return /^\/[A-Za-z0-9_-]{6,}\/?$/.test(path);
    }
    // /watch only identifies a video when it actually carries one.
    if (/^\/watch\/?$/i.test(path)) {
      return Boolean(parsed.searchParams.get("v")?.trim());
    }
  }

  return CONTENT_PATH_PATTERNS[platform].some((re) => re.test(path));
}

/** The platform whose individual-content URL this is, or null for anything else. */
function platformOfContentUrl(url: string): MentionPlatformId | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null; // relative or malformed — not a content reference
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const platform = matchMentionPlatform(parsed.hostname);
  if (!platform) return null;

  const path = parsed.pathname;
  if (path === "/" || path === "") return null; // the platform's homepage
  if (NON_CONTENT_PATH_PATTERNS.some((re) => re.test(path))) return null;

  return isContentLocation(platform, parsed) ? platform : null;
}

/**
 * Whether `url` points at an individual piece of content on `platformId` specifically.
 *
 * Checks BOTH that the host belongs to that platform (a TikTok URL claimed as "youtube"
 * fails, and so does a lookalike host like tiktok.com.evil.example) AND that the path
 * identifies one post — not a search page, not a hashtag page, not a profile, not the
 * homepage.
 *
 * This is the gate every model-returned claim must pass — see parseMentionsResponse.
 */
export function isContentUrl(url: string, platformId: MentionPlatformId): boolean {
  return platformOfContentUrl(url) === platformId;
}

/**
 * Groups mentions by platform, in MENTION_PLATFORM_IDS order, dropping empty groups.
 *
 * Every URL is re-verified through isContentUrl here, not only at parse time: these URLs get
 * pasted verbatim into a user-facing gap description, so nothing that isn't a checkable
 * content URL on the platform it claims may ever reach that text — including from a stored
 * snapshot written by an older version of this code.
 */
export function groupMentionsByPlatform(
  mentions: readonly { platform: string; url: string }[],
): { platform: MentionPlatformId; urls: string[] }[] {
  const byPlatform = new Map<MentionPlatformId, string[]>();

  for (const mention of mentions) {
    if (typeof mention?.platform !== "string" || typeof mention?.url !== "string") continue;
    const id = mention.platform.trim().toLowerCase();
    if (!isMentionPlatformId(id)) continue;

    const url = mention.url.trim();
    if (!isContentUrl(url, id)) continue;

    const urls = byPlatform.get(id) ?? [];
    if (urls.includes(url)) continue;
    urls.push(url);
    byPlatform.set(id, urls);
  }

  return MENTION_PLATFORM_IDS.filter((id) => byPlatform.has(id)).map((id) => ({
    platform: id,
    urls: byPlatform.get(id) ?? [],
  }));
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

function buildMentionsLookupPrompt(
  siteName: string,
  siteUrl: string,
  platformIds: readonly MentionPlatformId[],
): string {
  const platformList = platformIds.join(", ");

  return (
    `Recherche des contenus publics publiés sur ${platformList} qui mentionnent le produit ` +
    `"${siteName}" (site officiel : ${siteUrl}).\n\n` +
    `Réponds EXCLUSIVEMENT avec un tableau JSON valide, sans aucun texte avant ou après, ` +
    "sans balises markdown (pas de ```), de la forme :\n" +
    `[{"platform": "tiktok", "url": "https://www.tiktok.com/@exemple/video/1234567890"}]\n\n` +
    `Règles strictes :\n` +
    `- "platform" vaut exactement l'une de ces valeurs : ${platformList}.\n` +
    `- "url" est l'URL exacte et complète d'UN contenu précis (une vidéo, un short, un reel, ` +
    `une publication) que tu as réellement consulté. Ne devine, ne construis et ne complète ` +
    `JAMAIS une URL toi-même.\n` +
    `- N'utilise jamais une URL de recherche, de hashtag, de profil ou de page d'accueil : ` +
    `uniquement l'URL d'un contenu individuel.\n` +
    `- N'inclus un contenu QUE si tu peux l'attribuer sans ambiguïté à ce produit précis ` +
    `(même produit, même éditeur que le site officiel ci-dessus). En cas de doute, d'homonyme ` +
    `ou de produit approchant, ne l'inclus pas.\n` +
    `- Peu importe qui a publié : compte officiel, client, créateur indépendant ou détracteur. ` +
    `Ne cherche pas à qualifier l'auteur et n'indique rien à son sujet.\n` +
    `- Si tu ne trouves aucun contenu de ce type, réponds exactement : []\n` +
    `- Ne renvoie aucun chiffre : ni nombre de vues, ni nombre d'abonnés, ni mesure ` +
    `d'engagement, ni estimation de volume.`
  );
}

/**
 * Pure verification step over the model's raw answer — exported so it can be tested without
 * any network call.
 *
 * Every entry is re-checked against isContentUrl: a claim whose URL is not a verifiable
 * individual-content URL on the platform it names is DISCARDED, not trusted. The model's word
 * alone never puts a link in front of the user; only a URL we can point at does.
 *
 * Returns null (not []) whenever the answer is missing or unusable, so the caller can tell
 * "never checked" from "checked and found nothing" — see readThirdPartyMentions in
 * site-data.ts. Capped at MAX_URLS_PER_PLATFORM per platform, deduped, in stable order.
 */
export function parseMentionsResponse(raw: string | null): ThirdPartyMention[] | null {
  if (!raw || !raw.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const candidates: { platform: string; url: string }[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const { platform, url } = entry as Record<string, unknown>;
    if (typeof platform !== "string" || typeof url !== "string") continue;
    candidates.push({ platform, url });
  }

  // groupMentionsByPlatform applies the verification gate, the dedupe and the stable order;
  // only the per-platform cap is left to apply here.
  return groupMentionsByPlatform(candidates).flatMap((group) =>
    group.urls.slice(0, MAX_URLS_PER_PLATFORM).map((url) => ({ platform: group.platform, url })),
  );
}

/**
 * One web-grounded lookup of public content mentioning a product, on the given platforms.
 *
 * Returns null on any failure (no API key, nothing to check, network error, unparseable
 * answer) — never [], because [] is a factual claim ("we looked and found no content about
 * this product") that a failed call has not earned. The caller stores nothing at all in that
 * case, so no comparison is built on an observation that never happened.
 */
export async function lookupThirdPartyMentions(
  siteName: string,
  siteUrl: string,
  platformIds: readonly MentionPlatformId[],
  { timeoutMs }: { timeoutMs?: number } = {},
): Promise<ThirdPartyMention[] | null> {
  if (!isPerplexityConfigured()) return null;
  if (platformIds.length === 0) return null;
  return parseMentionsResponse(
    await askPerplexity(buildMentionsLookupPrompt(siteName, siteUrl, platformIds), { timeoutMs }),
  );
}
