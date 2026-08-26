import { ContourMarks } from "./ContourMarks";

/**
 * Shared editorial panel for /login and /signup — dark "map" side that
 * carries the product thesis, paired with a light form panel next to it.
 */
export function AuthMapPanel() {
  return (
    <div className="relative flex h-[200px] shrink-0 flex-col justify-between overflow-hidden bg-[#1F2A22] px-6 py-6 sm:h-[240px] sm:px-10 sm:py-8 lg:h-auto lg:justify-center lg:px-16 lg:py-16">
      <ContourMarks className="pointer-events-none absolute -right-16 top-1/2 h-[420px] w-[420px] -translate-y-1/2 text-[#3F4F41] sm:h-[520px] sm:w-[520px] lg:-right-24 lg:h-[640px] lg:w-[640px]" />

      <div className="relative z-10 flex items-center gap-2">
        <span className="[font-family:var(--font-mono-auth)] text-[11px] font-medium uppercase tracking-[0.28em] text-[#C7CBB8]">
          Rivalys
        </span>
      </div>

      <div className="relative z-10 max-w-sm">
        <p className="[font-family:var(--font-display-auth)] text-2xl leading-[1.15] text-[#F0EEE3] sm:text-3xl lg:text-[2.5rem] lg:leading-[1.1]">
          Vois où tu perds du terrain.
        </p>
        <p className="mt-2 hidden text-base leading-relaxed text-[#A9B6A2] sm:block lg:mt-4 lg:text-lg">
          Sais quoi faire pour le regagner.
        </p>
      </div>

      <p className="relative z-10 hidden text-xs text-[#6B7A6C] lg:block">
        Comparatif basé sur des données publiques — pricing, avis, positionnement.
      </p>
    </div>
  );
}
