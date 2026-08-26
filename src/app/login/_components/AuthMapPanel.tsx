import { ContourMarks } from "./ContourMarks";

/**
 * Shared editorial panel for /login and /signup — dark "map" side that
 * carries the product thesis, paired with a light form panel next to it.
 */
export function AuthMapPanel() {
  return (
    <div className="relative flex h-[200px] shrink-0 flex-col justify-between overflow-hidden bg-surface px-6 py-6 sm:h-[240px] sm:px-10 sm:py-8 lg:h-auto lg:justify-center lg:px-16 lg:py-16">
      <ContourMarks className="pointer-events-none absolute -right-16 top-1/2 h-[420px] w-[420px] -translate-y-1/2 text-signal-bright/[0.08] sm:h-[520px] sm:w-[520px] lg:-right-24 lg:h-[640px] lg:w-[640px]" />

      <div className="relative z-10 flex items-center gap-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.28em] text-mist">
          Rivalys
        </span>
      </div>

      <div className="relative z-10 max-w-sm">
        <p className="font-display text-2xl leading-[1.15] text-paper sm:text-3xl lg:text-[2.5rem] lg:leading-[1.1]">
          Vois où tu perds du terrain.
        </p>
        <p className="mt-2 hidden text-base leading-relaxed text-mist sm:block lg:mt-4 lg:text-lg">
          Sais quoi faire pour le regagner.
        </p>
      </div>

      <p className="relative z-10 hidden text-xs text-foreground-muted lg:block">
        Comparatif basé sur des données publiques — pricing, avis, positionnement.
      </p>
    </div>
  );
}
