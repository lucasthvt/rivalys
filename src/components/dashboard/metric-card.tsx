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
    <div className="border border-surface-border bg-surface px-5 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
        {label}
      </p>
      <p
        className="font-mono mt-2 truncate text-[28px] leading-tight tracking-tight text-foreground"
        title={value}
      >
        {value}
      </p>
      {sublabel && <p className="mt-1.5 text-xs text-foreground-muted">{sublabel}</p>}
    </div>
  );
}
