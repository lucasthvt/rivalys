import { PRIORITY_COLOR, PRIORITY_LABEL, type GapPriority } from "./priority";

export function PriorityBadge({ priority }: { priority: GapPriority }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-surface-border bg-surface px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-foreground-muted">
      <span
        aria-hidden
        className="h-2.5 w-1 shrink-0"
        style={{ backgroundColor: PRIORITY_COLOR[priority] }}
      />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
