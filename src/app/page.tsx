import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/Logo";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DimensionLine } from "@/components/ui/DimensionLine";
import { FreeAnalysis } from "@/components/landing/free-analysis";
import { ProofBand } from "@/components/landing/ProofBand";
import { fetchPublishedTestimonials } from "@/lib/testimonials/queries";
import {
  computeScore,
  MAX_SCORE,
  POINTS_PER_PRIORITY,
  type GapPriorityCounts,
} from "@/lib/compare/score";
import type { GapPriority } from "@/lib/supabase/database.types";

/**
 * Landing marketing.
 *
 * Direction visuelle : le dessin coté. Le produit mesure un écart entre deux
 * sites ; un dessin technique annote littéralement un écart avec une ligne de
 * cote, deux ticks et une valeur. Ce vocabulaire porte toute la page — les
 * intitulés de section sont des amorces de cote, et l'élément signature du hero
 * est un relevé comparé où chaque écart est coté entre les deux colonnes.
 *
 * Contrainte de fond : tout ce que la page annonce doit exister dans le produit.
 * Les quatre familles de la section « Ce qu'on relève » sont exactement les
 * valeurs de detected_gaps.category (voir lib/compare/detect-gaps.ts), et les
 * réserves affichées (présence d'avis sans la note, présence sociale sans le
 * volume) sont celles que le moteur applique réellement.
 */
/**
 * Destination du bouton principal.
 *
 * Un visiteur déconnecté part s'inscrire. Un utilisateur déjà connecté qui revient sur la
 * landing et clique « Comparer mon SaaS » doit ouvrir son tableau de bord — l'envoyer créer
 * un compte qu'il possède déjà était le bug : le parcours s'arrêtait net sur un formulaire
 * d'inscription refusant son email.
 */
function heroCta(authenticated: boolean) {
  return authenticated
    ? { href: "/dashboard", label: "Ouvrir mon tableau de bord" }
    : // Le bouton descend vers l'essai gratuit, pas vers l'inscription. Demander un compte
      // avant d'avoir rien prouvé, c'est facturer la confiance d'avance ; l'essai la gagne
      // en trente secondes et l'inscription vient après, une fois l'écart affiché.
      { href: "#essai", label: "Analyser mon SaaS gratuitement" };
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authenticated = Boolean(user);
  const testimonials = await fetchPublishedTestimonials();

  return (
    <div className="bg-void text-paper">
      <Hero authenticated={authenticated} />
      {/*
        L'essai gratuit juste sous le hero, avant toute explication : un visiteur qui vient
        de lire la promesse doit pouvoir la vérifier sur son propre site immédiatement.
        Placé plus bas, il ne serait vu que par ceux qui ont déjà été convaincus par le
        texte — c'est-à-dire par ceux qui en avaient le moins besoin.

        Masqué pour un utilisateur connecté : il a déjà son relevé complet dans son tableau
        de bord, et lui proposer une version bridée de ce qu'il paye n'a aucun sens.
      */}
      {authenticated ? null : <FreeAnalysis />}
      <WhatWeMeasure />
      <HowItWorks />
      <GapToTask />
      <ProofBand testimonials={testimonials} />
      <ScoreSection />
      <WhatWeDont />
      <Faq />
      <ClosingCta authenticated={authenticated} />
      <Footer />
    </div>
  );
}

/* --------------------------------------------------------------------------
   Dispositifs structurants — l'amorce de cote et la ligne de cote.
   Ils reviennent à chaque section : c'est ce qui tient la page ensemble.
   -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   Hero
   -------------------------------------------------------------------------- */

