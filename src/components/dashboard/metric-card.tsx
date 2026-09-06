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
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist/60">{label}</p>
      {/*
        Le chiffre passe en Golos, comme la carte de score de la landing : en mono
        il se lisait comme une sortie de terminal, alors que c'est la valeur que
        l'écran met en avant. tabular-nums garde la chasse fixe d'un chiffre à
        l'autre, ce que le mono assurait gratuitement.
      */}
      <p
        className="mt-2.5 truncate font-brand text-[1.9rem] font-bold leading-[1] tracking-[-0.035em] tabular-nums text-paper"
        title={value}
      >
        {value}
      </p>
      {sublabel && <p className="mt-2 text-xs text-mist">{sublabel}</p>}
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
  const base = "panel flex h-full flex-col justify-center px-5 py-5";

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
      className={`${base} transition-colors hover:border-signal-bright/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
    >
      <CardBody
        label={label}
        value={value}
        sublabel={sublabel}
        action={
          <span className="mt-3 inline-flex items-center gap-1.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-signal-bright">
            {linkLabel ?? "Détail"}
            <span aria-hidden="true">→</span>
          </span>
        }
      />
    </Link>
  );
}
