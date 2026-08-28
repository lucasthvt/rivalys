import type { SubscriptionTier } from "@/lib/supabase/database.types";

/**
 * Places de concurrent ouvertes par palier.
 *
 * Une place = un site relu à chaque cycle d'analyse = un coût réel (fetch +
 * extraction Claude + enrichissement Perplexity). C'est ce coût qui est facturé,
 * pas le fait de figer une URL — d'où un remplacement autorisé, mais espacé.
 *
 * Growth annonce 3 places, mais le pipeline et les écrans ne gèrent aujourd'hui
 * qu'un seul concurrent primaire. Tant que ce chantier n'est pas livré, la page
 * tarifs porte la mention « à venir » sur le multi-concurrent — le produit ne
 * doit pas encaisser une capacité qu'il ne sert pas.
 */
export const COMPETITOR_SLOTS: Record<SubscriptionTier, number> = {
  starter: 1,
  pro: 1,
  growth: 3,
};

/** Délai minimal entre deux remplacements d'un même concurrent, en jours. */
export const COMPETITOR_CHANGE_COOLDOWN_DAYS = 30;

const COOLDOWN_MS = COMPETITOR_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export type ChangeAllowance =
  | { allowed: true }
  | { allowed: false; nextChangeAt: Date };

/**
 * Un remplacement est-il autorisé ?
 *
 * `lastChangedAt` à null = l'URL n'a jamais été remplacée : toujours autorisé.
 * Le délai borne les changements répétés (utiliser une place unique comme
 * scanner illimité), il ne piège pas quelqu'un qui s'est trompé d'adresse à
 * l'onboarding.
 */
export function checkCompetitorChange(
  lastChangedAt: Date | null,
  now: Date,
): ChangeAllowance {
  if (lastChangedAt === null || Number.isNaN(lastChangedAt.getTime())) {
    return { allowed: true };
  }

  const nextChangeAt = new Date(lastChangedAt.getTime() + COOLDOWN_MS);
  if (now >= nextChangeAt) return { allowed: true };

  return { allowed: false, nextChangeAt };
}

export function formatNextChangeDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
