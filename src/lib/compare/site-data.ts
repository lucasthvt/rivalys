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
