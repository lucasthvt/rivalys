import type { Testimonial } from "./testimonials";

/**
 * Une carte d'avis, telle qu'elle apparaît dans la bande de la landing.
 *
 * Extraite pour que l'écran d'administration affiche EXACTEMENT le même rendu avant
 * publication. Si l'admin avait sa propre mise en forme, « voir ce qu'on publie »
 * deviendrait une approximation — et c'est précisément la raison d'être de cet écran.
 * La largeur est passée par le parent : c'est la seule chose qui diffère entre une carte
 * qui défile et une carte relue à l'arrêt.
 */
export function TestimonialCard({
  testimonial,
  className = "",
}: {
  testimonial: Testimonial;
  className?: string;
}) {
  return (
    <div className={`panel flex flex-col justify-between p-5 ${className}`}>
      <p className="text-[0.95rem] leading-relaxed text-paper">
        &laquo;&nbsp;{testimonial.quote}&nbsp;&raquo;
      </p>
      {/*
        La casse du pseudo est celle que la personne a choisie — « kykyleroi » n'est pas
        « KYKYLEROI ». Le passer en capitales comme les autres étiquettes mono de la page
        réécrirait un nom propre.
      */}
      <p className="mt-4 font-mono text-[0.68rem] tracking-[0.02em] text-mist/70">
        {testimonial.author}
        {testimonial.role ? <span className="text-mist/45"> · {testimonial.role}</span> : null}
      </p>
    </div>
  );
}
