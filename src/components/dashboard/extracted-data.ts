import type { ExtractedSiteData, PricingTier } from "@/lib/supabase/database.types";

function isPricingTier(value: unknown): value is PricingTier {
  if (!value || typeof value !== "object") return false;
  const tier = value as Record<string, unknown>;
  return (
    typeof tier.name === "string" &&
    typeof tier.price === "string" &&
    Array.isArray(tier.features) &&
    tier.features.every((f) => typeof f === "string")
  );
}

/**
 * Defensively parses a `site_snapshots.extracted_data` jsonb value into the
 * ExtractedSiteData shape. Never throws and never invents data: fields that
 * don't match the expected shape fall back to empty/false rather than being
 * guessed at, since the product must never fabricate competitive data.
 */
export interface ObservationFlags {
  /** Whether a dedicated pricing page was actually located for this site. */
  pricingPageFound: boolean;
  /**
   * Social platforms the site links to, or null when the snapshot predates social
   * detection. Null means "never looked", [] means "looked and found none" — the two must
   * not be collapsed, or an unobserved site would be presented as confirmed to have none.
   * Same contract as readSocialPlatforms in lib/compare/site-data.ts.
   */
  socialPlatforms: string[] | null;
  /**
   * Review platforms the site is publicly listed on (presence only — never a rating or a
   * review count), or null when the snapshot predates review detection or its lookup failed.
   * Same null-vs-[] contract as socialPlatforms above.
   */
  reviewPlatforms: string[] | null;
  /**
   * Individual pieces of public content mentioning this product, found by web lookup rather
   * than by reading the site's own links, or null when no lookup ran or it failed. Presence
   * of content only — never who published it, never a count. Same null-vs-[] contract as the
   * two fields above (see readThirdPartyMentions in lib/compare/site-data.ts).
   */
  thirdPartyMentions: { platform: string; url: string }[] | null;
}

/**
 * Reads the observation flags that parseExtractedData deliberately drops (it returns the
 * canonical ExtractedSiteData shape only). The comparison rules need these to tell a
 * confirmed absence from an unverified default.
 */
export function parseObservationFlags(json: unknown): ObservationFlags {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    return {
      pricingPageFound: false,
      socialPlatforms: null,
      reviewPlatforms: null,
      thirdPartyMentions: null,
    };
  }

  const data = json as Record<string, unknown>;

  return {
    pricingPageFound: data.pricing_page_found === true,
    socialPlatforms: Array.isArray(data.social_platforms)
      ? data.social_platforms.filter((p): p is string => typeof p === "string")
      : null,
    reviewPlatforms: Array.isArray(data.review_platforms)
      ? data.review_platforms.filter((p): p is string => typeof p === "string")
      : null,
    thirdPartyMentions: Array.isArray(data.third_party_mentions)
      ? data.third_party_mentions.filter((m): m is { platform: string; url: string } => {
          if (!m || typeof m !== "object" || Array.isArray(m)) return false;
          const entry = m as Record<string, unknown>;
          return typeof entry.platform === "string" && typeof entry.url === "string";
        })
      : null,
  };
}

export function parseExtractedData(json: unknown): ExtractedSiteData | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;

  const data = json as Record<string, unknown>;

  return {
    pricing_tiers: Array.isArray(data.pricing_tiers)
      ? data.pricing_tiers.filter(isPricingTier)
      : [],
    has_free_trial: Boolean(data.has_free_trial),
    has_free_tier: Boolean(data.has_free_tier),
    value_proposition:
      typeof data.value_proposition === "string" ? data.value_proposition : "",
    target_audience: typeof data.target_audience === "string" ? data.target_audience : "",
  };
}
