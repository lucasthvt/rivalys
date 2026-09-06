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

// La priorité s'exprime en intensité d'un seul accent, jamais en trois teintes.
// Trois couleurs distinctes forment un feu tricolore, et un feu tricolore dit
// qu'une priorité basse est un état sain — or un écart de priorité basse reste
// un écart. C'est la règle que la landing applique déjà (voir la bande des
// règles et les barres du score) ; ces valeurs sont exactement ses trois
// intensités de --color-signal-bright, en rgba parce qu'elles sont posées en
// style en ligne, où color-mix() sur une variable de thème ne s'évalue pas.
export const PRIORITY_COLOR: Record<GapPriority, string> = {
  high: "rgb(163 148 255)",
  medium: "rgb(163 148 255 / 0.55)",
  low: "rgb(163 148 255 / 0.25)",
};

export const CATEGORY_LABEL: Record<DetectedGap["category"], string> = {
  pricing: "Pricing",
  positioning: "Positionnement",
  reviews: "Avis",
  social_presence: "Réseaux",
  auth: "Connexion",
  payment: "Paiement",
};

// System monospace stack used for every "instrument readout" element
// (badges, labels, numeric values) across the tasks/dashboard screens.
export const MONO_STACK =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
