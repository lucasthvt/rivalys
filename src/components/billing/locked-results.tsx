import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";

/**
 * Résultats d'analyse masqués pour un compte au palier gratuit.
 *
 * Le flou est décoratif, pas un mécanisme de sécurité : ce qui est rendu
 * derrière est un gabarit vide, jamais les vraies données. Une donnée floutée
 * en CSS reste lisible dans le HTML, donc elle n'est simplement pas envoyée au
 * navigateur tant que l'accès n'est pas ouvert.
 *
 * Ce qui reste visible ailleurs sur la page — analyse effectuée, date, nombre
 * d'écarts — est volontaire : l'utilisateur doit voir que le travail a bien été
 * fait, sans en obtenir le contenu.
 */
export function LockedResults({
  title = "Résultats réservés aux offres payantes",
  description,
  children,
}: {
  title?: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div
        className="pointer-events-none select-none blur-[6px] saturate-50"
        aria-hidden="true"
      >
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center px-4">
        <div className="panel max-w-md px-6 py-7 text-center backdrop-blur-sm">
          <LockIcon />
          <h2 className="font-display mt-4 text-xl text-foreground">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-foreground-muted">{description}</p>
          <Link
            href="/tarifs"
            className={`${buttonVariants({ variant: "primary", size: "md" })} mt-6`}
          >
            Voir les offres
          </Link>
        </div>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      className="mx-auto h-6 w-6 text-accent"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

/** Barre grise d'un gabarit. Aucune donnée, seulement une forme. */
export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`rounded-full bg-white/[0.07] ${className}`} />;
}

/** Gabarit d'une liste d'écarts : titre + description, répété. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="flex flex-col gap-5">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex flex-col gap-2 border-b border-white/[0.06] pb-5">
          <SkeletonBar className="h-3 w-2/3" />
          <SkeletonBar className="h-2.5 w-full" />
          <SkeletonBar className="h-2.5 w-4/5" />
        </li>
      ))}
    </ul>
  );
}

/** Gabarit d'un bloc panel générique (score, comparatif, graphique). */
export function SkeletonPanel({ height = "h-44" }: { height?: string }) {
  return (
    <div className={`panel flex flex-col justify-center gap-3 px-5 py-5 ${height}`}>
      <SkeletonBar className="h-3 w-1/3" />
      <SkeletonBar className="h-2.5 w-2/3" />
      <SkeletonBar className="h-2.5 w-1/2" />
      <SkeletonBar className="h-2.5 w-3/5" />
    </div>
  );
}
