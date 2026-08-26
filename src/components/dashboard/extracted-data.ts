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
