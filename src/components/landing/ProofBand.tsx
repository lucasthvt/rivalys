import { Eyebrow } from "@/components/ui/Eyebrow";
import { MarqueeBand } from "./MarqueeBand";
import { DEMO_TESTIMONIALS, type Testimonial } from "./testimonials";
import { TestimonialCard } from "./TestimonialCard";

/**
 * La bande de preuve.
 *
 * Ce qu'une landing met habituellement ici, ce sont des témoignages. Rivalys
 * n'en a pas encore de réels, et la page voisine promet « aucune donnée
 * inventée » : la bande fait donc défiler ce que le produit sait vraiment
 * produire — les règles de détection réellement implémentées, avec leur
 * catégorie et leur priorité.
 *
 * C'est une preuve plus forte qu'un avis pour cette audience : un fondateur de
 * SaaS reconnaît immédiatement s'il est concerné par « il propose un essai
 * gratuit, pas toi ».
 *
 * Les vrais avis viennent de la table `testimonials` (migration 20260904000000),
 * lus par fetchPublishedTestimonials et passés en prop. Dès qu'une ligne est
 * publiée, la seconde bande apparaît sous celle-ci sans autre modification.
 */

/**
 * Miroir des règles de src/lib/compare/detect-gaps.ts.
 *
 * Chaque entrée doit correspondre à une règle qui tourne réellement — la page
 * annonce ce que le moteur détecte, pas ce qu'on aimerait qu'il détecte. Si une
 * règle disparaît du moteur, elle disparaît d'ici.
 */
const DETECTED_RULES: {
  category: string;
  priority: "high" | "medium" | "low";
  title: string;
}[] = [
  {
    category: "pricing",
    priority: "high",
    title: "Ton concurrent propose un essai gratuit, pas toi",
  },
  {
    category: "pricing",
    priority: "high",
    title: "Ton concurrent a un palier gratuit, pas toi",
  },
  {
    category: "pricing",
    priority: "medium",
    title: "Ton concurrent publie plus de paliers de tarifs que toi",
  },
  {
    category: "reviews",
    priority: "medium",
    title: "Ton concurrent est référencé sur des plateformes d'avis, pas toi",
  },
  {
    category: "social_presence",
    priority: "medium",
    title: "Ton concurrent affiche des réseaux que tu n'affiches pas",
  },
  {
    category: "auth",
    priority: "medium",
    title: "Ton concurrent propose des connexions que tu ne proposes pas",
  },
  {
    category: "social_presence",
    priority: "low",
    title: "Des contenus publics parlent de lui là où tu n'es pas",
  },
  {
    category: "positioning",
    priority: "low",
    title: "Ton positionnement diffère nettement du sien",
  },
  {
    category: "payment",
    priority: "low",
    title: "Ton concurrent affiche des moyens de paiement que tu n'affiches pas",
  },
];

/** Repris de la liste de tâches : même vocabulaire, même graduation d'intensité. */
const PRIORITY_LABEL: Record<"high" | "medium" | "low", { text: string; dot: string }> = {
  high: { text: "Prioritaire", dot: "bg-signal-bright" },
  medium: { text: "À planifier", dot: "bg-signal-bright/55" },
  low: { text: "Quand tu peux", dot: "bg-signal-bright/25" },
};

export function ProofBand({ testimonials = [] }: { testimonials?: Testimonial[] }) {
  // Le titre compte les règles au lieu d'annoncer un nombre écrit à la main :
  // une règle ajoutée au moteur et oubliée ici, et la page mentirait sur son
  // propre périmètre — précisément ce qu'elle reproche aux comparateurs flous.
  return (
    <section className="overflow-hidden border-b border-white/[0.06]">
      <div className="mx-auto w-full max-w-6xl px-6 pt-20 lg:pt-24">
        <div className="max-w-xl">
          <Eyebrow>Ce que le relevé remonte</Eyebrow>
          <h2 className="mt-4 font-brand text-[2rem] font-bold leading-[1.08] tracking-[-0.028em] text-paper sm:text-[2.9rem]">
            {DETECTED_RULES.length} règles, et rien qu&rsquo;elles.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-mist">
            Voilà l&rsquo;intégralité de ce que le moteur sait détecter aujourd&rsquo;hui.
            Chaque carte est une règle qui tourne vraiment, avec la catégorie et la
            priorité qu&rsquo;elle produit en base — pas un aperçu choisi pour l&rsquo;effet.
          </p>
        </div>
      </div>

      {/*
        Pleine largeur, hors de la grille : une bande qui s'arrête aux marges du
        contenu ressemble à un carrousel raté. Elle doit traverser l'écran.
      */}
      <div className="mt-12 pb-20 lg:pb-24">
        <MarqueeBand label="Règles de détection appliquées par le comparateur" seconds={44}>
          {DETECTED_RULES.map((rule) => {
            const priority = PRIORITY_LABEL[rule.priority];
            return (
              <li
                key={`${rule.category}-${rule.title}`}
                className="panel flex w-[19rem] flex-col justify-between p-5 sm:w-[21rem]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-mist">
                    <span className={`h-1.5 w-1.5 rounded-full ${priority.dot}`} aria-hidden="true" />
                    {priority.text}
                  </span>
                  <code className="font-mono text-[0.6rem] tracking-tight text-mist/45">
                    {rule.category}
                  </code>
                </div>
                <p className="mt-4 text-[0.95rem] leading-snug text-paper">{rule.title}</p>
              </li>
            );
          })}
        </MarqueeBand>

        <TestimonialBand testimonials={testimonials} />
      </div>
    </section>
  );
}

/**
 * Seconde bande, réservée aux avis.
 *
 * Trois cas, dans cet ordre :
 *
 * 1. De vrais avis publiés existent en base → on les affiche.
 * 2. Aucun avis, et on est en développement → on affiche le jeu de démonstration,
 *    surmonté d'une étiquette « démo » impossible à confondre avec le reste. Sert
 *    à dessiner la bande sans attendre d'avoir des retours.
 * 3. Aucun avis, en production → on ne rend rien.
 *
 * Le test sur `NODE_ENV` est résolu à la compilation : dans un build de
 * production, cette branche et le tableau qu'elle référence disparaissent du
 * bundle. Un faux avis ne peut donc pas partir en ligne par distraction — il
 * faudrait modifier ce fichier pour ça, ce qui est un geste délibéré et non un
 * oubli.
 */
const IS_DEV = process.env.NODE_ENV === "development";

function TestimonialBand({ testimonials }: { testimonials: Testimonial[] }) {
  const real = testimonials.length > 0;
  const items = real ? testimonials : IS_DEV ? DEMO_TESTIMONIALS : [];

  if (items.length === 0) return null;

  return (
    <div className="mt-4">
      {/*
        Condition écrite dans cet ordre pour que `IS_DEV` soit le premier terme :
        remplacé par `false` à la compilation, il rend toute la branche morte et
        l'étiquette disparaît du bundle de production au lieu d'y rester inerte.
      */}
      {IS_DEV && !real ? (
        <div className="mx-auto mb-4 w-full max-w-6xl px-6">
          <span className="pill border-clay-500/40 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-clay-100">
            Démo locale · avis fictifs, absents du build de production
          </span>
        </div>
      ) : null}

      <MarqueeBand label="Retours d'utilisateurs de Rivalys" seconds={38}>
        {items.map((testimonial) => (
          <li key={testimonial.author + testimonial.quote.slice(0, 24)} className="flex">
            <TestimonialCard testimonial={testimonial} className="w-[21rem] sm:w-[24rem]" />
          </li>
        ))}
      </MarqueeBand>
    </div>
  );
}
