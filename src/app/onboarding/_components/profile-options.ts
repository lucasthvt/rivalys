import type { MainGoal, PricingModel, ProductStage, SaasType } from "@/lib/supabase/database.types";

/**
 * Wording for the profile questions added to onboarding. Kept out of the
 * wizard component so the labels can be reused (profil, réglages) without
 * dragging the whole form along.
 *
 * The stored values are the DB enums declared in
 * supabase/migrations/20260828000000_add_onboarding_profile_fields.sql — the
 * check constraints and these lists must stay in sync.
 */
export type Choice<T extends string> = {
  value: T;
  title: string;
  description: string;
};

export const PRODUCT_STAGES: Choice<ProductStage>[] = [
  { value: "idea", title: "Idée", description: "Pas encore de client payant." },
  { value: "launched", title: "Lancé", description: "Premiers clients, revenus qui démarrent." },
  { value: "growing", title: "En croissance", description: "Revenus réguliers, ça monte." },
  { value: "mature", title: "Mature", description: "Produit installé, croissance stable." },
];

export const PRICING_MODELS: Choice<PricingModel>[] = [
  { value: "freemium", title: "Freemium", description: "Un palier gratuit permanent." },
  { value: "free_trial", title: "Essai gratuit", description: "Payant, après une période d'essai." },
  { value: "subscription", title: "Abonnement", description: "Payant dès le départ, sans essai." },
  { value: "one_time", title: "Paiement unique", description: "On achète une fois, pas d'abonnement." },
];

export const MAIN_GOALS: Choice<MainGoal>[] = [
  { value: "acquisition", title: "Acquisition", description: "Attirer plus de visiteurs qualifiés." },
  { value: "conversion", title: "Conversion", description: "Transformer plus de visiteurs en clients." },
  { value: "retention", title: "Rétention", description: "Garder les clients plus longtemps." },
  { value: "pricing", title: "Pricing", description: "Trouver le bon prix, le bon packaging." },
];

/** Starting points for the free-text "cible" field, split by who buys. */
export const TARGET_SUGGESTIONS: Record<SaasType, string[]> = {
  b2b: [
    "Freelances",
    "Startups early-stage",
    "PME 10-50 salariés",
    "ETI & grands comptes",
    "Agences",
    "E-commerçants",
    "Équipes marketing",
    "Équipes tech",
    "Dirigeants",
  ],
  b2c: [
    "Étudiants",
    "Jeunes actifs",
    "Parents",
    "Créateurs de contenu",
    "Sportifs",
    "Investisseurs particuliers",
    "Retraités",
  ],
};
