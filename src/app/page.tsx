import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/brand/Logo";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { AmbientBackdrop } from "@/components/ui/AmbientBackdrop";
import { FreeAnalysis } from "@/components/landing/free-analysis";
import { ProofBand } from "@/components/landing/ProofBand";
import { ScoreCard, type ScoreLine } from "@/components/landing/ScoreCard";
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
 * Direction visuelle : une surface unique et sombre, tenue par une lumière
 * ambiante fixe (voir AmbientBackdrop) plutôt que par des séparateurs. Les
 * sections ne sont plus des boîtes empilées mais des paliers de lecture sur un
 * même fond ; ce qui les distingue est le rythme vertical, pas un filet.
 *
 * Contrainte de fond : tout ce que la page annonce doit exister dans le produit.
 * Les quatre familles de la section « Ce qu'on relève » sont exactement les
 * valeurs de detected_gaps.category (voir lib/compare/detect-gaps.ts), et les
 * réserves affichées (présence d'avis sans la note, présence sociale sans le
 * volume) sont celles que le moteur applique réellement.
 */

/** Largeur de colonne commune à toutes les sections — et à la barre de navigation. */
const SHELL = "mx-auto w-full max-w-6xl px-6";
/** Rythme vertical commun. Le seul séparateur entre deux sections. */
const BLOCK = "py-20 lg:py-24";

const HEADING =
  "font-brand text-[2rem] font-bold leading-[1.06] tracking-[-0.032em] text-paper sm:text-[2.9rem]";

const PRIMARY_CTA =
  "inline-flex h-12 items-center justify-center rounded-full bg-signal px-7 text-base font-semibold text-paper shadow-signal-lg transition-colors duration-150 hover:bg-signal-bright hover:text-void focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-bright";

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
    // Aucun fond opaque ici : le halo ambiant est en `fixed` derrière la page et
    // un `bg-void` sur ce conteneur le recouvrirait entièrement.
    <div className="relative text-paper">
      <AmbientBackdrop />

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
   Hero
   -------------------------------------------------------------------------- */

function Hero({ authenticated }: { authenticated: boolean }) {
  const cta = heroCta(authenticated);
  return (
    <section id="top" className={`${SHELL} pb-16 pt-14 lg:pb-24 lg:pt-20`}>
      <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-16">
        <div className="reveal-up">
          <span className="pill font-mono text-[0.66rem] uppercase tracking-[0.12em] text-mist">
            <span
              className="signal-pulse h-1.5 w-1.5 rounded-full bg-signal-bright"
              aria-hidden="true"
            />
            Comparateur de faits publics
          </span>

          <h1 className="mt-6 font-brand text-[2.9rem] font-bold leading-[1] tracking-[-0.045em] text-paper sm:text-[3.9rem] lg:text-[4.6rem]">
            Vois où tu perds
            <br />
            <span className="text-signal-bright text-glow-signal">du terrain.</span>
          </h1>

          <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-mist">
            Donne ton URL et celle de ton plus gros concurrent. Rivalys relève les faits
            publics des deux côtés, cote chaque écart, et le transforme en tâche précise —
            jamais en conseil générique.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={cta.href} className={PRIMARY_CTA}>
              {cta.label}
            </Link>
            {/* Proposer de se connecter à quelqu'un qui l'est déjà n'a pas de sens. */}
            {authenticated ? null : (
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/[0.16] px-6 text-base text-mist transition-colors hover:border-white/40 hover:text-paper"
              >
                J&rsquo;ai déjà un compte →
              </Link>
            )}
          </div>

          <p className="mt-6 font-mono text-[0.68rem] uppercase leading-relaxed tracking-[0.1em] text-mist/60">
            Deux URL suffisent · aucune donnée privée · aucun crawl autonome
          </p>
        </div>

        <Releve />
      </div>
    </section>
  );
}

/**
 * Élément signature : le relevé comparé.
 *
 * Trois colonnes — ta valeur, le champ relevé, la sienne — et la teinte `flare`
 * posée sur le fait qui ouvre l'écart : tantôt son chiffre (il est moins cher,
 * il publie plus de paliers), tantôt le tien (tu n'as pas d'essai, pas de fiche).
 * Ce n'est donc pas « rouge = lui » ni un feu tricolore, mais un repère unique :
 * voilà la ligne qui produira une tâche.
 *
 * La dernière ligne est volontairement alignée : le produit doit montrer qu'il
 * sait aussi ne rien signaler. Les valeurs sont un exemple, la légende le dit.
 */
