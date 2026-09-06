import type { ReactNode } from "react";

/**
 * La surface de base des écrans applicatifs.
 *
 * Existe pour que la profondeur (bord adouci, dégradé, filet supérieur, ombre diffuse) soit
 * définie à un seul endroit — voir la classe `.panel` dans globals.css. Avant, chaque section
 * répétait `border border-surface-border bg-surface` et l'ensemble était uniformément plat.
 *
 * `focal` ajoute la lueur bleue de la landing. À n'utiliser que sur UN élément par écran :
 * c'est ce qui en fait un point focal plutôt qu'un effet décoratif de plus.
 */
export function Panel({
  children,
  focal = false,
  className = "",
  ...rest
}: {
  children: ReactNode;
  focal?: boolean;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children">) {
  return (
    <div className={`${focal ? "panel-focal" : "panel"} ${className}`} {...rest}>
      {children}
    </div>
  );
}

/**
 * En-tête d'un panneau : le titre discret et, éventuellement, une action à droite.
 * Le trait de séparation est un filet clair plutôt qu'une bordure franche, pour rester
 * cohérent avec la lumière du panneau.
 *
 * L'intitulé reprend la micro-capitale de la landing (0.62rem, interlettrage 0.14em) :
 * les écrans connectés en avaient trois variantes à 11 px selon l'endroit, ce qui suffit
 * à faire lire deux produits différents de part et d'autre de la connexion.
 */
export function PanelHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-6 py-4">
      <h2 className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist/60">{title}</h2>
      {action}
    </div>
  );
}

/**
 * Le lien discret d'un en-tête de panneau (« Tout voir → »). Même graisse que
 * l'intitulé pour ne pas concurrencer le contenu du panneau.
 */
export const PANEL_ACTION_LINK =
  "font-mono text-[0.62rem] uppercase tracking-[0.12em] text-signal-bright transition-colors hover:text-paper";
