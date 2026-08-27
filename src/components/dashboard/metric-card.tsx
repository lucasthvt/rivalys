import Link from "next/link";
import type { ReactNode } from "react";

function CardBody({
  label,
  value,
  sublabel,
  action,
}: {
  label: string;
  value: string;
  sublabel?: string;
  action?: ReactNode;
}) {
  return (
    <>
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
      {action}
    </>
  );
}

/**
 * A single dashboard metric. Pass `href` to make the whole card a link — used by the score
 * card, which opens its own breakdown page.
 */
export function MetricCard({
  label,
  value,
  sublabel,
  href,
  linkLabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
  href?: string;
  /** Visible affordance for the link, so the card doesn't rely on hover alone. */
  linkLabel?: string;
}) {
  const base = "block border border-surface-border bg-surface px-5 py-4";

  if (!href) {
    return (
      <div className={base}>
        <CardBody label={label} value={value} sublabel={sublabel} />
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} transition-colors hover:border-accent-strong/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
    >
      <CardBody
        label={label}
        value={value}
        sublabel={sublabel}
        action={
          <span className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-accent-strong">
            {linkLabel ?? "Détail"}
            <span aria-hidden="true">→</span>
          </span>
        }
      />
    </Link>
  );
}