interface ReleveRow {
  field: string;
  you: string;
  youUnit?: string;
  rival: string;
  rivalUnit?: string;
  /** Côté qui porte le fait générateur d'écart. `null` = ligne alignée. */
  flag: "you" | "rival" | null;
}

const RELEVE_ROWS: ReleveRow[] = [
  { field: "Prix d'entrée", you: "29 €", youUnit: "/mois", rival: "25 €", rivalUnit: "/mois", flag: "rival" },
  { field: "Essai gratuit", you: "Aucun", rival: "14 jours", flag: "you" },
  { field: "Paliers publiés", you: "2 paliers", rival: "4 paliers", flag: "rival" },
  { field: "Fiche G2", you: "Introuvable", rival: "Publiée", flag: "you" },
  { field: "Cible annoncée", you: "PME", rival: "PME", flag: null },
];

const RELEVE_GRID = "grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] gap-2";

function Releve() {
  return (
    <figure
      className="panel-focal reveal-up overflow-hidden"
      style={{ animationDelay: "0.12s" }}
    >
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.09] px-5 py-4 font-mono text-[0.64rem] uppercase tracking-[0.14em] sm:px-6">
        <span className="text-paper">Relevé comparé</span>
        <span className="text-mist/60">Exemple · valeurs illustratives</span>
      </figcaption>

      <div
        className={`${RELEVE_GRID} border-b border-white/[0.06] px-5 py-3 font-mono text-[0.6rem] uppercase tracking-[0.12em] text-mist/60 sm:px-6`}
      >
        <span>Toi</span>
        <span className="text-center">Champ</span>
        <span className="text-right">Concurrent</span>
      </div>

      <div className="flex flex-col divide-y divide-white/[0.06]">
        {RELEVE_ROWS.map((row) => (
          <div
            key={row.field}
            className={`${RELEVE_GRID} items-center px-5 py-3.5 transition-colors hover:bg-white/[0.03] sm:px-6`}
          >
            <Value value={row.you} unit={row.youUnit} flagged={row.flag === "you"} />

            <span className="text-center text-xs leading-tight text-mist">{row.field}</span>

            <span className="flex items-center justify-end gap-2 text-right">
              {/* L'étiquette « aligné » ne vaut que pour la ligne sans écart : elle
                  dit explicitement qu'aucune tâche n'en sortira. */}
              {row.flag === null ? (
                <span className="rounded border border-white/[0.14] px-1.5 py-0.5 font-mono text-[0.58rem] uppercase tracking-[0.08em] text-mist/60">
                  aligné
                </span>
              ) : null}
              <Value value={row.rival} unit={row.rivalUnit} flagged={row.flag === "rival"} />
            </span>
          </div>
        ))}
      </div>

      <p className="border-t border-white/[0.08] px-5 py-3.5 text-[0.8rem] leading-relaxed text-mist sm:px-6">
        4 écarts cotés → 4 tâches. Une ligne alignée n&rsquo;en génère aucune.
      </p>
    </figure>
  );
}

function Value({
  value,
  unit,
  flagged,
}: {
  value: string;
  unit?: string;
  flagged: boolean;
}) {
  return (
    <span
      className={`text-[0.95rem] font-semibold ${flagged ? "text-flare" : "text-paper"}`}
    >
      {value}
      {unit ? <span className="text-xs font-normal text-mist/60">{unit}</span> : null}
    </span>
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
    limit:
      "Uniquement ce qui figure sur la page de tarifs publique. Page introuvable : on te le dit, on n'estime pas.",
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
    limit:
      "Présence d'une fiche, pas la note ni le nombre d'avis : ces chiffres bougent trop vite pour être affichés honnêtement entre deux relevés.",
  },
  {
    category: "social_presence",
    title: "Présence sociale",
    fields: ["Réseaux liés depuis le site", "Contenus tiers"],
    limit:
      "Présence détectée, volume non mesurable : ces plateformes réservent leurs statistiques à des partenaires licenciés.",
  },
];

/**
 * Quatre lignes pleine largeur plutôt que quatre cartes.
 *
 * Une carte isole ; ici les familles forment un inventaire qu'on parcourt du
 * regard, colonne par colonne — numéro et titre, champs relevés, limite. La
 * limite tient la troisième colonne à hauteur égale des deux autres : elle n'est
 * pas une note de bas de page, c'est la moitié de l'argument.
 */
