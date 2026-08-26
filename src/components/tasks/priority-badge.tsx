import { MONO_STACK, PRIORITY_COLOR, PRIORITY_LABEL, type GapPriority } from "./priority";

export function PriorityBadge({ priority }: { priority: GapPriority }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 border border-[#2A362F] bg-[#17211C] px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-[#8CA093]"
      style={{ fontFamily: MONO_STACK }}
    >
      <span
        aria-hidden
        className="h-2.5 w-1 shrink-0"
        style={{ backgroundColor: PRIORITY_COLOR[priority] }}
      />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
