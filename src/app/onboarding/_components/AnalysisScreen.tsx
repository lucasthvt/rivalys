"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { wizardErrorBox, wizardPrimaryButton } from "./Fields";

type Phase = "running" | "failed";

const STEPS = [
  "Lecture de ton site",
  "Lecture du site de ton concurrent",
  "Extraction des tarifs affichés",
  "Comparaison et détection des écarts",
];

/**
 * Runs the first comparison right after onboarding, then hands over to the
 * dashboard. The analysis is a single POST — the rotating labels below
 * describe the pipeline's real stages but are not a progress read-out, so
 * they never claim a step has finished when it hasn't.
 */
export function AnalysisScreen({ competitorLabel }: { competitorLabel: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("running");
  const [error, setError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // React runs effects twice in dev StrictMode. The analysis costs real
  // Firecrawl/Claude credits, so it must fire exactly once.
  //
  // Deliberately no "cancelled" flag alongside this guard: the cleanup of the
  // first pass would set it, the second pass would bail on the ref, and the
  // in-flight response would land with nothing left listening — the screen
  // would sit on "Analyse en cours..." forever. React 18 no longer warns on
  // setState after unmount, so letting the handler run is the safe option.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function run() {
      try {
        const response = await fetch("/api/compare", { method: "POST" });
        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error: unknown }).error)
              : "L'analyse n'a pas abouti.";
          setError(message);
          setPhase("failed");
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } catch {
        setError("L'analyse n'a pas pu être lancée. Ta connexion a peut-être été interrompue.");
        setPhase("failed");
      }
    }

    void run();
  }, [router]);

  // Purely cosmetic cadence, stopped as soon as the run ends.
  useEffect(() => {
    if (phase !== "running") return;
    const timer = setInterval(() => {
      setStepIndex((index) => Math.min(index + 1, STEPS.length - 1));
    }, 6000);
    return () => clearInterval(timer);
  }, [phase]);

  /**
   * Secondes écoulées. Le pipeline lit quatre pages, appelle Claude deux fois et
   * interroge le web : une minute est normale, deux arrivent. Sans ce compteur, l'écran
   * ne se distingue pas d'une page bloquée, et le fondateur recharge — ce qui abandonne
   * l'analyse en cours.
   */
  useEffect(() => {
    if (phase !== "running") return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  return (
    <div className="flex min-h-screen flex-1 flex-col justify-center bg-background px-6 py-10 sm:px-10 lg:px-16">
      <div className="mx-auto w-full max-w-xl">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-foreground-muted">
          Rivalys
        </span>

        {phase === "running" ? (
          <>
            <h1 className="mt-8 font-display text-3xl text-foreground sm:text-4xl">
              Analyse en cours...
            </h1>
            <p className="mt-4 text-foreground-muted">
              On compare ton SaaS à {competitorLabel}. Compte une à deux minutes — ne ferme
              pas cette page.
            </p>
            <p className="font-mono mt-3 text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
              {elapsed} s écoulées
            </p>

            <ul className="mt-10 flex flex-col gap-3">
              {STEPS.map((step, index) => (
                <li
                  key={step}
                  className={`flex items-center gap-3 text-sm transition-colors ${
                    index <= stepIndex ? "text-foreground" : "text-foreground-muted/50"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      index < stepIndex
                        ? "bg-accent"
                        : index === stepIndex
                          ? "animate-pulse bg-accent"
                          : "bg-surface-border"
                    }`}
                  />
                  {step}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <h1 className="mt-8 font-display text-3xl text-foreground sm:text-4xl">
              L&apos;analyse n&apos;a pas abouti.
            </h1>
            <p className={`${wizardErrorBox} mt-6`} role="alert">
              {error}
            </p>
            <p className="mt-4 text-sm text-foreground-muted">
              Ton profil et ton concurrent sont enregistrés. Tu peux relancer l&apos;analyse
              depuis le tableau de bord.
            </p>
            <button
              type="button"
              className={`${wizardPrimaryButton} mt-8`}
              onClick={() => {
                router.push("/dashboard");
                router.refresh();
              }}
            >
              Aller au tableau de bord
            </button>
          </>
        )}
      </div>
    </div>
  );
}
