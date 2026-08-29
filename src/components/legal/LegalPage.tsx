import Link from "next/link";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { missingLegalFields } from "@/lib/legal/identity";

export type LegalSection = {
  title: string;
  body: string[];
};

/**
 * Gabarit commun aux trois pages légales.
 *
 * Il porte surtout l'avertissement d'identité incomplète : tant que
 * `src/lib/legal/identity.ts` n'est pas rempli, chaque page le dit en haut, en rouge. Un
 * site en production avec des mentions légales à trous est une infraction à l'article 6 de
 * la LCEN — ce bandeau existe pour que ça ne passe pas inaperçu jusque-là.
 */
export function LegalPage({
  eyebrow = "Légal",
  title,
  updatedAt,
  intro,
  sections,
}: {
  eyebrow?: string;
  title: string;
  /** Date de dernière mise à jour, affichée telle quelle. */
  updatedAt: string;
  intro?: string;
  sections: LegalSection[];
}) {
  const missing = missingLegalFields();

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-20">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-3 font-brand text-3xl font-semibold tracking-tight text-paper">{title}</h1>
      <p className="mt-4 text-sm text-mist">Dernière mise à jour : {updatedAt}.</p>

      {missing.length > 0 ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-flare/40 bg-flare/[0.06] px-4 py-3 text-sm leading-relaxed text-flare"
        >
          Document incomplet : l&rsquo;identité de l&rsquo;éditeur n&rsquo;est pas renseignée (
          {missing.join(", ")}). À compléter dans{" "}
          <code className="font-mono text-xs">src/lib/legal/identity.ts</code> avant toute
          ouverture au public.
        </p>
      ) : null}

      {intro ? <p className="mt-6 text-sm leading-relaxed text-mist">{intro}</p> : null}

      <div className="mt-10 flex flex-col gap-8">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="font-brand text-lg font-semibold text-paper">{section.title}</h2>
            <div className="mt-2 flex flex-col gap-2">
              {section.body.map((paragraph, index) => (
                <p key={index} className="text-sm leading-relaxed text-mist">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap gap-4 border-t border-white/[0.06] pt-6 text-sm">
        <Link href="/mentions-legales" className="text-mist transition-colors hover:text-paper">
          Mentions légales
        </Link>
        <Link href="/cgu" className="text-mist transition-colors hover:text-paper">
          CGU
        </Link>
        <Link href="/confidentialite" className="text-mist transition-colors hover:text-paper">
          Confidentialité
        </Link>
        <Link href="/" className="ml-auto text-mist transition-colors hover:text-paper">
          ← Retour à l&rsquo;accueil
        </Link>
      </div>
    </div>
  );
}
