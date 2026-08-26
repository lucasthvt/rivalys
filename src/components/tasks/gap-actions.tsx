"use client";

import { useState, useTransition } from "react";
import { dismissGap, markGapDone } from "@/app/tasks/actions";

type Action = "done" | "dismiss";

export function GapActions({ gapId }: { gapId: string }) {
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: Action) {
    setError(null);
    setPending(action);
    startTransition(async () => {
      const result = action === "done" ? await markGapDone(gapId) : await dismissGap(gapId);
      if (!result.ok) {
        setError(result.error);
      }
      setPending(null);
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => run("done")}
          disabled={isPending}
          className="border border-surface-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-foreground-muted transition-colors hover:border-mint hover:text-mint disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "done" ? "…" : "Fait"}
        </button>
        <button
          type="button"
          onClick={() => run("dismiss")}
          disabled={isPending}
          className="border border-surface-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-foreground-muted transition-colors hover:border-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "dismiss" ? "…" : "Ignorer"}
        </button>
      </div>
      {error && <p className="max-w-[200px] text-right text-xs text-flare">{error}</p>}
    </div>
  );
}
