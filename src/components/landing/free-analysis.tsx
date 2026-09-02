"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CATEGORY_LABEL, PRIORITY_COLOR } from "@/components/tasks/priority";
import type { GapPriority, GapCategory } from "@/lib/supabase/database.types";

/**
 * L'analyse gratuite, sans compte, sur la page d'accueil.
 *
 * Ce que le visiteur obtient : son score, le décompte des écarts, et le plus prioritaire
 * d'entre eux EN CLAIR. Le reste n'est pas flouté — il n'est pas envoyé. Le serveur ne
 * transmet que `hiddenCount`, et le gabarit ci-dessous dessine ce nombre de lignes vides.
 * C'est la règle de LockedResults, et elle compte double ici : un flou CSS reste lisible
 * dans le HTML, et cette page est ouverte à tous.
 *
 * Un écart en clair plutôt qu'aucun : sans preuve que l'analyse porte vraiment sur SON
 * site, un score seul se lit comme un chiffre inventé, et le visiteur part.
 */

interface Gap {
  category: GapCategory;
  title: string;
  description: string;
  priority: GapPriority;
}

interface PublicResult {
  ownLabel: string;
  competitorLabel: string;
  score: number;
  gapCount: number;
  counts: Record<GapPriority, number>;
  categories: GapCategory[];
  featuredGap: Gap | null;
  hiddenCount: number;
  hiddenCategories: GapCategory[];
  coverage: { title: string; observations: string[]; consequence: string } | null;
  cached: boolean;
}

export function FreeAnalysis() {
  const [ownUrl, setOwnUrl] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicResult | null>(null);

  async function run(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/public-teardown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownUrl, competitorUrl }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? "L'analyse n'a pas abouti. Réessaie dans un instant.");
        return;
      }
      setResult(payload.result as PublicResult);
    } catch {
      setError("La requête n'est pas partie. Vérifie ta connexion et réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="essai" className="border-b border-white/[0.06]">
      <div className="mx-auto w-full max-w-4xl px-6 py-20 lg:py-24">
        <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-mist">
          Essai gratuit · sans compte
        </p>
        <h2 className="mt-4 font-brand text-[2.1rem] font-bold leading-[1.08] tracking-[-0.02em] text-paper sm:text-[2.6rem]">
          Relève ton premier écart maintenant.
        </h2>
        <p className="mt-5 max-w-xl leading-relaxed text-mist">
          Deux adresses, aucune inscription. Rivalys lit les pages publiques des deux côtés
          et te rend ton écart le plus prioritaire.
        </p>

        <form onSubmit={run} className="mt-10">
          <div className="grid items-end gap-5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-6">
            <UrlField
              label="Ton SaaS"
              value={ownUrl}
              onChange={setOwnUrl}
              placeholder="https://ton-saas.com"
              align="left"
            />
            <div className="hidden pb-3 sm:block">
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-mist/60">
                contre
              </span>
            </div>
            <UrlField
              label="Ton concurrent"
              value={competitorUrl}
              onChange={setCompetitorUrl}
              placeholder="https://son-site.com"
              align="right"
            />
          </div>

          <div className="mt-9 flex flex-col items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-12 items-center justify-center rounded-full bg-signal px-8 text-base font-semibold text-paper shadow-signal-lg transition-colors duration-150 hover:bg-signal-bright hover:text-void focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-bright disabled:pointer-events-none disabled:opacity-50"
            >
              {loading ? "Relevé en cours…" : "Lancer mon analyse gratuite"}
            </button>
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-mist/60">
              Données publiques uniquement · une analyse offerte
            </span>
          </div>
        </form>

        {loading && <Working />}

        {error && (
          <div className="panel mt-10 p-6">
            <p className="leading-relaxed text-paper">{error}</p>
            <Link
              href="/signup"
              className="mt-4 inline-block text-sm font-medium text-signal-bright hover:underline"
            >
              Créer un compte →
            </Link>
          </div>
        )}

        {result && <Result result={result} />}
      </div>
    </section>
  );
}

function UrlField({
  label,
  value,
  onChange,
  placeholder,
  align,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  align: "left" | "right";
}) {
  return (
    <label className="block">
      <span
        className={`block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist ${
          align === "right" ? "sm:text-right" : ""
        }`}
      >
        {label}
      </span>
      <input
        // type="text" et non "url" : la validation native du navigateur exige un schéma et
        // refuserait « brevo.com » sans jamais laisser la requête partir. Le contrôle réel
        // est côté serveur (coerceUserUrl puis assertPublicHttpUrl), qui sait à la fois
        // compléter la saisie et rejeter ce qui doit l'être.
        type="text"
        inputMode="url"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className={`mt-2 w-full border-0 border-b border-white/[0.12] bg-transparent pb-3 font-mono text-base text-paper outline-none transition-colors placeholder:text-mist/35 focus:border-signal-bright ${
          align === "right" ? "sm:text-right" : ""
        }`}
      />
    </label>
  );
}

