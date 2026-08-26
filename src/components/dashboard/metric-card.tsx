import { MONO_STACK } from "@/components/tasks/priority";

export function MetricCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="border border-[#2A362F] bg-[#17211C] px-5 py-4">
      <p
        className="text-[11px] uppercase tracking-[0.16em] text-[#5C7568]"
        style={{ fontFamily: MONO_STACK }}
      >
        {label}
      </p>
      <p
        className="mt-2 truncate text-[28px] leading-tight tracking-tight text-[#EDF2EE]"
        style={{ fontFamily: MONO_STACK }}
        title={value}
      >
        {value}
      </p>
      {sublabel && <p className="mt-1.5 text-xs text-[#8CA093]">{sublabel}</p>}
    </div>
  );
}
