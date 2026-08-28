import type { SubscriptionTier } from "@/lib/supabase/database.types";

/**
 * Qui a accès au détail des résultats d'analyse.
 *
 * L'analyse tourne pour tout le monde — elle est déclenchée à la fin de
 * l'onboarding, et le compte d'écarts détectés reste visible. Ce qu'elle a
 * trouvé (score, écarts, comparatif, historique) est réservé aux paliers
 * payants.
 *
 * `starter` est le palier gratuit par défaut à la création du compte
 * (`profiles.subscription_tier`). Tant que la facturation n'est pas branchée,
 * le passage à `pro`/`growth` se fait à la main en base — voir le README.
 */
const PAID_TIERS: SubscriptionTier[] = ["pro", "growth"];

export function hasPaidAccess(tier: SubscriptionTier | null | undefined): boolean {
  return tier !== null && tier !== undefined && PAID_TIERS.includes(tier);
}
