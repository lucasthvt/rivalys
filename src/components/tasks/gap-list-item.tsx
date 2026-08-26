import { CATEGORY_LABEL, type DetectedGap } from "./priority";
import { PriorityBadge } from "./priority-badge";
import { GapActions } from "./gap-actions";

export function GapListItem({ gap }: { gap: DetectedGap }) {
  return (
    <li className="flex flex-col gap-3 border-b border-surface-border py-5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <PriorityBadge priority={gap.priority} />
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground-muted/70">
            {CATEGORY_LABEL[gap.category]}
          </span>
        </div>
        <h3 className="text-[15px] font-medium text-foreground">{gap.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-foreground-muted">{gap.description}</p>
      </div>
      <GapActions gapId={gap.id} />
    </li>
  );
}
