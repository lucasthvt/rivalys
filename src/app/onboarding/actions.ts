"use server";

import { createClient } from "@/lib/supabase/server";
import { isLikelyUrl, normalizeUrl } from "@/lib/url";
import type { SaasType } from "@/lib/supabase/database.types";

export type CompleteOnboardingInput = {
  firstName: string;
  saasType: SaasType;
  industry: string;
  productDescription: string;
  saasUrl: string;
};

export type CompleteOnboardingResult = { ok: true } | { ok: false; error: string };

/**
 * Final onboarding step: persists the profile server side (never from the
 * client directly, so RLS's `auth.uid()` check is the only thing that can
 * ever authorize the write).
 *
 * Deliberately does NOT create a competitor row: the competitor is added
 * afterwards from /concurrent, so it can also be replaced later.
 */
export async function completeOnboarding(
  input: CompleteOnboardingInput,
): Promise<CompleteOnboardingResult> {
  const firstName = input.firstName.trim();
  const industry = input.industry.trim();
  const productDescription = input.productDescription.trim();
  const saasUrl = input.saasUrl.trim();

  if (!firstName) return { ok: false, error: "Ton prénom est manquant." };
  if (input.saasType !== "b2b" && input.saasType !== "b2c") {
    return { ok: false, error: "Précise si ton SaaS est B2B ou B2C." };
  }
  if (!industry) return { ok: false, error: "Le secteur est manquant." };
  if (!isLikelyUrl(saasUrl)) {
    return { ok: false, error: "L'URL de ton SaaS ne semble pas valide." };
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
    onboarding_completed: true,
  });

  if (profileError) {
    return { ok: false, error: "Impossible d'enregistrer ton profil. Réessaie." };
  }

  return { ok: true };
}
