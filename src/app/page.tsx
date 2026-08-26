import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <ExampleTasks />
      <WhatWeDont />
      <FinalCta />
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-surface-border">
      <div className="bg-contour pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-16 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-28">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent-strong">
            Comparateur public · une URL suffit
          </p>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tightish text-foreground sm:text-5xl lg:text-[3.4rem]">
            Vois où tu perds du terrain.
            <br />
            Sais quoi faire pour{" "}
            <span className="text-teal-700 dark:text-teal-500">le regagner</span>.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-foreground-muted">
            Renseigne ton SaaS et ton plus gros concurrent. Rivalys compare les faits publics —
            pricing, essai gratuit, avis, positionnement — et transforme chaque écart en tâche
            précise à faire cette semaine.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/signup" className={buttonVariants({ variant: "primary", size: "lg" })}>
              Comparer mon SaaS — gratuit
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "lg" })}>
              J&rsquo;ai déjà un compte
            </Link>
          </div>
          <p className="mt-4 font-mono text-xs uppercase tracking-wide text-foreground-muted">
            Aucune carte bancaire requise · seulement deux URL
          </p>
        </div>

        <ElevationChart />
      </div>
    </section>
  );
}

/**
 * The page's signature element: an elevation-profile comparison, the same
 * shape as a trail app's terrain chart, standing in for "where you lose
 * ground". Three benchmark markers name the exact gap categories the
 * comparator actually detects (see detected_gaps.category in the schema) —
 * illustrative data, clearly labelled as such, never implying it's live.
 */