function Hero({ authenticated }: { authenticated: boolean }) {
  const cta = heroCta(authenticated);
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06]">
      <div
        className="bg-signal-grid pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          maskImage: "radial-gradient(ellipse 55% 55% at 22% 12%, black 0%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse 55% 55% at 22% 12%, black 0%, transparent 72%)",
        }}
        aria-hidden="true"
      />
      {/*
        Halo resserré et discret. Sur un fond noir pur, une lueur large finit par teinter
        toute la moitié haute de la page en violet : le noir cesse d'être noir, et l'accent
        n'a plus rien contre quoi ressortir. Il doit se lire comme une source lointaine,
        pas comme un calque de couleur.
      */}
      <div
        className="pointer-events-none absolute left-[20%] top-[-18rem] h-[26rem] w-[30rem] -translate-x-1/2 rounded-full bg-signal/25 blur-[130px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
          <div className="reveal-up">
            <span className="pill font-mono text-[0.66rem] uppercase tracking-[0.12em] text-mist">
              <span
                className="signal-pulse h-1.5 w-1.5 rounded-full bg-signal-bright"
                aria-hidden="true"
              />
              Comparateur de faits publics
            </span>

            <h1 className="mt-6 font-brand text-[2.9rem] font-bold leading-[1.02] tracking-[-0.03em] text-paper sm:text-[3.9rem] lg:text-[4.4rem]">
              Vois où tu perds
              <br />
              <span className="text-signal-bright text-glow-signal">du terrain.</span>
            </h1>

            <p className="mt-7 max-w-md text-lg leading-relaxed text-mist">
              Donne ton URL et celle de ton plus gros concurrent. Rivalys relève les faits
              publics des deux côtés, cote chaque écart, et le transforme en tâche précise —
              jamais en conseil générique.
            </p>

            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link
                href={cta.href}
                className="inline-flex h-12 items-center justify-center rounded-full bg-signal px-7 text-base font-semibold text-paper shadow-signal-lg transition-colors duration-150 hover:bg-signal-bright hover:text-void focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-bright"
              >
                {cta.label}
              </Link>
              {/* Proposer de se connecter à quelqu'un qui l'est déjà n'a pas de sens. */}
              {authenticated ? null : (
                <Link
                  href="/login"
                  className="text-sm font-medium text-mist transition-colors hover:text-paper"
                >
                  J&rsquo;ai déjà un compte →
                </Link>
              )}
            </div>

            <p className="mt-7 font-mono text-[0.68rem] uppercase leading-relaxed tracking-[0.1em] text-mist/60">
              Deux URL suffisent · aucune donnée privée · aucun crawl autonome
            </p>
          </div>

          <Releve />
        </div>
      </div>
    </section>
  );
}

/**
 * Élément signature : le relevé comparé.
 *
 * Chaque ligne oppose une valeur relevée chez toi à la même valeur relevée chez
 * le concurrent, et cote l'écart entre les deux — la colonne centrale est une
 * annotation de dessin technique, pas une décoration. La dernière ligne est
 * volontairement alignée : le produit doit montrer qu'il sait aussi ne rien
 * signaler.
 *
 * Les valeurs sont un exemple, pas un relevé réel — la légende le dit.
 */
const RELEVE_ROWS: { criterion: string; you: string; rival: string; gap: string | null }[] = [
  { criterion: "Prix d'entrée", you: "29 €/mois", rival: "25 €/mois", gap: "4 €" },
  { criterion: "Essai gratuit", you: "Aucun", rival: "14 jours", gap: "14 jours" },
  { criterion: "Paliers publiés", you: "2", rival: "4", gap: "2 paliers" },
  { criterion: "Fiche G2", you: "Introuvable", rival: "Publiée", gap: "1 fiche" },
  { criterion: "Cible annoncée", you: "PME", rival: "PME", gap: null },
];

