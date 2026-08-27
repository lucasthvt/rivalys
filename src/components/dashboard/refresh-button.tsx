"use client";

import { useState, useTransition } from "react";
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

  function handleClick() {
    setFeedback(null);
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
        className="font-mono border border-surface-border bg-surface px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-foreground transition-colors hover:border-mint hover:text-mint disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Analyse en cours…" : "Actualiser"}
      </button>
      {feedback && (
        <p
          className={`max-w-[220px] text-right text-xs ${
            feedback.kind === "info" ? "text-foreground-muted" : "text-flare"
          }`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
