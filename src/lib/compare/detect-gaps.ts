// Hardcoded gap-detection rules — deliberately NOT LLM-generated. Per CLAUDE.md, every
// action shown to the user must derive from a factual, explicit comparison rule, never
// free-form generation. The only LLM involvement in this file's domain is the upstream
// `veryDifferent` boolean fed into buildPositioningGap, computed once by a separate
// classifier call (see extract.ts) — the gap text itself is still built here, from the
// real extracted data, by a plain template.

import type { ExtractedSiteData, GapCategory, GapPriority } from "@/lib/supabase/database.types";

export interface GapCandidate {
  category: GapCategory;
  title: string;
  description: string;
  priority: GapPriority;
}

function competitorLabelOrFallback(label: string): string {
  return label.trim() || "ton concurrent";
}

/**
 * The three hardcoded pricing rules from CLAUDE.md § Comparateur:
 *   - competitor has a free trial and we don't -> high
 *   - competitor has a free tier and we don't -> high
 *   - competitor has more pricing tiers than us -> medium
 * Pure function: no network, no DB — takes two already-extracted snapshots and returns
 * candidate gaps. Deduplication against already-open gaps happens at the call site (it
 * needs a DB read).
 *
 * `ownPricingFound`/`competitorPricingFound` reflect whether a dedicated pricing page was
 * actually located for that side (see StoredExtractedData.pricing_page_found). When a
 * pricing page wasn't found, the extractor's `has_free_trial`/`has_free_tier: false` and
 * empty `pricing_tiers` mean "unknown", not "confirmed absent" — the extraction prompt
 * falls back to those defaults precisely because it found nothing to read. Comparing that
 * ambiguous `false` against a confirmed value on the other side would present a guess as a
 * fact (e.g. "you don't have a free trial" when we simply couldn't check). Per CLAUDE.md,
 * we never fabricate or infer competitive data from a failed fetch — so if either side's
 * pricing page is missing, we skip all three pricing rules entirely rather than emit a
 * gap built on an unverified default.
 */
export function detectPricingGaps(
  own: ExtractedSiteData,
  competitor: ExtractedSiteData,
  competitorLabel: string,
  ownPricingFound: boolean,
  competitorPricingFound: boolean,
): GapCandidate[] {
  if (!ownPricingFound || !competitorPricingFound) return [];

  const gaps: GapCandidate[] = [];
  const label = competitorLabelOrFallback(competitorLabel);

  if (competitor.has_free_trial && !own.has_free_trial) {
    gaps.push({
      category: "pricing",
      title: "Ton concurrent propose un essai gratuit, pas toi",
      description: `${label} propose un essai gratuit sur son pricing, alors que ton offre actuelle n'en propose pas.`,
      priority: "high",
    });
  }

  if (competitor.has_free_tier && !own.has_free_tier) {
    gaps.push({
      category: "pricing",
      title: "Ton concurrent a un palier gratuit, pas toi",
      description: `${label} propose un palier gratuit ("free tier"), alors que ton pricing n'en propose aucun.`,
      priority: "high",
    });
  }

  if (competitor.pricing_tiers.length > own.pricing_tiers.length) {
    gaps.push({
      category: "pricing",
      title: "Ton concurrent propose plus de paliers de pricing que toi",
      description: `${label} propose ${competitor.pricing_tiers.length} paliers de pricing contre ${own.pricing_tiers.length} pour toi, ce qui lui permet de mieux segmenter ses clients.`,
      priority: "medium",
    });
  }

  return gaps;
}

/**
 * The fourth rule (positioning): builds a gap from the two real value propositions, but
 * only when `veryDifferent` (computed upstream by a single LLM classification call) says
 * so. Pure otherwise — no LLM call happens in this function.
 */
export function buildPositioningGap(
  own: ExtractedSiteData,
  competitor: ExtractedSiteData,
  veryDifferent: boolean,
  competitorLabel: string,
): GapCandidate | null {
  if (!veryDifferent) return null;
  const label = competitorLabelOrFallback(competitorLabel);

  return {
    category: "positioning",
    title: "Ton positionnement diffère nettement de celui de ton concurrent",
    description: `Ta proposition de valeur ("${own.value_proposition}") et celle de ${label} ("${competitor.value_proposition}") semblent viser des angles différents — vérifie que ton message reste le bon face à ce contraste.`,
    priority: "low",
  };
}