function Releve() {
  return (
    <figure
      className="panel-focal reveal-up relative p-5 sm:p-7"
      style={{ animationDelay: "0.12s" }}
    >
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.07] pb-4 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-mist">
        <span className="text-paper">Relevé comparé</span>
        <span className="text-mist/60">Exemple · valeurs illustratives</span>
      </figcaption>

      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)] items-end gap-x-3 pb-3 pt-4 font-mono text-[0.62rem] uppercase tracking-[0.12em] sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)] sm:gap-x-4">
        <span className="text-right text-signal-bright">Toi</span>
        <span aria-hidden="true" />
        <span className="text-mist">Concurrent</span>
      </div>

      <div className="flex flex-col divide-y divide-white/[0.06] border-t border-white/[0.06]">
        {RELEVE_ROWS.map((row) => (
          <div
            key={row.criterion}
            className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)] items-center gap-x-3 py-4 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)] sm:gap-x-4"
          >
            <span className="text-right text-sm text-paper sm:text-[0.95rem]">{row.you}</span>

            <span className="flex flex-col items-center gap-1.5">
              <span className="text-center font-mono text-[0.58rem] uppercase leading-tight tracking-[0.1em] text-mist/60">
                {row.criterion}
              </span>
              <DimensionLine measured={row.gap !== null} />
              <span
                className={`text-center font-mono text-[0.62rem] uppercase tracking-[0.08em] ${
                  row.gap ? "text-signal-bright" : "text-mist/45"
                }`}
              >
                {row.gap ?? "Aligné"}
              </span>
            </span>

            <span className="text-sm text-mist sm:text-[0.95rem]">{row.rival}</span>
          </div>
        ))}
      </div>

      <p className="mt-5 border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-mist/70">
        Chaque écart coté devient une tâche. Une ligne alignée n&rsquo;en génère aucune.
      </p>
    </figure>
  );
}

/* --------------------------------------------------------------------------
   Ce qu'on relève — les quatre familles réelles de detected_gaps.category
   -------------------------------------------------------------------------- */

interface MeasureFamily {
  category: string;
  title: string;
  fields: string[];
  /** La limite que le moteur s'impose vraiment. Affichée, pas cachée. */
  limit: string;
}

const MEASURE_FAMILIES: MeasureFamily[] = [
  {
    category: "pricing",
    title: "Tarification",
    fields: ["Paliers publiés", "Prix affichés", "Essai gratuit", "Palier gratuit"],
    limit: "Uniquement ce qui figure sur la page de tarifs publique. Page introuvable : on te le dit, on n'estime pas.",
  },
  {
    category: "positioning",
    title: "Positionnement",
    fields: ["Proposition de valeur", "Cible annoncée"],
    limit: "Ce que le site revendique, pas ce qu'on suppose de sa stratégie.",
  },
  {
    category: "reviews",
    title: "Avis publics",
    fields: ["G2", "Capterra", "Trustpilot", "Product Hunt"],
    limit: "Présence d'une fiche, pas la note ni le nombre d'avis — ces chiffres bougent trop vite pour être affichés honnêtement entre deux relevés.",
  },
  {
    category: "social_presence",
    title: "Présence sociale",
    fields: ["Réseaux liés depuis le site", "Contenus tiers qui te mentionnent"],
    limit: "Présence détectée, volume non mesurable : ces plateformes réservent leurs statistiques à des partenaires licenciés.",
  },
];

