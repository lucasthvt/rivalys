import type { ExtractedSiteData, PricingTier } from "@/lib/supabase/database.types";

export type { ExtractedSiteData, PricingTier };

/**
 * What we actually persist in site_snapshots.extracted_data: the canonical
 * ExtractedSiteData shape plus a flag noting whether a dedicated pricing page was found.
 * jsonb has no schema, so this stays a superset of ExtractedSiteData — any consumer reading
 * only the canonical fields (e.g. the dashboard) keeps working unmodified.
 */
export interface StoredExtractedData extends ExtractedSiteData {
  pricing_page_found: boolean;
  /**
   * Social platform ids (see social.ts) the site links to from its own homepage. Optional
   * because snapshots written before social detection existed don't carry it — readSocialPlatforms()
   * below normalizes that absence to [], which callers must treat as "not observed", never
   * as "confirmed to have none".
   */
  social_platforms?: string[];
  /**
   * Review-platform ids (see reviews.ts) the site is listed on — presence only, never a
   * rating or a review count. Optional for the same reason as social_platforms, plus one
   * more: the field is deliberately omitted when the lookup for that side failed, so
   * readReviewPlatforms() below returns null and the comparison is skipped rather than
   * built on an observation that never completed.
   */
  review_platforms?: string[];
  /**
   * Individual pieces of public content mentioning this product, found by web lookup rather
   * than by reading the site's own links (see social-mentions.ts). Presence of content only:
   * never an author, never a count, never a volume estimate. Optional for the same reason as
   * review_platforms — the field is omitted when no lookup ran or the lookup failed, so
   * readThirdPartyMentions() below returns null and no comparison is built on it.
   */
  third_party_mentions?: { platform: string; url: string }[];
}

function isPricingTier(value: unknown): value is PricingTier {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    typeof v.price === "string" &&
    Array.isArray(v.features) &&
    v.features.every((f) => typeof f === "string")
  );
}

/** Runtime type guard — validates a parsed LLM response or a DB row before we trust its shape. */
export function isExtractedSiteData(value: unknown): value is ExtractedSiteData {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.pricing_tiers) &&
    v.pricing_tiers.every(isPricingTier) &&
    typeof v.has_free_trial === "boolean" &&
    typeof v.has_free_tier === "boolean" &&
    typeof v.value_proposition === "string" &&
    typeof v.target_audience === "string"
  );
}

export function isStoredExtractedData(value: unknown): value is StoredExtractedData {
  if (!isExtractedSiteData(value)) return false;
  return typeof (value as unknown as Record<string, unknown>).pricing_page_found === "boolean";
}

/**
 * Reads social_platforms off a stored snapshot.
 *
 * Returns null — not [] — when the field is absent, which happens on snapshots written
 * before social detection existed. The distinction matters: [] means "we read this site's
 * homepage and it linked to no social platform" (a fact we can compare), while null means
 * "we never looked" (nothing we're entitled to conclude from). Collapsing the two would let
 * a missing observation be presented to the user as a confirmed absence.
 */
export function readSocialPlatforms(data: StoredExtractedData): string[] | null {
  const raw = (data as unknown as Record<string, unknown>).social_platforms;
  if (!Array.isArray(raw)) return null;
  return raw.filter((p): p is string => typeof p === "string");
}

/**
 * Reads review_platforms off a stored snapshot, with exactly the same null-vs-[] contract as
 * readSocialPlatforms: [] means "we checked this site and found no public listing", null
 * means "we never checked" (old snapshot, or a lookup that failed). Only [] may be compared;
 * treating null as [] would turn a missing check into "tu n'es référencé nulle part".
 */
export function readReviewPlatforms(data: StoredExtractedData): string[] | null {
  const raw = (data as unknown as Record<string, unknown>).review_platforms;
  if (!Array.isArray(raw)) return null;
  return raw.filter((p): p is string => typeof p === "string");
}

/**
 * Reads third_party_mentions off a stored snapshot, with exactly the same null-vs-[] contract
 * as the two readers above: [] means "we ran the lookup and found no content mentioning this
 * product", null means "we never ran it" (old snapshot, no Perplexity key, failed call, or
 * nothing left to check). Only [] may be compared — treating null as [] would turn a lookup
 * that never happened into a confirmed absence.
 *
 * Entries whose shape doesn't hold up are dropped rather than repaired; each URL is verified
 * again downstream before it can reach any user-facing text (see groupMentionsByPlatform).
 */
export function readThirdPartyMentions(
  data: StoredExtractedData,
): { platform: string; url: string }[] | null {
  const raw = (data as unknown as Record<string, unknown>).third_party_mentions;
  if (!Array.isArray(raw)) return null;

  return raw.filter((m): m is { platform: string; url: string } => {
    if (!m || typeof m !== "object" || Array.isArray(m)) return false;
    const entry = m as Record<string, unknown>;
    return typeof entry.platform === "string" && typeof entry.url === "string";
  });
}
