import Link from "next/link";

/**
 * La marque Rivalys : deux colonnes de terrain.
 *
 * Celle de droite, éteinte, est le niveau du concurrent. Celle de gauche, vive,
 * est le terrain que tu tiens. La portion en pointillé posée au-dessus de la
 * tienne est exactement ce que le produit mesure — l'écart, dessiné comme la
 * part de terrain qui reste à occuper. Un « R » dans un carré arrondi n'aurait
 * rien dit du produit ; ce glyphe en est le résumé.
 *
 * Aucun dégradé ni <defs> : le mark est rendu plusieurs fois par document (nav,
 * pied de page, sidebar) et des identifiants SVG dupliqués sont invalides. Tout
 * passe par currentColor et l'opacité — le mark hérite donc de la couleur de son
 * conteneur et reste lisible jusqu'à 16 px.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-[22px] w-[22px] shrink-0 ${className ?? ""}`}
      aria-hidden="true"
    >
      {/* Le concurrent : le niveau à rejoindre. */}
      <rect x="14" y="3.5" width="6" height="17" rx="1.8" fill="currentColor" opacity="0.42" />
      {/* Toi : le terrain tenu. */}
      <rect x="4" y="11.5" width="6" height="9" rx="1.8" fill="currentColor" />
      {/*
        L'écart. Coordonnées calées pour que le contour extérieur du trait
        (x ± strokeWidth/2) couvre exactement 4→10 en largeur et s'arrête à 10 en
        hauteur : le pointillé s'aligne donc au pixel près sur la barre pleine, et
        les 1,5 unités qui les séparent sont ce qui l'en distingue.
      */}
      <rect
        x="4.75"
        y="4.25"
        width="4.5"
        height="5"
        rx="1.05"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="2.2 1.8"
        opacity="0.85"
      />
    </svg>
  );
}

/**
 * Mark + nom, cliquable vers l'accueil. Utilisé par la nav marketing, la sidebar
 * de l'app et le pied de page : un seul endroit à changer pour la marque entière.
 *
 * `onClick` sert à la sidebar mobile, qui referme son tiroir quand on navigue.
 */
export function Logo({
  className,
  markClassName,
  onClick,
}: {
  className?: string;
  markClassName?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href="/"
      onClick={onClick}
      className={`group inline-flex items-center gap-2.5 text-paper ${className ?? ""}`}
    >
      <LogoMark
        className={`text-signal-bright transition-opacity group-hover:opacity-80 ${markClassName ?? ""}`}
      />
      <span className="font-brand text-[1.05rem] font-semibold tracking-tight">Rivalys</span>
    </Link>
  );
}
