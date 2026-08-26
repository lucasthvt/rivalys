import Link from "next/link";
import type { ReactNode } from "react";

export default function Home() {
  return (
    <div className="bg-void text-paper">
      <Hero />
      <CategoryMarquee />
      <HowItWorks />
      <FeatureShowcase />
      <WhatWeDont />
      <FinalCta />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06]">
      <div
        className="bg-signal-grid pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          maskImage: "radial-gradient(ellipse 70% 55% at 50% 20%, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 20%, black 0%, transparent 75%)",
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[-12rem] h-[26rem] w-[42rem] -translate-x-1/2 rounded-full bg-signal/25 blur-[110px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-6xl px-6 pb-20 pt-20 lg:pb-28 lg:pt-28">
        <div className="reveal-up mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 font-mono text-[0.7rem] uppercase tracking-[0.1em] text-mist">
            <span className="signal-pulse h-1.5 w-1.5 rounded-full bg-signal-bright" aria-hidden="true" />
            Comparateur public · une URL suffit
          </div>

          <h1 className="mt-6 font-brand text-[2.6rem] font-semibold leading-[1.08] tracking-tight text-paper sm:text-6xl lg:text-[4rem]">
            Vois où tu perds
            <br />
            <span className="text-signal-bright text-glow-signal">du terrain.</span>
          </h1>

          <p className="mt-6 max-w-xl text-balance text-lg leading-relaxed text-mist">
            Renseigne ton SaaS et ton plus gros concurrent. Rivalys compare les faits publics —
            pricing, essai gratuit, positionnement — et transforme chaque écart en tâche précise à
            faire cette semaine.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              "Données publiques uniquement",
              "Zéro carte bancaire",
              "Résultat en quelques minutes",
            ].map((fact) => (
              <span
                key={fact}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[0.68rem] text-mist"
              >
                <span className="h-1 w-1 rounded-full bg-signal-bright" aria-hidden="true" />
                {fact}
              </span>
            ))}
          </div>

          <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-13 items-center justify-center rounded-full bg-signal px-7 text-base font-semibold text-paper shadow-signal-lg transition-all duration-150 hover:bg-signal-bright hover:text-void"
            >
              Comparer mon SaaS — gratuit
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-mist transition-colors hover:text-paper"
            >
              J&rsquo;ai déjà un compte →
            </Link>
          </div>
        </div>

        <GapPanel />
      </div>
    </section>
  );
}

/**
 * The page's signature element: a live-reading instrument showing two
 * signal traces — you and your competitor — over the same public metrics.
 * The shaded band between the traces at their widest point of divergence
 * is the literal "gap" the product is named for; the floating annotation
 * names the exact category the comparator actually tracks
 * (detected_gaps.category), so it stays honest about what's illustrative.
 */
function GapPanel() {
  return (
    <figure className="reveal-up relative mx-auto mt-16 max-w-4xl" style={{ animationDelay: "0.15s" }}>
      <div className="relative rounded-3xl border border-white/10 bg-void-raised p-6 shadow-signal-lg sm:p-8">
        <figcaption className="mb-6 flex flex-wrap items-center justify-between gap-2 font-mono text-[0.68rem] uppercase tracking-[0.1em] text-mist">
          <span>Relevé d&rsquo;exemple</span>
          <span>2 SaaS · mêmes catégories publiques</span>
        </figcaption>

        <div className="relative">
          <svg
            viewBox="0 0 720 300"
            role="img"
            aria-label="Deux courbes de suivi comparant ton SaaS et ton concurrent : les deux avancent ensemble, puis ton concurrent prend l'avantage sur l'essai gratuit, avant que les courbes se rejoignent."
            className="w-full"
          >
            <defs>
              <linearGradient id="gapFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-signal-bright)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--color-signal-bright)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* baseline grid */}
            {[60, 130, 200, 270].map((y) => (
              <line key={y} x1="0" y1={y} x2="720" y2={y} stroke="white" strokeOpacity="0.05" strokeWidth="1" />
            ))}

            {/* gap fill between the two traces */}
            <path
              d="M260,150 C300,150 320,90 380,80 C440,70 470,130 520,150 L520,150 C470,150 440,150 380,150 C320,150 300,150 260,150 Z"
              fill="url(#gapFill)"
            />

            {/* competitor trace (dashed, mist) */}
            <path
              className="chart-path-draw"
              d="M0,170 C60,168 100,172 160,165 C220,158 240,152 260,150 C300,150 320,90 380,80 C440,70 470,130 520,150 C570,166 620,168 680,163 C700,161 710,160 720,160"
              fill="none"
              stroke="var(--color-mist)"
              strokeWidth="2"
              strokeDasharray="5 6"
              strokeLinecap="round"
            />

            {/* your trace (solid, signal-bright, glowing) */}
            <path
              className="chart-path-draw"
              style={{ animationDelay: "0.15s", filter: "drop-shadow(0 0 6px var(--color-signal-bright))" }}
              d="M0,175 C60,178 100,172 160,175 C220,178 240,172 260,170 C300,168 320,166 380,150 C440,134 470,150 520,150 C570,150 620,158 680,155 C700,154 710,153 720,153"
              fill="none"
              stroke="var(--color-signal-bright)"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* divergence markers */}
            <circle cx="380" cy="80" r="4.5" fill="var(--color-mist)" stroke="var(--color-void-raised)" strokeWidth="2" />
            <circle cx="380" cy="150" r="4.5" fill="var(--color-signal-bright)" stroke="var(--color-void-raised)" strokeWidth="2" />
            <line x1="380" y1="80" x2="380" y2="150" stroke="var(--color-signal-bright)" strokeWidth="1" strokeDasharray="2 3" strokeOpacity="0.6" />
          </svg>

          <div className="pointer-events-none absolute left-[52.7%] top-[16%] -translate-x-1/2 -translate-y-full">
            <div className="signal-pulse rounded-lg border border-signal-bright/40 bg-void px-2.5 py-1.5 font-mono text-[0.62rem] uppercase tracking-wide text-signal-bright shadow-signal-sm">
              Écart détecté · essai gratuit
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-5 font-mono text-[0.68rem] uppercase tracking-wide text-mist">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-signal-bright" aria-hidden="true" />
            Toi
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-mist" aria-hidden="true" />
            Ton concurrent
          </span>
        </div>
      </div>
    </figure>
  );
}

