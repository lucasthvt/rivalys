"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import type { SaasType } from "@/lib/supabase/database.types";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ContourMarks } from "../../login/_components/ContourMarks";
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

const TOTAL_STEPS = 5;

const INDUSTRY_SUGGESTIONS = ["Productivité", "Marketing", "RH", "Finance", "E-commerce"];

type OnboardingFormState = {
  firstName: string;
  saasType: SaasType | null;
  industry: string;
  productDescription: string;
  saasUrl: string;
  competitorUrl: string;
};

const INITIAL_STATE: OnboardingFormState = {
  firstName: "",
  saasType: null,
  industry: "",
  productDescription: "",
  saasUrl: "",
  competitorUrl: "",
};

function isLikelyUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

export function OnboardingWizard() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingFormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

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
        return isLikelyUrl(form.competitorUrl);
      default:
        return false;
    }
  })();

  /**
   * Kicks off the first comparator run. Never throws and never blocks the
   * founder's path to their dashboard — a manual "actualiser" there covers
   * the retry. Returns whether the analysis actually succeeded so the
   * caller can flag a failed first run without swallowing it silently.
   */
  async function triggerFirstComparison(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch("/api/compare", { method: "POST", signal: controller.signal });

      let payload: { ok?: boolean; error?: string } | null = null;
      try {
        payload = await res.json();
      } catch {
        // Empty or non-JSON body — fall through, res.ok below still decides.
      }

      if (!res.ok || !payload?.ok) {
        console.warn(
          "Premier comparateur échoué :",
          payload?.error ?? `HTTP ${res.status}`,
        );
        return false;
      }

      return true;
    } catch (err) {
      // Network error, timeout/abort, /api/compare not reachable, etc.
      console.warn("Premier comparateur : requête impossible.", err);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

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
      competitorUrl: form.competitorUrl,
    });

    if (!result.ok) {
      setSubmitError(result.error);
      setSubmitting(false);
      return;
    }

    setAnalyzing(true);
    const analysisSucceeded = await triggerFirstComparison();
    router.push(analysisSucceeded ? "/dashboard" : "/dashboard?firstRunFailed=1");
    router.refresh();
  }

  function handleBack() {
    setSubmitError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  if (analyzing) {
    return (
      <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-[#1F2A22] px-6 text-center">
        <ContourMarks className="pointer-events-none absolute h-[520px] w-[520px] animate-pulse text-[#3F4F41] motion-reduce:animate-none" />
        <p className="relative z-10 [font-family:var(--font-mono-auth)] text-[11px] uppercase tracking-[0.2em] text-[#C7CBB8]">
          Rivalys
        </p>
        <p className="relative z-10 mt-4 max-w-sm [font-family:var(--font-display-auth)] text-2xl text-[#F0EEE3] sm:text-3xl">
          On regarde le terrain d&apos;en face...
        </p>
        <p className="relative z-10 mt-3 text-sm text-[#A9B6A2]">
          Analyse de {form.competitorUrl || "ton concurrent"} en cours.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#F6F4EC] px-6 py-10 sm:px-10 lg:px-16">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center justify-between">
          <span className="[font-family:var(--font-mono-auth)] text-[11px] font-medium uppercase tracking-[0.28em] text-[#6B7A6C]">
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
              <h1 className="[font-family:var(--font-display-auth)] text-3xl text-[#1F2A22] sm:text-4xl">
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
              <h1 className="[font-family:var(--font-display-auth)] text-3xl text-[#1F2A22] sm:text-4xl">
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
              <h1 className="[font-family:var(--font-display-auth)] text-3xl text-[#1F2A22] sm:text-4xl">
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
              <h1 className="[font-family:var(--font-display-auth)] text-3xl text-[#1F2A22] sm:text-4xl">
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
              <h1 className="[font-family:var(--font-display-auth)] text-3xl text-[#1F2A22] sm:text-4xl">
                Quel est ton plus gros concurrent ?
              </h1>
              <p className="mt-3 max-w-sm text-sm text-[#46524A]">
                On compare uniquement ce qui est déjà public sur son site — pricing, avis,
                positionnement.
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
