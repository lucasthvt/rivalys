"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MONO_STACK } from "@/components/tasks/priority";

interface CompareResponse {
  ok: boolean;
  gapsCount?: number;
  error?: string;
}

export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/compare", { method: "POST" });

        // /api/compare always returns a JSON body — including a precise, French
        // `error` message — on every status code (401/400/422/500), not just on
        // success. Parse it before branching on res.ok so that message reaches
        // the user instead of a generic fallback.
        const json = (await res.json().catch(() => null)) as CompareResponse | null;

        if (!res.ok || !json || json.ok !== true) {
          setError(json?.error ?? "L'analyse a échoué. Réessaie dans un instant.");
          return;
        }

        router.refresh();
      } catch {
        setError("Impossible de contacter le service d'analyse.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        style={{ fontFamily: MONO_STACK }}
        className="border border-[#2A362F] bg-[#17211C] px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-[#EDF2EE] transition-colors hover:border-[#49D6A8] hover:text-[#49D6A8] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Analyse en cours…" : "Actualiser"}
      </button>
      {error && <p className="max-w-[220px] text-right text-xs text-[#FF6B47]">{error}</p>}
    </div>
  );
}
