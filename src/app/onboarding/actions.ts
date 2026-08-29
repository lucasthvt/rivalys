"use server";

import { createClient } from "@/lib/supabase/server";
import { isLikelyUrl, normalizeUrl } from "@/lib/url";
import type {
  MainGoal,
  PricingModel,
  ProductStage,
  SaasType,
} from "@/lib/supabase/database.types";
import { setCompetitor } from "../concurrent/actions";

export type CompleteOnboardingInput = {
  firstName: string;
  saasType: SaasType;
  industry: string;
  productDescription: string;
  saasUrl: string;
  productStage: ProductStage;
  pricingModel: PricingModel;
  mainGoal: MainGoal;
  targetCustomer: string;
  competitorUrl: string;
};

export type CompleteOnboardingResult = { ok: true } | { ok: false; error: string };

const PRODUCT_STAGES: ProductStage[] = ["idea", "launched", "growing", "mature"];
const PRICING_MODELS: PricingModel[] = ["freemium", "free_trial", "subscription", "one_time"];
const MAIN_GOALS: MainGoal[] = ["acquisition", "conversion", "retention", "pricing"];

/**
 * Final onboarding step: persists the profile and the primary competitor
 * server side (never from the client directly, so RLS's `auth.uid()` check is
 * the only thing that can ever authorize the write).
 *
 * `onboarding_completed` is flipped last, on purpose. The competitor is what
 * makes the dashboard mean anything, so a run that saves the profile and then
 * fails to save the competitor must not count as finished — the founder lands
 * back on this wizard rather than on an empty product.
 */
export async function completeOnboarding(
  input: CompleteOnboardingInput,
): Promise<CompleteOnboardingResult> {
  const firstName = input.firstName.trim();
  const industry = input.industry.trim();
  const productDescription = input.productDescription.trim();
  const saasUrl = input.saasUrl.trim();
  const targetCustomer = input.targetCustomer.trim();
  const competitorUrl = input.competitorUrl.trim();

  if (!firstName) return { ok: false, error: "Ton prénom est manquant." };
  if (input.saasType !== "b2b" && input.saasType !== "b2c") {
    return { ok: false, error: "Précise si ton SaaS est B2B ou B2C." };
  }
  if (!industry) return { ok: false, error: "Le secteur est manquant." };
  if (!isLikelyUrl(saasUrl)) {
    return { ok: false, error: "L'URL de ton SaaS ne semble pas valide." };
  }
  if (!PRODUCT_STAGES.includes(input.productStage)) {
    return { ok: false, error: "Précise où en est ton produit." };
  }
  if (!PRICING_MODELS.includes(input.pricingModel)) {
    return { ok: false, error: "Précise ton modèle de prix actuel." };
  }
  if (!MAIN_GOALS.includes(input.mainGoal)) {
    return { ok: false, error: "Précise ton objectif principal." };
  }
  if (!targetCustomer) return { ok: false, error: "Précise qui achète ton produit." };
  if (!isLikelyUrl(competitorUrl)) {
    return { ok: false, error: "L'URL de ton concurrent ne semble pas valide." };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, error: "Ta session a expiré — reconnecte-toi." };
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    first_name: firstName,
    saas_type: input.saasType,
    industry,
    product_description: productDescription || null,
    saas_url: normalizeUrl(saasUrl),
    product_stage: input.productStage,
    pricing_model: input.pricingModel,
    main_goal: input.mainGoal,
    target_customer: targetCustomer,
    onboarding_completed: false,
    // Trace horodatée de l'acceptation des CGU cochée à l'inscription. La valeur envoyée
    // ici n'est pas celle qui sera stockée : un déclencheur la remplace par l'horloge de
    // la base (voir 20260830010000_add_terms_accepted_at.sql), pour qu'une acceptation ne
    // puisse pas être antidatée par celui qui accepte.
    terms_accepted_at: new Date().toISOString(),
  });

  if (profileError) {
    return { ok: false, error: "Impossible d'enregistrer ton profil. Réessaie." };
  }

  // Written after the profile: setCompetitor reads `profiles.saas_url` to
  // refuse a competitor URL that points at the founder's own site.
  const competitorResult = await setCompetitor(competitorUrl);
  if (!competitorResult.ok) {
    return competitorResult;
  }

  const { error: completionError } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);

  if (completionError) {
    return { ok: false, error: "Impossible de finaliser ton profil. Réessaie." };
  }

  return { ok: true };
}
