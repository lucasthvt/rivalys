import type { ReactNode } from "react";

/**
 * Bande défilante horizontale, en CSS pur.
 *
 * Le contenu est rendu deux fois côte à côte : l'animation `marquee-scroll`
 * translate la piste de -50 %, soit exactement une copie, et la boucle est donc
 * invisible. La seconde copie est `aria-hidden` — un lecteur d'écran ne doit pas
 * entendre la liste en double.
 *
 * Le défilement s'arrête au survol (`.marquee-pause`), sinon on demande à
 * quelqu'un de lire une carte qui s'enfuit. Et si le système réclame moins de
 * mouvement, l'animation ne démarre pas du tout : `.marquee-viewport` redevient
 * alors scrollable à la main, sans quoi tout ce qui dépasse serait définitivement
 * hors d'atteinte.
 */
export function MarqueeBand({
  children,
  label,
  seconds = 32,
}: {
  children: ReactNode;
  /** Nom accessible de la liste — ce que la bande énumère. */
  label: string;
  /** Durée d'un tour complet. Plus il y a de cartes, plus il faut de temps. */
  seconds?: number;
}) {
  return (
    <div className="marquee-pause marquee-viewport">
      <div
        className="marquee-track flex w-max"
        style={{ animationDuration: `${seconds}s` }}
      >
        <ul className="flex shrink-0 items-stretch gap-4 pr-4" aria-label={label}>
          {children}
        </ul>
        <ul className="flex shrink-0 items-stretch gap-4 pr-4" aria-hidden="true">
          {children}
        </ul>
      </div>
    </div>
  );
}
