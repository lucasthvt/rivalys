import type { SubscriptionTier } from "@/lib/supabase/database.types";

/**
 * Places de concurrent ouvertes par palier.
 *
 * Une place = un site relu à chaque cycle d'analyse = un coût réel (fetch +
 * extraction Claude + enrichissement Perplexity). C'est ce coût qui est facturé,
 * pas le fait de figer une URL — d'où un remplacement autorisé, mais espacé.
 *
 * Les trois places de Growth sont servies depuis la livraison du multi-concurrent :
 * le pipeline analyse chaque concurrent suivi, et les écrans se lisent concurrent
 * par concurrent. Tant que ce n'était pas le cas, la page tarifs ne vendait pas
 * Growth — le produit ne doit pas encaisser une capacité qu'il ne sert pas.
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

export type SlotAllowance =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: string };

/**
 * Reste-t-il une place pour un concurrent de plus ?
 *
 * Le message d'échec nomme le palier atteint et ce qu'ouvre le suivant, parce qu'un
 * refus qui dit seulement « limite atteinte » oblige à aller chercher ailleurs de
 * quoi décider. Il ne promet rien au-delà de ce que la grille contient réellement.
 */
export function canAddCompetitor(
  tier: SubscriptionTier,
  currentCount: number,
): SlotAllowance {
  const slots = COMPETITOR_SLOTS[tier];
  const remaining = slots - currentCount;

  if (remaining > 0) return { allowed: true, remaining };

  const growthSlots = COMPETITOR_SLOTS.growth;
  return {
    allowed: false,
    reason:
      tier === "growth"
        ? `Tes ${growthSlots} places de concurrent sont occupées. Remplace l'URL de l'une d'elles pour suivre un autre site.`
        : `Ton palier ouvre ${slots} place${slots > 1 ? "s" : ""} de concurrent. Growth en ouvre ${growthSlots}.`,
  };
}