function WhatWeMeasure() {
  return (
    <section id="ce-quon-releve" className={`${SHELL} ${BLOCK}`}>
      <div className="mb-10 grid items-end gap-8 lg:mb-12 lg:grid-cols-2 lg:gap-14">
        <div>
          <Eyebrow>Ce qu&rsquo;on relève</Eyebrow>
          <h2 className={`mt-4 ${HEADING}`}>
            Quatre familles de faits. Et leurs limites, écrites noir sur blanc.
          </h2>
        </div>
        <p className="text-base leading-relaxed text-mist">
          Un comparateur qui ne dit pas ce qu&rsquo;il ignore raconte n&rsquo;importe quoi
          avec assurance. Voilà exactement ce que Rivalys mesure — et là où il
          s&rsquo;arrête.
        </p>
      </div>

      <ol className="flex flex-col border-b border-white/[0.12]">
        {MEASURE_FAMILIES.map((family, index) => (
          <li
            key={family.category}
            className="grid items-baseline gap-5 border-t border-white/[0.12] py-6 transition-colors hover:bg-white/[0.022] lg:grid-cols-3 lg:gap-10 lg:py-7"
          >
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[0.68rem] text-signal-bright">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-brand text-xl font-bold tracking-[-0.02em] text-paper sm:text-2xl">
                  {family.title}
                </h3>
                <code className="font-mono text-[0.66rem] text-mist/60">{family.category}</code>
              </div>
            </div>

            <ul className="flex flex-wrap gap-1.5">
              {family.fields.map((field) => (
                <li
                  key={field}
                  className="rounded-md border border-white/[0.14] px-2.5 py-1 text-[0.75rem] text-paper/90"
                >
                  {field}
                </li>
              ))}
            </ul>

            <p className="text-[0.85rem] leading-relaxed text-mist/80">
              <span className="text-flare">Limite —</span> {family.limit}
            </p>
          </li>
        ))}
      </ol>
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
    <section id="comment-ca-marche" className={`${SHELL} ${BLOCK}`}>
      <Eyebrow>Le parcours</Eyebrow>
      <h2 className={`mt-4 max-w-xl ${HEADING}`}>Trois étapes, aucune supposition.</h2>

      <ol className="mt-10 grid gap-4 sm:grid-cols-3 lg:mt-12 lg:gap-6">
        {STEPS.map((step) => (
          <li key={step.n} className="panel p-6">
            <span className="font-mono text-[0.72rem] tracking-[0.1em] text-signal-bright">
              {step.n}
            </span>
            <h3 className="mt-3.5 font-brand text-xl font-bold tracking-[-0.02em] text-paper">
              {step.title}
            </h3>
            <p className="mt-2.5 text-[0.9rem] leading-relaxed text-mist">{step.body}</p>
          </li>
        ))}
      </ol>
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
    <section className={`${SHELL} ${BLOCK}`}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Eyebrow>De l&rsquo;écart à la tâche</Eyebrow>
          <h2 className={`mt-4 ${HEADING}`}>
            Une tâche ne peut naître que d&rsquo;un écart mesuré.
          </h2>
          <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-mist">
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
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${task.strength}`}
                    aria-hidden="true"
                  />
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

const EXAMPLE_SCORE_LINES: {
  priority: GapPriority;
  singular: string;
  plural: string;
  /* Graduation de l'accent, pas trois teintes : la priorité se lit comme une
     intensité de signal, exactement comme dans la liste de tâches. */
  bar: string;
}[] = [
  { priority: "high", singular: "écart prioritaire", plural: "écarts prioritaires", bar: "bg-signal-bright" },
  { priority: "medium", singular: "écart à planifier", plural: "écarts à planifier", bar: "bg-signal-bright/55" },
  { priority: "low", singular: "écart mineur", plural: "écarts mineurs", bar: "bg-signal-bright/25" },
];

function ScoreSection() {
  const lines: ScoreLine[] = EXAMPLE_SCORE_LINES.map((line) => {
    const count = EXAMPLE_COUNTS[line.priority];
    return {
      label: `${count} ${count > 1 ? line.plural : line.singular}`,
      lost: count * POINTS_PER_PRIORITY[line.priority],
      bar: line.bar,
    };
  });

  return (
    <section id="score" className={`${SHELL} ${BLOCK}`}>
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Eyebrow>Le score</Eyebrow>
          <h2 className={`mt-4 ${HEADING}`}>Un chiffre qui s&rsquo;explique ligne par ligne.</h2>
          <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-mist">
            {MAX_SCORE} moins {POINTS_PER_PRIORITY.high} points par écart prioritaire,{" "}
            {POINTS_PER_PRIORITY.medium} par écart à planifier, {POINTS_PER_PRIORITY.low} par
            écart mineur. Rien d&rsquo;autre. Tu peux ouvrir le détail et retrouver chaque
            point perdu — un score que tu ne peux pas reconstituer toi-même est une vanity
            metric.
          </p>
          <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-mist/80">
            Il baisse quand un écart s&rsquo;ouvre, remonte quand tu le refermes. Il
            n&rsquo;est jamais comparé à celui d&rsquo;un autre utilisateur.
          </p>
        </div>

        <ScoreCard score={EXAMPLE_SCORE} maxScore={MAX_SCORE} lines={lines} />
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
    <section className={`${SHELL} ${BLOCK}`}>
      <Eyebrow>Ce qu&rsquo;on ne fait pas</Eyebrow>
      <h2 className={`mt-4 max-w-xl ${HEADING}`}>
        Honnête par construction, pas seulement par promesse.
      </h2>

      <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:mt-12">
        {NOT_DOING.map((item) => (
          <div key={item.title} className="flex gap-4">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.14] text-[0.7rem] text-mist"
            >
              ✕
            </span>
            <div>
              <dt className="font-brand text-lg font-bold tracking-[-0.015em] text-paper">
                {item.title}
              </dt>
              <dd className="mt-2 text-[0.9rem] leading-relaxed text-mist">{item.body}</dd>
            </div>
          </div>
        ))}
      </dl>
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
    <section id="faq" className={`${SHELL} ${BLOCK}`}>
      {/*
        La seule section centrée avec le CTA de clôture. La liste est étroite par
        nécessité — une question doit tenir sur une ligne d'œil — et une colonne
        étroite calée à gauche laisse la moitié droite de la page vide, ce qui se
        lit comme un bloc oublié plutôt que comme un choix. L'axe central la
        rattache au reste.
      */}
      <div className="text-center">
        <Eyebrow>Questions fréquentes</Eyebrow>
        <h2 className={`mt-4 ${HEADING}`}>Ce qu&rsquo;on te demande le plus.</h2>
      </div>

      <div className="mx-auto mt-10 flex max-w-3xl flex-col divide-y divide-white/[0.08] border-y border-white/[0.08] lg:mt-12">
        {FAQ_ITEMS.map((item, index) => (
          // La première est ouverte : une pile de neuf lignes fermées ne dit pas
          // ce qu'on y trouve, et la réponse visible sert d'échantillon de ton.
          <details key={item.q} className="group py-5" open={index === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-signal-bright [&::-webkit-details-marker]:hidden">
              <span className="flex items-baseline gap-4">
                <span className="font-mono text-[0.66rem] text-mist/50">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-brand text-base font-medium text-paper sm:text-lg">
                  {item.q}
                </span>
              </span>
              <svg
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4 shrink-0 text-mist transition-transform duration-200 group-open:rotate-45"
                aria-hidden="true"
              >
                <path
                  d="M10 4v12M4 10h12"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </summary>
            <p className="mt-3 max-w-xl pl-9 text-sm leading-relaxed text-mist">{item.a}</p>
          </details>
        ))}
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
    <section className={`${SHELL} py-24 text-center lg:py-28`}>
      <h2 className="mx-auto max-w-3xl font-brand text-[2rem] font-bold leading-[1.04] tracking-[-0.032em] text-paper sm:text-[3.1rem]">
        Sais quoi faire{" "}
        <span className="text-signal-bright text-glow-signal">pour le regagner.</span>
      </h2>
      <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-mist">
        Un premier relevé prend quelques minutes et n&rsquo;a besoin que de deux URL.
      </p>
      <Link href={cta.href} className={`mt-9 ${PRIMARY_CTA}`}>
        {cta.label}
      </Link>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.08]">
      <div
        className={`${SHELL} flex flex-col gap-10 py-14 sm:flex-row sm:items-start sm:justify-between`}
      >
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
