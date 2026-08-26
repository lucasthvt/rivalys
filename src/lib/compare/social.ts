// Deterministic social-presence detection from the links a site publishes on its own
// homepage (footer/header). No LLM, no guessing, no third-party social API: if a site links
// to its LinkedIn page, that link is a public, verifiable fact about that site.
//
// This is deliberately a narrow claim. "Links to a LinkedIn page" is NOT "is active on
// LinkedIn" — we can only observe the former, so every gap built from this must say exactly
// that (see detect-gaps.ts). Per CLAUDE.md, we never infer or fabricate competitive data.

export const SOCIAL_PLATFORMS = [
  { id: "linkedin", label: "LinkedIn", hosts: ["linkedin.com"] },
  { id: "x", label: "X (Twitter)", hosts: ["twitter.com", "x.com"] },
  { id: "instagram", label: "Instagram", hosts: ["instagram.com"] },
  { id: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
  { id: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.com"] },
  { id: "tiktok", label: "TikTok", hosts: ["tiktok.com"] },
  { id: "github", label: "GitHub", hosts: ["github.com"] },
  { id: "discord", label: "Discord", hosts: ["discord.com", "discord.gg"] },
] as const;

export type SocialPlatformId = (typeof SOCIAL_PLATFORMS)[number]["id"];

const LABEL_BY_ID = new Map<string, string>(SOCIAL_PLATFORMS.map((p) => [p.id, p.label]));

/**
 * Share/compose URLs point at a social network but say nothing about the site owning an
 * account there — they're "tweet this page" buttons. Counting them as presence would
 * manufacture a gap out of a share widget, so they're excluded.
 */
const SHARE_PATH_PATTERNS = [
  /^\/intent\//i,
  /^\/share/i,
  /^\/sharer/i,
  /^\/sharing\//i,
  /^\/dialog\//i,
  /^\/submit/i,
  /^\/pin\/create/i,
];

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function matchPlatform(hostname: string): SocialPlatformId | null {
  const host = normalizeHost(hostname);
  for (const platform of SOCIAL_PLATFORMS) {
    if (platform.hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return platform.id;
    }
  }
  return null;
}

/**
 * Returns the distinct social platforms this set of links points at, in SOCIAL_PLATFORMS
 * order (stable output — the result feeds a gap title, which is deduped by exact string).
 * Ignores share/compose URLs and any link that isn't a parseable absolute http(s) URL.
 */
export function detectSocialPlatforms(links: readonly string[]): SocialPlatformId[] {
  const found = new Set<SocialPlatformId>();

  for (const link of links) {
    let parsed: URL;
    try {
      parsed = new URL(link);
    } catch {
      continue; // relative or malformed link — not a social profile reference
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") continue;

    const platform = matchPlatform(parsed.hostname);
    if (!platform) continue;

    // A bare profile link has a path; a link to just the network's root (or a share URL)
    // isn't evidence of an account.
    const path = parsed.pathname;
    if (path === "/" || path === "") continue;
    if (SHARE_PATH_PATTERNS.some((re) => re.test(path))) continue;

    found.add(platform);
  }

  return SOCIAL_PLATFORMS.filter((p) => found.has(p.id)).map((p) => p.id);
}

/** Human-readable labels for a list of platform ids, in the same stable order. */
export function labelPlatforms(ids: readonly string[]): string[] {
  return ids.map((id) => LABEL_BY_ID.get(id) ?? id);
}

/** Platforms present on the competitor's site but absent from ours. */
export function missingPlatforms(
  ownPlatforms: readonly string[],
  competitorPlatforms: readonly string[],
): string[] {
  const owned = new Set(ownPlatforms);
  return competitorPlatforms.filter((p) => !owned.has(p));
}
