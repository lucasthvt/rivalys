"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { SaasType } from "@/lib/supabase/database.types";
import { isLikelyUrl } from "@/lib/url";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { completeOnboarding } from "../actions";
import {
  BigField,
  BigTextArea,
  ChoiceCard,
  SuggestionChip,
  wizardErrorBox,
  wizardGhostButton,
  wizardPrimaryButton,
} from "./Fields";

/**
 * Onboarding collects the founder's own product only. The competitor is added
 * afterwards, from /concurrent inside the app — so it can also be changed
 * later, which a one-shot wizard field never allowed.
 */
const TOTAL_STEPS = 4;

const INDUSTRY_SUGGESTIONS = ["Productivité", "Marketing", "RH", "Finance", "E-commerce"];

type OnboardingFormState = {
  firstName: string;
  saasType: SaasType | null;
  industry: string;
  productDescription: string;
  saasUrl: string;
};

const INITIAL_STATE: OnboardingFormState = {
  firstName: "",
  saasType: null,
  industry: "",
  productDescription: "",
  saasUrl: "",
};

export function OnboardingWizard() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingFormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function update<K extends keyof OnboardingFormState>(key: K, value: OnboardingFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const canContinue = (() => {
    switch (step) {
      case 0:
        return form.firstName.trim().length > 0;
      case 1:
        return form.saasType !== null;
      case 2:
        return form.industry.trim().length > 0;
      case 3:
        return form.productDescription.trim().length > 0 && isLikelyUrl(form.saasUrl);
      default:
        return false;
    }
  })();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canContinue) return;

    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }

    if (form.saasType === null) return;

    setSubmitting(true);
    setSubmitError(null);

    const result = await completeOnboarding({
      firstName: form.firstName,
      saasType: form.saasType,
      industry: form.industry,
      productDescription: form.productDescription,
      saasUrl: form.saasUrl,
    });

    if (!result.ok) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    // No analysis to launch here: there is no competitor yet. The dashboard
    // points to /concurrent for that.
    router.push("/dashboard");
    router.refresh();
  }

  function handleBack() {
    setSubmitError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background px-6 py-10 sm:px-10 lg:px-16">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-foreground-muted">
            Rivalys
          </span>
        </div>

        <div className="mt-8 max-w-xs">
          <ProgressBar variant="steps" step={step + 1} totalSteps={TOTAL_STEPS} showLabel />
        </div>

        <form onSubmit={handleSubmit} className="mt-10" noValidate>
          {submitError ? (
            <p className={`${wizardErrorBox} mb-6`} role="alert">
              {submitError}
            </p>
          ) : null}

          {step === 0 ? (
            <div>
              <h1 className="font-display text-3xl text-foreground sm:text-4xl">
                Comment tu t&apos;appelles ?
              </h1>
              <div className="mt-8 max-w-sm">
                <BigField
                  id="firstName"
                  label="Prénom"
                  autoFocus
                  required
                  value={form.firstName}
                  onChange={(e) => update("firstName", e.target.value)}
                  placeholder="Alex"
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div>
              <h1 className="font-display text-3xl text-foreground sm:text-4xl">
                Ton SaaS est plutôt B2B ou B2C ?
              </h1>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <ChoiceCard
                  title="B2B"
                  description="Tu vends à des entreprises."
                  active={form.saasType === "b2b"}
                  onClick={() => update("saasType", "b2b")}
                />
                <ChoiceCard
                  title="B2C"
                  description="Tu vends à des particuliers."
                  active={form.saasType === "b2c"}
                  onClick={() => update("saasType", "b2c")}
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h1 className="font-display text-3xl text-foreground sm:text-4xl">
                Dans quel secteur ?
              </h1>
              <div className="mt-8 max-w-sm">
                <BigField
                  id="industry"
                  label="Secteur"
                  autoFocus
                  required
                  value={form.industry}
                  onChange={(e) => update("industry", e.target.value)}
                  placeholder="Productivité, marketing, RH..."
                />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {INDUSTRY_SUGGESTIONS.map((suggestion) => (
                  <SuggestionChip
                    key={suggestion}
                    label={suggestion}
                    active={form.industry.trim().toLowerCase() === suggestion.toLowerCase()}
                    onClick={() => update("industry", suggestion)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <h1 className="font-display text-3xl text-foreground sm:text-4xl">
                Parle-nous de ton produit en une phrase.
              </h1>
              <div className="mt-8 flex max-w-sm flex-col gap-8">
                <BigTextArea
                  id="productDescription"
                  label="Ton produit"
                  autoFocus
                  required
                  value={form.productDescription}
                  onChange={(e) => update("productDescription", e.target.value)}
                  placeholder="Le CRM le plus simple pour les indépendants."
                />
                <BigField
                  id="saasUrl"
                  label="URL de ton SaaS"
                  type="text"
                  inputMode="url"
                  required
                  value={form.saasUrl}
                  onChange={(e) => update("saasUrl", e.target.value)}
                  placeholder="tonsaas.com"
                  className="text-lg sm:text-xl"
                />
              </div>
            </div>
          ) : null}

          <div className="mt-10 flex items-center gap-3">
            {step > 0 ? (
              <button
                type="button"
                className={wizardGhostButton}
                onClick={handleBack}
                disabled={submitting}
              >
                Précédent
              </button>
            ) : null}
            <button type="submit" className={wizardPrimaryButton} disabled={!canContinue || submitting}>
              {submitting
                ? "Enregistrement..."
                : step === TOTAL_STEPS - 1
                  ? "Terminer"
                  : "Continuer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
