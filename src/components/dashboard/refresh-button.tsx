"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface CompareResponse {
  ok: boolean;
  gapsCount?: number;
  error?: string;
  /** Sent with a 429 only: when the next analysis becomes possible (ISO 8601). */
  retryAfterIso?: string;
}

/**
 * A 429 is not a failure: the analysis already ran within the last 24 h and the limit is
 * doing its job (see /api/compare's rate limit). It reads as information, not as an alarm.
 */
type Feedback = { kind: "info" | "error"; message: string };

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [elapsed, setElapsed] = useState(0);

  /**
   * Compteur de secondes pendant l'analyse.
   *
   * Le pipeline lit quatre pages, appelle Claude deux fois et interroge le web : une
   * minute est normale, deux arrivent. Sans ce compteur, un bouton figé sur « Analyse en
   * cours… » ne se distingue pas d'une page bloquée, et l'utilisateur recharge — ce qui
   * ne fait qu'abandonner le travail en cours.
   */
  useEffect(() => {
    // La remise à zéro se fait au clic, pas ici : appeler setState dans le corps d'un
    // effet déclenche un rendu supplémentaire pour rien (react-hooks/set-state-in-effect).
    if (!isPending) return;
    const started = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.round((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isPending]);

  function handleClick() {
    setFeedback(null);
    setElapsed(0);
    startTransition(async () => {
      try {
        const res = await fetch("/api/compare", { method: "POST" });

        // /api/compare always returns a JSON body — including a precise, French
        // `error` message — on every status code (401/400/422/429/500), not just on
        // success. Parse it before branching on res.ok so that message reaches
        // the user instead of a generic fallback.
        const json = (await res.json().catch(() => null)) as CompareResponse | null;

        if (res.status === 429) {
          setFeedback({
            kind: "info",
            message:
              json?.error ??
              "Analyse déjà effectuée il y a moins de 24 h. Reviens un peu plus tard.",
          });
          return;
        }

        if (!res.ok || !json || json.ok !== true) {
          setFeedback({
            kind: "error",
            message: json?.error ?? "L'analyse a échoué. Réessaie dans un instant.",
          });
          return;
        }

        router.refresh();
      } catch {
        setFeedback({ kind: "error", message: "Impossible de contacter le service d'analyse." });
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center rounded-full bg-signal px-6 text-sm font-semibold text-paper shadow-signal-sm transition-colors hover:bg-signal-bright hover:text-void disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? `Analyse en cours… ${elapsed} s` : "Actualiser"}
      </button>
      {isPending && elapsed >= 45 && (
        <p className="max-w-[240px] text-right text-xs text-mist">
          Lecture de ton site puis de chaque concurrent suivi. Compte jusqu&rsquo;à deux
          minutes par concurrent — ne recharge pas la page.
        </p>
      )}
      {feedback && (
        <p
          className={`max-w-[240px] text-right text-xs ${
            feedback.kind === "info" ? "text-mist" : "text-flare"
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
