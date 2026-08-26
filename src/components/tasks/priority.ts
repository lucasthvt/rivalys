import type { Database } from "@/lib/supabase/database.types";

export type DetectedGap = Database["public"]["Tables"]["detected_gaps"]["Row"];
export type GapPriority = DetectedGap["priority"];

const PRIORITY_RANK: Record<GapPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/**
 * Sorts gaps by priority (high -> medium -> low), then by most recent first
 * for ties. Shared between /tasks and the dashboard's "actions prioritaires"
 * section so both screens agree on ordering.
 */
export function sortGapsByPriority<T extends { priority: GapPriority; created_at: string }>(
  gaps: T[],
): T[] {
  return [...gaps].sort((a, b) => {
    const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export const PRIORITY_LABEL: Record<GapPriority, string> = {
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
};

// Flare colors: distinct hue per urgency level, used consistently for the
// priority tick, badge, and any other priority-coded element.
export const PRIORITY_COLOR: Record<GapPriority, string> = {
  high: "#FF6B47",
  medium: "#F0B840",
  low: "#5C86A8",
};

export const CATEGORY_LABEL: Record<DetectedGap["category"], string> = {
  pricing: "Pricing",
  positioning: "Positionnement",
  reviews: "Avis",
  social_presence: "Réseaux",
};

// System monospace stack used for every "instrument readout" element
// (badges, labels, numeric values) across the tasks/dashboard screens.
export const MONO_STACK =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
