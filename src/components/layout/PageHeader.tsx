import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/Eyebrow";

/**
 * L'en-tête d'un écran connecté.
 *
 * Repris tel quel de la landing : pastille d'intitulé, puis un titre en Golos
 * très serré. Les six écrans du produit portaient jusqu'ici un intitulé en
 * capitales mono et un titre à 28 px souligné d'un filet — une hiérarchie de
 * documentation, pas celle de la page qui vend le produit. Un utilisateur qui
 * se connecte passait donc d'une typographie à une autre au premier écran.
 *
 * Le filet inférieur disparaît : c'est le rythme vertical qui sépare, comme sur
 * la landing. Un titre souligné pousse à souligner la section suivante, et de
 * proche en proche l'écran redevient une pile de boîtes.
 *
 * `action` tient à droite du titre — le bouton d'analyse du tableau de bord —
 * et repasse sous le titre en dessous de `sm`, où la place manque.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  action,
  back,
}: {
  eyebrow: string;
  title: string;
  /** Une phrase, pas un paragraphe : ce que l'écran répond, pas son mode d'emploi. */
  lede?: ReactNode;
  action?: ReactNode;
  /** Retour vers l'écran dont celui-ci est le détail (le score depuis le tableau de bord). */
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-10 lg:mb-12">
      {back ? (
        <Link
          href={back.href}
          className="mb-6 inline-flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-mist transition-colors hover:text-paper"
        >
          <span aria-hidden="true">←</span>
          {back.label}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
        <div className="min-w-0">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-4 font-brand text-[1.9rem] font-bold leading-[1.06] tracking-[-0.032em] text-paper sm:text-[2.5rem]">
            {title}
          </h1>
        </div>
        {action}
      </div>

      {lede ? (
        <p className="mt-5 max-w-[58ch] text-[0.95rem] leading-relaxed text-mist">{lede}</p>
      ) : null}
    </header>
  );
}