function WhatWeMeasure() {
  return (
    <section id="ce-quon-releve" className="border-b border-white/[0.06]">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
        <div className="max-w-2xl">
          <Eyebrow>Ce qu&rsquo;on relève</Eyebrow>
          <h2 className="mt-4 font-brand text-[2rem] font-bold leading-[1.08] tracking-[-0.028em] text-paper sm:text-[2.9rem]">
            Quatre familles de faits. Et leurs limites, écrites noir sur blanc.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-mist">
            Un comparateur qui ne dit pas ce qu&rsquo;il ignore raconte n&rsquo;importe quoi
            avec assurance. Voilà exactement ce que Rivalys mesure — et là où il
            s&rsquo;arrête.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {MEASURE_FAMILIES.map((family) => (
            <div
              key={family.category}
              className="panel flex flex-col p-6 transition-colors hover:border-signal-bright/20 sm:p-7"
            >
              <code className="pill self-start font-mono text-[0.62rem] tracking-tight text-mist/60">
                {family.category}
              </code>

              <h3 className="mt-4 font-brand text-xl font-bold tracking-[-0.015em] text-paper">
                {family.title}
              </h3>

              <ul className="mt-4 flex flex-wrap gap-2">
                {family.fields.map((field) => (
                  <li
                    key={field}
                    className="inline-flex items-center gap-1.5 rounded-full border border-signal-bright/20 bg-signal/10 px-3 py-1 font-mono text-[0.66rem] text-mist"
                  >
                    <span className="h-1 w-1 rounded-full bg-signal-bright" aria-hidden="true" />
                    {field}
                  </li>
                ))}
              </ul>

              <p className="mt-auto flex gap-3 pt-6 text-sm leading-relaxed text-mist/80">
                <span
                  aria-hidden="true"
                  className="mt-[0.45rem] h-px w-6 shrink-0 bg-mist/30"
                />
                <span>{family.limit}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Le parcours — une vraie séquence, donc une vraie numérotation
   -------------------------------------------------------------------------- */

const STEPS = [
  {
    n: "01",
    title: "Tu renseignes",
    body: "Ton URL, celle de ton concurrent. Rien à installer chez eux, aucun accès à demander, aucun compte à créer ailleurs.",
  },
  {
    n: "02",
    title: "Rivalys relève",
    body: "Accueil et page de tarifs des deux côtés, plus les fiches d'avis et la présence sociale publiques. Chaque champ non trouvé est marqué comme tel.",
  },
  {
    n: "03",
    title: "Tu agis",
    body: "Chaque écart coté devient une tâche priorisée. Tu la traites, tu la coches, le score suit — et le relevé suivant repart de là.",
  },
];

function HowItWorks() {
  return (
    <section id="comment-ca-marche" className="border-b border-white/[0.06]">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
        <div className="max-w-xl">
          <Eyebrow>Le parcours</Eyebrow>
          <h2 className="mt-4 font-brand text-[2rem] font-bold leading-[1.08] tracking-[-0.028em] text-paper sm:text-[2.9rem]">
            Trois étapes, aucune supposition.
          </h2>
        </div>

        <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step) => (
            <li key={step.n} className="relative border-t border-white/10 pt-6">
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 h-2.5 w-px bg-signal-bright"
              />
              <span className="font-mono text-[0.7rem] tracking-[0.12em] text-signal-bright">
                {step.n}
              </span>
              <h3 className="mt-3 font-brand text-xl font-bold tracking-[-0.015em] text-paper">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-mist">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   De l'écart à la tâche
   -------------------------------------------------------------------------- */

const EXAMPLE_TASKS = [
  {
    label: "Prioritaire",
    strength: "bg-signal-bright",
    title: "Ton concurrent propose un essai gratuit, pas toi",
    origin: "pricing · has_free_trial",
  },
  {
    label: "À planifier",
    strength: "bg-signal-bright/55",
    title: "Il publie 4 paliers de tarifs, tu en publies 2",
    origin: "pricing · pricing_tiers",
  },
  {
    label: "Quand tu peux",
    strength: "bg-signal-bright/25",
    title: "Il a une fiche G2, on n'en trouve pas pour toi",
    origin: "reviews · présence",
  },
];

function GapToTask() {
  return (
    <section className="border-b border-white/[0.06]">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div>
          <Eyebrow>De l&rsquo;écart à la tâche</Eyebrow>
          <h2 className="mt-4 font-brand text-[2rem] font-bold leading-[1.08] tracking-[-0.028em] text-paper sm:text-[2.9rem]">
            Une tâche ne peut naître que d&rsquo;un écart mesuré.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-mist">
            Chaque tâche cite la règle et le champ qui l&rsquo;ont produite. Aucun conseil
            growth générique, aucun calendrier à remplir. Si le relevé ne trouve aucun écart,
            la liste reste vide — c&rsquo;est une réponse, pas un bug.
          </p>
          <Link
            href="/tarifs"
            className="mt-8 inline-flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-signal-bright transition-colors hover:text-paper"
          >
            Voir les tarifs
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <ul className="flex flex-col gap-3">
          {EXAMPLE_TASKS.map((task) => (
            <li
              key={task.title}
              className="panel p-5 transition-colors hover:border-signal-bright/25"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-mist">
                  <span className={`h-1.5 w-1.5 rounded-full ${task.strength}`} aria-hidden="true" />
                  {task.label}
                </span>
                <code className="font-mono text-[0.6rem] tracking-tight text-mist/45">
                  {task.origin}
                </code>
              </div>
              <p className="mt-3 text-[0.95rem] leading-snug text-paper">{task.title}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Le score
   -------------------------------------------------------------------------- */

/**
 * Le relevé de score affiché ici est calculé par le vrai moteur, pas recopié à
 * la main. La page promet un score « qui s'explique ligne par ligne » : si les
 * pénalités montrées ici dérivaient de celles de lib/compare/score.ts, la page
 * démentirait sa propre promesse — et personne ne s'en apercevrait.
 */
const EXAMPLE_COUNTS: GapPriorityCounts = { high: 1, medium: 2, low: 2 };
const EXAMPLE_SCORE = computeScore(EXAMPLE_COUNTS);

const EXAMPLE_SCORE_LINES: { priority: GapPriority; singular: string; plural: string }[] = [
  { priority: "high", singular: "écart prioritaire", plural: "écarts prioritaires" },
  { priority: "medium", singular: "écart à planifier", plural: "écarts à planifier" },
  { priority: "low", singular: "écart mineur", plural: "écarts mineurs" },
];

function ScoreSection() {
  return (
    <section className="border-b border-white/[0.06]">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className="panel order-2 p-6 sm:p-8 lg:order-1">
          <div className="flex items-baseline justify-between font-mono text-[0.66rem] uppercase tracking-[0.12em] text-mist">
            <span>Score global</span>
            <span className="font-brand text-4xl font-bold tracking-[-0.03em] text-paper">{EXAMPLE_SCORE}</span>
          </div>

          <div className="mt-6 flex h-3 overflow-hidden rounded-full bg-white/[0.05]">
            <span
              className="h-full bg-signal-bright/85"
              style={{ width: `${(EXAMPLE_SCORE / MAX_SCORE) * 100}%` }}
            />
            <span className="meter-hatch h-full flex-1" />
          </div>

          <dl className="mt-6 flex flex-col gap-2 font-mono text-[0.68rem] text-mist">
            {EXAMPLE_SCORE_LINES.map((line) => {
              const count = EXAMPLE_COUNTS[line.priority];
              return (
                <div key={line.priority} className="flex items-center justify-between gap-4">
                  <dt>
                    {count} {count > 1 ? line.plural : line.singular}
                  </dt>
                  <dd className="text-paper">−{count * POINTS_PER_PRIORITY[line.priority]}</dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="order-1 lg:order-2">
          <Eyebrow>Le score</Eyebrow>
          <h2 className="mt-4 font-brand text-[2rem] font-bold leading-[1.08] tracking-[-0.028em] text-paper sm:text-[2.9rem]">
            Un chiffre qui s&rsquo;explique ligne par ligne.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-mist">
            {MAX_SCORE} moins {POINTS_PER_PRIORITY.high} points par écart prioritaire,{" "}
            {POINTS_PER_PRIORITY.medium} par écart à planifier, {POINTS_PER_PRIORITY.low} par
            écart mineur. Rien d&rsquo;autre. Tu peux ouvrir le détail et retrouver chaque point
            perdu — un score que tu ne peux pas reconstituer toi-même est une vanity metric.
          </p>
          <p className="mt-4 max-w-md text-base leading-relaxed text-mist">
            Il baisse quand un écart s&rsquo;ouvre, remonte quand tu le refermes. Il
            n&rsquo;est jamais comparé à celui d&rsquo;un autre utilisateur.
          </p>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Ce qu'on ne fait pas
   -------------------------------------------------------------------------- */

const NOT_DOING = [
  {
    title: "Aucune donnée privée",
    body: "On ne prétend jamais connaître ton MRR ou celui de ton concurrent. Seulement ce que ses pages publiques affichent.",
  },
  {
    title: "Aucun crawl autonome",
    body: "Rivalys ne va chercher des données que pour les deux URL que tu donnes, quand tu le demandes. Pas de robot qui balaie le web.",
  },
  {
    title: "Aucun classement public",
    body: "Ton relevé reste à toi. Ce n'est pas un palmarès, et personne d'autre ne voit ton score.",
  },
  {
    title: "Aucune donnée inventée",
    body: "Page de tarifs introuvable, site qui bloque la lecture ? Le champ est marqué comme non récupéré, jamais estimé.",
  },
];

function WhatWeDont() {
  return (
    <section className="border-b border-white/[0.06]">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
        <div className="max-w-xl">
          <Eyebrow>Ce qu&rsquo;on ne fait pas</Eyebrow>
          <h2 className="mt-4 font-brand text-[2rem] font-bold leading-[1.08] tracking-[-0.028em] text-paper sm:text-[2.9rem]">
            Honnête par construction, pas seulement par promesse.
          </h2>
        </div>

        <dl className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {NOT_DOING.map((item) => (
            <div key={item.title} className="border-t border-white/10 pt-5">
              <dt className="font-brand text-lg font-bold tracking-[-0.015em] text-paper">{item.title}</dt>
              <dd className="mt-2.5 text-sm leading-relaxed text-mist">{item.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   FAQ
   -------------------------------------------------------------------------- */

const FAQ_ITEMS = [
  {
    q: "Vous scrapez le web pour trouver mes concurrents ?",
    a: "Non. Rivalys ne lit que les deux URL que tu donnes explicitement. Aucun crawl autonome, aucune base de concurrents pré-remplie, aucune suggestion automatique.",
  },
  {
    q: "À quelle fréquence le relevé est-il mis à jour ?",
    a: "Quand tu le demandes, depuis ton tableau de bord, et au maximum une fois par jour. Pas de tâche planifiée qui tourne dans ton dos, pas de nouvelle lecture à chaque clic.",
  },
  {
    q: "D'où viennent les données sur mon concurrent ?",
    a: "De ses pages publiques — accueil et tarifs — et des plateformes d'avis et réseaux publics. Rivalys ne prétend jamais connaître son chiffre d'affaires, son churn ou tout autre chiffre privé.",
  },
  {
    q: "Vous affichez la note G2 de mon concurrent ?",
    a: "Non, seulement l'existence d'une fiche. Une note et un nombre d'avis évoluent en continu : les afficher à partir d'un relevé daté donnerait un chiffre faux la plupart du temps.",
  },
  {
    q: "Et le nombre de vues de ses contenus TikTok ou Instagram ?",
    a: "Non plus. Ces plateformes réservent leurs statistiques à des partenaires licenciés. Rivalys signale qu'une présence a été détectée et s'arrête là, plutôt que d'estimer un volume.",
  },
  {
    q: "Et si la page de tarifs est introuvable ?",
    a: "Le champ est marqué comme non récupéré et te l'affiche tel quel. Aucun écart n'est généré à partir d'une donnée manquante.",
  },
  {
    q: "Mes données sont-elles visibles par d'autres utilisateurs ?",
    a: "Non. Row Level Security est activée sur chaque table : tu ne vois que ton propre relevé, et personne d'autre ne voit le tien.",
  },
  {
    q: "Je peux suivre plusieurs concurrents ?",
    a: "Un seul concurrent principal pour l'instant, changeable à tout moment. Le schéma est déjà prêt pour en suivre plusieurs.",
  },
  {
    q: "C'est payant ?",
    a: "Oui. Rivalys est un outil payant, sans version gratuite indéfinie. Le détail des paliers est sur la page Tarifs.",
  },
];

function Faq() {
  return (
    <section id="faq" className="border-b border-white/[0.06]">
      <div className="mx-auto w-full max-w-3xl px-6 py-20 lg:py-24">
        <div className="max-w-xl">
          <Eyebrow>Questions fréquentes</Eyebrow>
          <h2 className="mt-4 font-brand text-[2rem] font-bold leading-[1.08] tracking-[-0.028em] text-paper sm:text-[2.9rem]">
            Ce qu&rsquo;on te demande le plus.
          </h2>
        </div>

        <div className="mt-12 flex flex-col divide-y divide-white/[0.06] border-t border-white/[0.06]">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal-bright [&::-webkit-details-marker]:hidden">
                <span className="font-brand text-base font-medium text-paper sm:text-lg">
                  {item.q}
                </span>
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4 shrink-0 text-mist transition-transform duration-200 group-open:rotate-45"
                  aria-hidden="true"
                >
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </summary>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-mist">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
   Clôture + pied de page
   -------------------------------------------------------------------------- */

function ClosingCta({ authenticated }: { authenticated: boolean }) {
  const cta = heroCta(authenticated);
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06]">
      <div
        className="pointer-events-none absolute bottom-[-16rem] left-1/2 h-[26rem] w-[38rem] -translate-x-1/2 rounded-full bg-signal/20 blur-[120px]"
        aria-hidden="true"
      />
      <div className="relative mx-auto w-full max-w-3xl px-6 py-24 text-center lg:py-28">
        <h2 className="font-brand text-[2rem] font-bold leading-[1.06] tracking-[-0.028em] text-paper sm:text-[3.1rem]">
          Sais quoi faire pour le regagner.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-mist">
          Un premier relevé prend quelques minutes et n&rsquo;a besoin que de deux URL.
        </p>
        <Link
          href={cta.href}
          className="mt-9 inline-flex h-12 items-center justify-center rounded-full bg-signal px-7 text-base font-semibold text-paper shadow-signal-lg transition-colors duration-150 hover:bg-signal-bright hover:text-void focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-bright"
        >
          {cta.label}
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-14 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col items-start gap-4">
          <Logo />
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-mist/60">
            © 2026 Rivalys — tous droits réservés
          </p>
        </div>

        {/*
          Colonne « Produit » : sur mobile, les liens de la barre de navigation sont masqués
          (voir NavBar), et le pied de page ne listait que le légal. La page Tarifs n'était
          donc atteignable par AUCUN lien de navigation en dessous de 640 px — sur la page
          qui est censée vendre. Ces liens la rendent joignable partout, et donnent au
          passage au moteur de recherche un maillage interne vers les pages qui comptent.
        */}
        <div className="flex flex-col gap-10 sm:flex-row sm:gap-16">
          <FooterColumn
            title="Produit"
            links={[
              { href: "/tarifs", label: "Tarifs" },
              { href: "/#comment-ca-marche", label: "Comment ça marche" },
              { href: "/#faq", label: "FAQ" },
            ]}
          />
          <FooterColumn
            title="Légal"
            links={[
              { href: "/mentions-legales", label: "Mentions légales" },
              { href: "/cgu", label: "CGU" },
              { href: "/confidentialite", label: "Confidentialité" },
            ]}
          />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-mist/60">{title}</p>
      <ul className="mt-4 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-mist transition-colors hover:text-paper">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
