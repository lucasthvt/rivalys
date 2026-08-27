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

/** Points retirés par écart ouvert, selon sa priorité. Source unique du calcul. */
export const POINTS_PER_PRIORITY: Record<GapPriority, number> = {
  high: 10,
  medium: 5,
  low: 2,
};

export const MAX_SCORE = 100;

/**
 * score = clamp(100 - 10*high - 5*medium - 2*low, 0, 100)
 * Applied to the full set of this user's currently-open detected_gaps.
 */
export function computeScore(counts: GapPriorityCounts): number {
  const raw =
    MAX_SCORE -
    POINTS_PER_PRIORITY.high * counts.high -
    POINTS_PER_PRIORITY.medium * counts.medium -
    POINTS_PER_PRIORITY.low * counts.low;
  return Math.max(0, Math.min(MAX_SCORE, raw));
}

export interface ScoreLine {
  priority: GapPriority;
  count: number;
  pointsEach: number;
  pointsLost: number;
}

export interface ScoreBreakdown {
  score: number;
  lines: ScoreLine[];
  /** Points réellement retirés, avant l'éventuel écrêtage à 0. */
  totalLost: number;
  /**
   * True quand le total des pénalités dépasse 100 : le score est bloqué à 0 et fermer un
   * écart ne le fera pas remonter tout de suite. À dire à l'utilisateur plutôt que de lui
   * laisser croire que son action n'a servi à rien.
   */
  clamped: boolean;
}

/**
 * Décompose le score en lignes affichables. Ne recalcule rien de son côté : réutilise
 * computeScore pour que l'explication montrée à l'utilisateur ne puisse jamais diverger du
 * chiffre affiché ailleurs.
 */
export function explainScore(counts: GapPriorityCounts): ScoreBreakdown {
  const priorities: GapPriority[] = ["high", "medium", "low"];

  const lines: ScoreLine[] = priorities.map((priority) => ({
    priority,
    count: counts[priority],
    pointsEach: POINTS_PER_PRIORITY[priority],
    pointsLost: counts[priority] * POINTS_PER_PRIORITY[priority],
  }));

  const totalLost = lines.reduce((sum, line) => sum + line.pointsLost, 0);

  return {
    score: computeScore(counts),
    lines,
    totalLost,
    clamped: totalLost > MAX_SCORE,
  };
}
