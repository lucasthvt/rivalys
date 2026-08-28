import type { ReactNode } from "react";

/**
 * L'intitulé qui précède un titre de section.
 *
 * Deux choses s'y rencontrent : la pastille, forme qui porte toute la direction visuelle
 * du site (barre de navigation, badges, étiquettes de cartes), et l'amorce de cote — le
 * tick vertical suivi d'un trait — qui est le motif propre à Rivalys, repris du dessin
 * technique parce que le produit mesure des écarts.
 *
 * Partagé plutôt que redéfini page par page : c'est un dispositif structurant, et trois
 * variantes légèrement différentes d'un même repère font perdre au repère sa fonction.
 */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="pill font-mono text-[0.66rem] uppercase tracking-[0.14em] text-signal-bright">
      <span aria-hidden="true" className="flex items-center">
        <span className="h-2 w-px bg-signal-bright/70" />
        <span className="h-px w-4 bg-signal-bright/70" />
      </span>
      {children}
    </p>
  );
}
