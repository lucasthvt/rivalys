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
 */
export function PanelHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
        {title}
      </h2>
      {action}
    </div>
  );
}
