import type { GapPriority } from "@/lib/supabase/database.types";

export interface GapPriorityCounts {
  high: number;
  medium: number;
  low: number;
}

export function countByPriority(gaps: { priority: GapPriority }[]): GapPriorityCounts {
  const counts: GapPriorityCounts = { high: 0, medium: 0, low: 0 };
  for (const gap of gaps) {
    counts[gap.priority] += 1;
  }
  return counts;
}

/**
 * score = clamp(100 - 10*high - 5*medium - 2*low, 0, 100)
 * Applied to the full set of this user's currently-open detected_gaps.
 */
export function computeScore(counts: GapPriorityCounts): number {
  const raw = 100 - 10 * counts.high - 5 * counts.medium - 2 * counts.low;
  return Math.max(0, Math.min(100, raw));
}