function ElevationChart() {
  return (
    <figure className="relative">
      <div className="rounded-2xl border border-surface-border bg-surface p-6 shadow-[0_1px_2px_rgba(27,33,25,0.05)]">
        <figcaption className="mb-4 flex items-center justify-between font-mono text-xs uppercase tracking-wide text-foreground-muted">
          <span>Relevé d&rsquo;exemple</span>
          <span>2 SaaS · mêmes catégories publiques</span>
        </figcaption>

        <svg
          viewBox="0 0 720 340"
          role="img"
          aria-label="Graphique illustrant deux profils de terrain : le tien, en retrait sur trois points, et celui de ton concurrent, en avance sur l'essai gratuit, le palier gratuit et le positionnement."
          className="w-full"
        >
          <defs>
            <linearGradient id="competitorFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-brass-500)" stopOpacity="0.16" />
              <stop offset="100%" stopColor="var(--color-brass-500)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* baseline */}
          <line x1="0" y1="300" x2="720" y2="300" stroke="var(--color-stone-200)" strokeWidth="1" />

          {/* competitor terrain fill */}
          <path
            d="M0,250 C60,220 90,180 140,165 C190,150 230,190 260,200 C310,210 340,150 380,135 C430,120 470,175 500,190 C550,205 580,140 620,125 C660,112 690,120 720,115 L720,300 L0,300 Z"
            fill="url(#competitorFill)"
            stroke="none"
          />

          {/* your line */}
          <path
            className="chart-path-draw"
            d="M0,260 C60,255 90,270 140,250 C190,230 210,260 260,255 C310,250 330,270 380,255 C430,240 450,265 500,250 C550,235 570,255 620,245 C660,238 690,242 720,235"
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* competitor line */}
          <path
            className="chart-path-draw"
            style={{ animationDelay: "0.15s" }}
            d="M0,250 C60,220 90,180 140,165 C190,150 230,190 260,200 C310,210 340,150 380,135 C430,120 470,175 500,190 C550,205 580,140 620,125 C660,112 690,120 720,115"
            fill="none"
            stroke="var(--color-brass-500)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* benchmark markers */}
          {[
            { x: 140, yYou: 250, yComp: 165, label: "Essai gratuit" },
            { x: 380, yYou: 255, yComp: 135, label: "Palier gratuit" },
            { x: 620, yYou: 245, yComp: 125, label: "Positionnement" },
          ].map((m) => (
            <g key={m.label}>
              <line
                x1={m.x}
                y1={m.yComp}
                x2={m.x}
                y2={m.yYou}
                stroke="var(--color-stone-400)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle cx={m.x} cy={m.yYou} r="4" fill="var(--color-ink)" />
              <circle
                cx={m.x}
                cy={m.yComp}
                r="5"
                fill="var(--color-brass-500)"
                stroke="var(--color-stone-50)"
                strokeWidth="2"
              />
              <text
                x={m.x}
                y={m.yComp - 14}
                textAnchor="middle"
                className="font-mono"
                fontSize="11"
                fill="var(--color-foreground-muted)"
              >
                {m.label}
              </text>
            </g>
          ))}
        </svg>

        <div className="mt-4 flex items-center gap-5 font-mono text-xs uppercase tracking-wide text-foreground-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-ink" aria-hidden="true" />
            Toi
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brass-500" aria-hidden="true" />
            Ton concurrent
          </span>
        </div>
      </div>
    </figure>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Renseigne",
      body: "Ton URL et celle de ton plus gros concurrent. Rien d’autre — pas de compte à créer chez eux, pas d’accès à demander.",
    },
    {
      n: "02",
      title: "Compare",
      body: "On va chercher les pages publiques (accueil, pricing) et on relève les faits : essai gratuit, palier gratuit, positionnement, avis.",
    },
    {
      n: "03",
      title: "Agis",
      body: "Chaque écart détecté devient une tâche précise, priorisée. Tu coches, le comparatif se met à jour.",
    },
  ];

  return (
    <section id="comment-ca-marche" className="border-b border-surface-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
        <div className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent-strong">
            Le parcours
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tightish text-foreground sm:text-4xl">
            Trois étapes, aucune supposition.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.n} className="relative">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-accent-strong">{step.n}</span>
                <div
                  className="h-px flex-1 bg-surface-border sm:hidden"
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-3 font-display text-xl font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{step.body}</p>
              {i < steps.length - 1 && (
                <div
                  className="absolute right-[-1.5rem] top-2 hidden h-px w-6 bg-surface-border sm:block"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ExampleTasks() {
  const tasks = [
    {
      title: "Le concurrent propose un essai gratuit, pas toi",
      description: "Détecté sur sa page pricing. Écart de catégorie pricing.",
      variant: "priority-high" as const,
      label: "Prioritaire",
    },
    {
      title: "Il a un palier gratuit en plus des tiens",
      description: "Ses paliers publics couvrent un usage que tu ne couvres pas encore.",
      variant: "priority-medium" as const,
      label: "À planifier",
    },
    {
      title: "Son positionnement marketing diffère du tien",
      description: "Sa proposition de valeur cible un public différent du tien.",
      variant: "priority-low" as const,
      label: "Quand tu peux",
    },
  ];

  return (
    <section className="border-b border-surface-border bg-surface/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
        <div className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent-strong">
            Résultat concret
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tightish text-foreground sm:text-4xl">
            Chaque écart devient une tâche, pas un email anxiogène.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-foreground-muted">
            Aucun conseil générique. Si aucun écart n&rsquo;est détecté, la liste reste vide —
            plutôt que d&rsquo;inventer du travail.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {tasks.map((task) => (
            <Card key={task.title}>
              <CardHeader>
                <Badge variant={task.variant} dot>
                  {task.label}
                </Badge>
              </CardHeader>
              <CardTitle className="text-base">{task.title}</CardTitle>
              <CardContent className="mt-2">{task.description}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhatWeDont() {
  const items = [
    {
      title: "Aucune donnée privée",
      body: "On ne prétend jamais connaître ton MRR ou celui de ton concurrent — seulement ce qui est public.",
    },
    {
      title: "Aucun crawl autonome",
      body: "On ne va chercher des données que pour les deux URL que tu donnes, à ta demande.",
    },
    {
      title: "Aucun classement public",
      body: "Ce que Rivalys te montre reste à toi. Ce n’est pas un palmarès pour t’humilier.",
    },
  ];

  return (
    <section className="border-b border-surface-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
        <div className="max-w-xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent-strong">
            Ce qu&rsquo;on ne fait pas
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tightish text-foreground sm:text-4xl">
            Honnête par construction, pas seulement par promesse.
          </h2>
        </div>

        <dl className="mt-10 grid gap-8 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.title}>
              <dt className="font-display text-lg font-semibold text-foreground">{item.title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-foreground-muted">{item.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-b border-surface-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 text-center lg:py-24">
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tightish text-foreground sm:text-4xl">
          Prêt à voir où tu te situes ?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-foreground-muted">
          Deux URL. Une comparaison. Une liste de tâches qui a du sens.
        </p>
        <div className="mt-8 flex justify-center">
          <Link href="/signup" className={buttonVariants({ variant: "primary", size: "lg" })}>
            Comparer mon SaaS — gratuit
          </Link>
        </div>
        <p className="mx-auto mt-4 max-w-md font-mono text-xs uppercase tracking-wide text-foreground-muted">
          Mise à jour hebdomadaire ou mensuelle selon ton palier — jamais en temps réel
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-foreground-muted sm:flex-row">
        <p>© 2026 Rivalys — comparateur concurrentiel honnête pour fondateurs de SaaS.</p>
        <Link href="/login" className="transition-colors hover:text-foreground">
          Se connecter
        </Link>
      </div>
    </footer>
  );
}