function Working() {
  const steps = [
    "Lecture des deux pages d'accueil",
    "Recherche des pages de tarifs",
    "Relevé des faits publics",
    "Cotation des écarts",
  ];
  return (
    <ol className="mt-12 grid gap-3 border-t border-white/[0.06] pt-8">
      {steps.map((step, index) => (
        <li key={step} className="flex items-baseline gap-4">
          <span className="font-mono text-[0.62rem] text-mist/45">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-mist">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function Result({ result }: { result: PublicResult }) {
  return (
    <div className="mt-14 border-t border-white/[0.06] pt-10">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist">
        {result.ownLabel} contre {result.competitorLabel}
        {result.cached && " · relevé déjà en mémoire"}
      </p>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-8">
        <p className="flex items-baseline gap-2">
          <span className="font-brand text-[4.5rem] font-bold leading-none tabular-nums text-paper">
            {result.score}
          </span>
          <span className="font-mono text-base text-mist/60">/100</span>
        </p>

        <dl className="flex gap-7">
          {(["high", "medium", "low"] as const).map((priority) => (
            <div key={priority}>
              <dt className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2.5 w-1 shrink-0"
                  style={{ backgroundColor: PRIORITY_COLOR[priority] }}
                />
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist">
                  {priority === "high" ? "Haute" : priority === "medium" ? "Moyenne" : "Basse"}
                </span>
              </dt>
              <dd className="mt-1 font-mono text-xl tabular-nums text-paper">
                {result.counts[priority]}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {result.coverage && (
        <div className="panel mt-8 p-5">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist">
            Ce qu&apos;on n&apos;a pas pu mesurer
          </p>
          <p className="mt-2 text-sm leading-relaxed text-mist">
            {result.coverage.observations.join(" ")} {result.coverage.consequence}
          </p>
        </div>
      )}

      {result.featuredGap ? (
        <>
          <p className="mt-12 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist">
            Ton écart le plus prioritaire
          </p>
          <div className="panel-focal mt-4 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 border border-white/[0.12] px-2 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist">
                <span
                  aria-hidden
                  className="h-2.5 w-1 shrink-0"
                  style={{ backgroundColor: PRIORITY_COLOR[result.featuredGap.priority] }}
                />
                {result.featuredGap.priority === "high"
                  ? "Haute"
                  : result.featuredGap.priority === "medium"
                    ? "Moyenne"
                    : "Basse"}
              </span>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist/70">
                {CATEGORY_LABEL[result.featuredGap.category]}
              </span>
            </div>
            <h3 className="mt-3 text-lg font-medium leading-snug text-paper">
              {result.featuredGap.title}
            </h3>
            <p className="mt-2 leading-relaxed text-mist">{result.featuredGap.description}</p>
          </div>
        </>
      ) : (
        <p className="mt-10 max-w-xl leading-relaxed text-mist">
          Aucune règle ne s&apos;est déclenchée sur cette paire : sur ce qu&apos;on sait
          mesurer, vous êtes alignés.
        </p>
      )}

      {result.hiddenCount > 0 && <Locked count={result.hiddenCount} result={result} />}
    </div>
  );
}

/**
 * Les écarts restants.
 *
 * Le gabarit ne contient AUCUNE donnée : ni titre, ni description, ni longueur réelle.
 * Seul le nombre de lignes est vrai, et il est déjà annoncé en toutes lettres au-dessus —
 * il n'y a donc rien à extraire du HTML que le visiteur ne lise pas déjà.
 */
function Locked({ count, result }: { count: number; result: PublicResult }) {
  const categories = result.hiddenCategories
    .map((category) => CATEGORY_LABEL[category])
    .filter(Boolean);

  return (
    <div className="mt-10">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist">
        {count} autre{count > 1 ? "s" : ""} écart{count > 1 ? "s" : ""} relevé
        {count > 1 ? "s" : ""}
      </p>

      <div className="relative mt-4">
        <div
          className="pointer-events-none min-h-[15rem] select-none blur-[6px] saturate-50"
          aria-hidden="true"
        >
          <div className="grid gap-3">
            {Array.from({ length: Math.min(count, 4) }).map((_, index) => (
              <div key={index} className="panel p-5">
                <div className="h-2.5 w-24 rounded-full bg-white/[0.09]" />
                <div className="mt-4 h-3.5 w-3/4 rounded-full bg-white/[0.07]" />
                <div className="mt-2.5 h-3 w-full rounded-full bg-white/[0.05]" />
                <div className="mt-2 h-3 w-2/3 rounded-full bg-white/[0.05]" />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="panel max-w-md px-6 py-7 text-center backdrop-blur-sm">
            <h3 className="font-brand text-xl text-paper">
              Le reste de ton relevé t&apos;attend
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-mist">
              {categories.length > 0 &&
                (count > 1
                  ? `Ils touchent ${categories.join(", ").toLowerCase()}. `
                  : `Il touche ${categories[0].toLowerCase()}. `)}
              Crée ton compte pour {count > 1 ? "les" : "le"} lire, {count > 1 ? "les" : "le"}{" "}
              cocher au fur et à mesure, et voir ton score remonter.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-signal px-6 text-[0.95rem] font-semibold text-paper transition-colors hover:bg-signal-bright hover:text-void"
            >
              Voir tout mon relevé
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
