"use client";

import { type FormEvent, useState } from "react";
import type { MainGoal, PricingModel, ProductStage, SaasType } from "@/lib/supabase/database.types";
import { isLikelyUrl } from "@/lib/url";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { completeOnboarding } from "../actions";
import {
  BigField,
  BigTextArea,
  ChoiceCard,
  ChoiceGrid,
  StepLegend,
  SuggestionChip,
  wizardErrorBox,
  wizardGhostButton,
  wizardPrimaryButton,
} from "./Fields";
import { IndustryPicker } from "./IndustryPicker";
import { AnalysisScreen } from "./AnalysisScreen";
import { MAIN_GOALS, PRICING_MODELS, PRODUCT_STAGES, TARGET_SUGGESTIONS } from "./profile-options";

/**
 * Seven steps, then the first analysis. The competitor is asked here — the
 * dashboard is meaningless without one, so ending onboarding before that
 * question drops the founder onto an empty product. It stays editable later
 * from /concurrent.
 */
const TOTAL_STEPS = 7;

type OnboardingFormState = {
  firstName: string;
  saasType: SaasType | null;
  industry: string;
  productDescription: string;
  saasUrl: string;
  productStage: ProductStage | null;
  pricingModel: PricingModel | null;
  mainGoal: MainGoal | null;
  targetCustomer: string;
  competitorUrl: string;
};

const INITIAL_STATE: OnboardingFormState = {
  firstName: "",
  saasType: null,
  industry: "",
  productDescription: "",
  saasUrl: "",
  productStage: null,
  pricingModel: null,
  mainGoal: null,
  targetCustomer: "",
  competitorUrl: "",
};

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingFormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Once saved, the wizard hands over to the first comparison. Never back.
  const [analysing, setAnalysing] = useState(false);

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
      case 4:
        return form.productStage !== null && form.pricingModel !== null;
      case 5:
        return form.mainGoal !== null && form.targetCustomer.trim().length > 0;
      case 6:
        return isLikelyUrl(form.competitorUrl);
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

    if (form.saasType === null || form.productStage === null || form.pricingModel === null) return;
    if (form.mainGoal === null) return;

    setSubmitting(true);
    setSubmitError(null);

    const result = await completeOnboarding({
      firstName: form.firstName,
      saasType: form.saasType,
      industry: form.industry,
      productDescription: form.productDescription,
      saasUrl: form.saasUrl,
      productStage: form.productStage,
      pricingModel: form.pricingModel,
      mainGoal: form.mainGoal,
      targetCustomer: form.targetCustomer,
      competitorUrl: form.competitorUrl,
    });

    if (!result.ok) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    setAnalysing(true);
  }

  function handleBack() {
    setSubmitError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  if (analysing) {
    return <AnalysisScreen competitorLabel={competitorLabel(form.competitorUrl)} />;
  }

  const targetSuggestions = TARGET_SUGGESTIONS[form.saasType ?? "b2b"];

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
              <p className="mt-3 text-sm text-foreground-muted">
                Choisis dans la liste, ou écris ta propre formulation.
              </p>
              <div className="mt-8">
                <IndustryPicker
                  value={form.industry}
                  onChange={(industry) => update("industry", industry)}
                />
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

          {step === 4 ? (
            <div>
              <h1 className="font-display text-3xl text-foreground sm:text-4xl">
                Où en est ton produit ?
              </h1>
              <p className="mt-3 text-sm text-foreground-muted">
                Sert à pondérer les écarts : un produit en phase d&apos;idée et un produit
                mature n&apos;ont pas les mêmes priorités.
              </p>

              <div className="mt-8">
                <StepLegend>Stade</StepLegend>
                <div className="mt-3">
                  <ChoiceGrid>
                    {PRODUCT_STAGES.map((choice) => (
                      <ChoiceCard
                        key={choice.value}
                        title={choice.title}
                        description={choice.description}
                        compact
                        active={form.productStage === choice.value}
                        onClick={() => update("productStage", choice.value)}
                      />
                    ))}
                  </ChoiceGrid>
                </div>
              </div>

              <div className="mt-8">
                <StepLegend>Modèle de prix actuel</StepLegend>
                <div className="mt-3">
                  <ChoiceGrid>
                    {PRICING_MODELS.map((choice) => (
                      <ChoiceCard
                        key={choice.value}
                        title={choice.title}
                        description={choice.description}
                        compact
                        active={form.pricingModel === choice.value}
                        onClick={() => update("pricingModel", choice.value)}
                      />
                    ))}
                  </ChoiceGrid>
                </div>
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            <div>
              <h1 className="font-display text-3xl text-foreground sm:text-4xl">
                Qu&apos;est-ce que tu veux gagner en premier ?
              </h1>
              <p className="mt-3 text-sm text-foreground-muted">
                Les écarts détectés seront triés dans ce sens.
              </p>

              <div className="mt-8">
                <StepLegend>Objectif principal</StepLegend>
                <div className="mt-3">
                  <ChoiceGrid>
                    {MAIN_GOALS.map((choice) => (
                      <ChoiceCard
                        key={choice.value}
                        title={choice.title}
                        description={choice.description}
                        compact
                        active={form.mainGoal === choice.value}
                        onClick={() => update("mainGoal", choice.value)}
                      />
                    ))}
                  </ChoiceGrid>
                </div>
              </div>

              <div className="mt-8 max-w-sm">
                <BigField
                  id="targetCustomer"
                  label="Qui achète, précisément"
                  autoComplete="off"
                  required
                  value={form.targetCustomer}
                  onChange={(e) => update("targetCustomer", e.target.value)}
                  placeholder="Freelances, PME 10-50..."
                  className="text-lg sm:text-xl"
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {targetSuggestions.map((suggestion) => (
                  <SuggestionChip
                    key={suggestion}
                    label={suggestion}
                    active={form.targetCustomer.trim() === suggestion}
                    onClick={() => update("targetCustomer", suggestion)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {step === 6 ? (
            <div>
              <h1 className="font-display text-3xl text-foreground sm:text-4xl">
                Quel est ton plus gros concurrent ?
              </h1>
              <p className="mt-3 text-sm text-foreground-muted">
                On lit son site public — tarifs affichés, positionnement, présence — et on le
                compare au tien. Tu pourras en changer à tout moment.
              </p>
              <div className="mt-8 max-w-sm">
                <BigField
                  id="competitorUrl"
                  label="URL du concurrent"
                  type="text"
                  inputMode="url"
                  autoFocus
                  required
                  value={form.competitorUrl}
                  onChange={(e) => update("competitorUrl", e.target.value)}
                  placeholder="concurrent.com"
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
                  ? "Lancer l'analyse"
                  : "Continuer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Hostname when the input parses as one, otherwise the raw text. */
function competitorLabel(url: string): string {
  const trimmed = url.trim();
  try {
    return new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return trimmed;
  }
}