const CATEGORIES = [
  "SaaS B2B",
  "SaaS B2C",
  "Productivité",
  "Marketing",
  "RH",
  "Finance",
  "E-commerce",
  "Support client",
  "Analytics",
  "Facturation",
];

function CategoryMarquee() {
  const track = [...CATEGORIES, ...CATEGORIES];
  return (
    <section className="marquee-pause overflow-hidden border-b border-white/[0.06] py-8">
      <div className="marquee-track flex w-max items-center gap-3">
        {track.map((cat, i) => (
          <span
            key={`${cat}-${i}`}
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 font-mono text-[0.7rem] uppercase tracking-wide text-mist"
          >
            {cat}
          </span>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Renseigne",
      body: "Ton URL et celle de ton plus gros concurrent. Rien d'autre — pas de compte à créer chez eux, pas d'accès à demander.",
    },
    {
      n: "02",
      title: "Compare",
      body: "On va chercher les pages publiques (accueil, pricing) et on relève les faits : essai gratuit, palier gratuit, positionnement.",
    },
    {
      n: "03",
      title: "Agis",
      body: "Chaque écart détecté devient une tâche précise, priorisée. Tu coches, le comparatif se met à jour.",
    },
  ];

  return (
    <section id="comment-ca-marche" className="border-b border-white/[0.06]">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
        <div className="max-w-xl">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-signal-bright">
            [ Le parcours ]
          </p>
          <h2 className="mt-3 font-brand text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
            Trois étapes, aucune supposition.
          </h2>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6">
          {steps.map((step) => (
            <div key={step.n} className="rounded-2xl border border-white/10 bg-void-raised p-6">
              <span className="font-mono text-sm text-signal-bright">{step.n}</span>
              <h3 className="mt-3 font-brand text-xl font-semibold text-paper">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mist">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface FeatureBlockProps {
  eyebrow: string;
  title: string;
  body: string;
  reverse?: boolean;
  mock: ReactNode;
}

function FeatureBlock({ eyebrow, title, body, reverse, mock }: FeatureBlockProps) {
  return (
    <div
      className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}
    >
      <div>
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-signal-bright">
          [ {eyebrow} ]
        </p>
        <h3 className="mt-3 font-brand text-2xl font-semibold tracking-tight text-paper sm:text-3xl">
          {title}
        </h3>
        <p className="mt-4 max-w-md text-base leading-relaxed text-mist">{body}</p>
      </div>
      {mock}
    </div>
  );
}

function FeatureShowcase() {
  return (
    <section className="border-b border-white/[0.06]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 py-20 lg:gap-28 lg:py-28">
        <FeatureBlock
          eyebrow="Comparateur"
          title="Le pricing de ton concurrent, à côté du tien."
          body="Paliers, prix, essai gratuit, palier gratuit — extraits directement de sa page publique, jamais devinés. Si une donnée n'est pas trouvée, on te le dit plutôt que d'inventer."
          mock={
            <div className="rounded-2xl border border-white/10 bg-void-raised p-5 shadow-signal-lg">
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="rounded-xl border border-signal-bright/30 bg-signal/10 p-4">
                  <p className="text-mist">Toi</p>
                  <p className="mt-1 text-lg text-paper">29€/mois</p>
                  <p className="mt-2 text-mist">Essai gratuit — non</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-mist">Concurrent</p>
                  <p className="mt-1 text-lg text-paper">25€/mois</p>
                  <p className="mt-2 text-signal-bright">Essai gratuit — 14j</p>
                </div>
              </div>
            </div>
          }
        />

        <FeatureBlock
          eyebrow="Écarts"
          title="Chaque écart devient une tâche, pas un email anxiogène."
          body="Aucun conseil générique. Si aucun écart n'est détecté, la liste reste vide — plutôt que d'inventer du travail."
          reverse
          mock={
            <div className="flex flex-col gap-3">
              {[
                { label: "Prioritaire", strength: "bg-signal-bright", title: "Le concurrent propose un essai gratuit, pas toi" },
                { label: "À planifier", strength: "bg-signal-bright/60", title: "Il a un palier gratuit en plus des tiens" },
                { label: "Quand tu peux", strength: "bg-signal-bright/25", title: "Son positionnement diffère du tien" },
              ].map((t) => (
                <div key={t.title} className="rounded-xl border border-white/10 bg-void-raised p-4">
                  <span className="inline-flex items-center gap-1.5 font-mono text-[0.65rem] uppercase tracking-wide text-mist">
                    <span className={`h-1.5 w-1.5 rounded-full ${t.strength}`} aria-hidden="true" />
                    {t.label}
                  </span>
                  <p className="mt-2 text-sm text-paper">{t.title}</p>
                </div>
              ))}
            </div>
          }
        />

        <FeatureBlock
          eyebrow="Score"
          title="Regarde le terrain regagné, semaine après semaine."
          body="Un score qui baisse quand un écart s'ouvre, remonte quand tu le résous. Pas de vanity metric — juste le reflet direct de tes tâches."
          mock={
            <div className="rounded-2xl border border-white/10 bg-void-raised p-6 shadow-signal-lg">
              <div className="flex items-baseline justify-between font-mono text-xs text-mist">
                <span>Score global</span>
                <span className="text-2xl text-paper">78</span>
              </div>
              <svg viewBox="0 0 300 80" className="mt-4 w-full" aria-hidden="true">
                <path
                  d="M0,60 C40,55 60,40 100,42 C140,44 160,20 200,18 C240,16 260,26 300,22"
                  fill="none"
                  stroke="var(--color-signal-bright)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{ filter: "drop-shadow(0 0 6px var(--color-signal-bright))" }}
                />
              </svg>
            </div>
          }
        />
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
      body: "Ce que Rivalys te montre reste à toi. Ce n'est pas un palmarès pour t'humilier.",
    },
  ];

  return (
    <section className="border-b border-white/[0.06]">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 lg:py-24">
        <div className="max-w-xl">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-signal-bright">
            [ Ce qu&rsquo;on ne fait pas ]
          </p>
          <h2 className="mt-3 font-brand text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
            Honnête par construction, pas seulement par promesse.
          </h2>
        </div>

        <dl className="mt-10 grid gap-8 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.title}>
              <dt className="font-brand text-lg font-semibold text-paper">{item.title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-mist">{item.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden border-b border-white/[0.06]">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[22rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal/20 blur-[100px]"
        aria-hidden="true"
      />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-20 text-center lg:py-28">
        <h2 className="mx-auto max-w-2xl font-brand text-3xl font-semibold tracking-tight text-paper sm:text-4xl">
          Prêt à voir où tu te situes ?
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-mist">
          Deux URL. Une comparaison. Une liste de tâches qui a du sens.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/signup"
            className="inline-flex h-13 items-center justify-center rounded-full bg-signal px-7 text-base font-semibold text-paper shadow-signal-lg transition-all duration-150 hover:bg-signal-bright hover:text-void"
          >
            Comparer mon SaaS — gratuit
          </Link>
        </div>
        <p className="mx-auto mt-4 max-w-md font-mono text-[0.68rem] uppercase tracking-wide text-mist">
          Mise à jour hebdomadaire ou mensuelle selon ton palier — jamais en temps réel
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-mist sm:flex-row">
        <p>© 2026 Rivalys — comparateur concurrentiel honnête pour fondateurs de SaaS.</p>
        <Link href="/login" className="transition-colors hover:text-paper">
          Se connecter
        </Link>
      </div>
    </footer>
  );
}
