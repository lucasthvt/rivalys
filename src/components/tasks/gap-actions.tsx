"use client";

import { useState, useTransition } from "react";
import { dismissGap, markGapDone } from "@/app/tasks/actions";
import { MONO_STACK } from "./priority";

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
          style={{ fontFamily: MONO_STACK }}
          className="border border-[#2A362F] px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-[#8CA093] transition-colors hover:border-[#49D6A8] hover:text-[#49D6A8] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "done" ? "…" : "Fait"}
        </button>
        <button
          type="button"
          onClick={() => run("dismiss")}
          disabled={isPending}
          style={{ fontFamily: MONO_STACK }}
          className="border border-[#2A362F] px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-[#8CA093] transition-colors hover:border-[#EDF2EE] hover:text-[#EDF2EE] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending === "dismiss" ? "…" : "Ignorer"}
        </button>
      </div>
      {error && <p className="max-w-[200px] text-right text-xs text-[#FF6B47]">{error}</p>}
    </div>
  );
}
