"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { FaceOff } from "@/components/dashboard/face-off";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { GapDescription } from "@/components/tasks/gap-description";
import { CATEGORY_LABEL, PRIORITY_COLOR, type GapPriority } from "@/components/tasks/priority";
import {
  readAuthMethods,
  readPaymentMethods,
  readPaymentProviders,
  type StoredExtractedData,
} from "@/lib/compare/site-data";
import type { CoverageNotice } from "@/lib/compare/comparability";
import type { DetectedGap } from "@/components/tasks/priority";

/**
 * L'écran de tournage, construit sur l'idiome du produit plutôt qu'à côté.
 *
 * Deux réemplois volontaires : <FaceOff>, le comparatif du tableau de bord, et les pièces
 * de la liste de tâches (badge de priorité, description repliable). Une démo doit montrer
 * l'écran que voit un client, pas une variante faite pour la caméra — et deux mises en
 * forme du même relevé finiraient par diverger.
 *
 * Le seul parti pris propre à cette page : l'axe central. Le formulaire adopte déjà la
 * géométrie du face-à-face qu'il va produire — ton site à gauche, l'autre à droite, la
 * cote au milieu. Saisie et résultat partagent la même colonne vertébrale, et la page se
 * lit comme un seul relevé plutôt que comme un formulaire suivi d'un rapport.
 */

interface Side {
  label: string;
  url: string;
  data: StoredExtractedData;
}

type Gap = Pick<DetectedGap, "category" | "title" | "description" | "priority">;

interface Result {
  own: Side;
  competitor: Side;
  gaps: Gap[];
  score: number;
  coverage: CoverageNotice | null;
}

const PRIORITY_RANK: Record<GapPriority, number> = { high: 0, medium: 1, low: 2 };

export function TeardownClient() {
  const [ownUrl, setOwnUrl] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function run(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    // Le résultat précédent disparaît dès le lancement : le garder à l'écran pendant une
    // nouvelle analyse ferait filmer les chiffres de la paire d'avant.
    setResult(null);

    try {
      const response = await fetch("/api/teardown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ownUrl, competitorUrl }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.ok) {
        setError(payload?.error ?? `L'analyse n'a pas abouti (${response.status}).`);
        return;
      }
      setResult(payload as Result);
    } catch {
      setError("La requête n'est pas partie. Vérifie ta connexion et relance.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
      <header className="mb-14">
        <Eyebrow>Outil interne</Eyebrow>
        <h1 className="mt-3 font-display text-5xl font-bold tracking-tightish sm:text-6xl">
          Relevé
        </h1>
        <p className="mt-4 max-w-xl leading-relaxed text-foreground-muted">
          Deux sites, les mêmes règles que l&apos;analyse d&apos;un compte client. Rien
          n&apos;est enregistré.
        </p>
      </header>

      <form onSubmit={run}>
        {/* L'axe : la saisie prend déjà la forme du face-à-face qu'elle produira. */}
        <div className="grid items-end gap-6 sm:grid-cols-[1fr_auto_1fr] sm:gap-8">
          <UrlField
            label="À gauche"
            value={ownUrl}
            onChange={setOwnUrl}
            placeholder="https://qonto.com"
            align="left"
          />

          {/* La cote, posée sur la ligne de saisie elle-même : le mot est à la hauteur du
              texte des deux champs, comme une cote entre deux points d'un relevé. Placé
              plus haut, il flottait entre les deux sans rien relier. */}
          <div className="hidden pb-3 sm:block">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-muted/60">
              contre
            </span>
          </div>

          <UrlField
            label="À droite"
            value={competitorUrl}
            onChange={setCompetitorUrl}
            placeholder="https://shine.fr"
            align="right"
          />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
          <Button type="submit" loading={loading} size="lg">
            {loading ? "Relevé en cours" : "Lancer le relevé"}
          </Button>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground-muted/70">
            30 à 90 s · crédits réels
          </span>
        </div>
      </form>

      {loading && <Working />}

      {error && (
        <div className="mt-12 rounded-2xl border border-surface-border bg-surface p-6">
          <Eyebrow>Relevé impossible</Eyebrow>
          <p className="mt-3 leading-relaxed text-foreground">{error}</p>
        </div>
      )}

      {result && <Report result={result} />}
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-muted/70">
      {children}
    </p>
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
        className={`block font-mono text-[11px] uppercase tracking-[0.14em] text-foreground-muted/70 ${
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
        className={`mt-2 w-full border-0 border-b border-surface-border bg-transparent pb-3 font-mono text-lg text-foreground outline-none transition-colors placeholder:text-foreground-muted/40 focus:border-accent-strong ${
          align === "right" ? "sm:text-right" : ""
        }`}
      />
    </label>
  );
}

/**
 * L'attente dit ce qui se passe, parce qu'elle dure. Une minute devant un bouton figé se
 * lit comme une panne ; nommer les étapes rend le délai compréhensible — et pendant un
 * tournage, ça donne quelque chose à filmer.
 */
function Working() {
  const steps = [
    "Lecture des pages publiques",
    "Extraction des grilles tarifaires",
    "Relevé réseaux, connexion, paiement",
    "Application des règles d'écart",
  ];

  return (
    <ol className="mt-14 grid gap-3 border-t border-surface-border pt-8">
      {steps.map((step, index) => (
        <li key={step} className="flex items-baseline gap-4">
          <span className="font-mono text-[11px] text-foreground-muted/50">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="text-foreground-muted">{step}</span>
        </li>
      ))}
    </ol>
  );
}

function Report({ result }: { result: Result }) {
  const gaps = [...result.gaps].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );

  const counts = gaps.reduce<Record<GapPriority, number>>(
    (acc, gap) => ({ ...acc, [gap.priority]: acc[gap.priority] + 1 }),
    { high: 0, medium: 0, low: 0 },
  );

  return (
    <div className="mt-20 grid gap-16">
      <section className="border-t border-surface-border pt-8">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <Eyebrow>Score du site de gauche</Eyebrow>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-7xl font-bold tabular-nums leading-none">
                {result.score}
              </span>
              <span className="font-mono text-lg text-foreground-muted/70">/100</span>
            </p>
          </div>

          {/* La répartition par priorité, plutôt qu'un total : c'est elle qui explique le
              score, et c'est elle qui dit par quoi commencer. */}
          <dl className="flex gap-8">
            {(["high", "medium", "low"] as const).map((priority) => (
              <div key={priority}>
                <dt className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2.5 w-1 shrink-0"
                    style={{ backgroundColor: PRIORITY_COLOR[priority] }}
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground-muted/70">
                    {priority === "high" ? "Haute" : priority === "medium" ? "Moyenne" : "Basse"}
                  </span>
                </dt>
                <dd className="mt-1 font-mono text-2xl tabular-nums text-foreground">
                  {counts[priority]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section>
        <Eyebrow>Le face-à-face</Eyebrow>
        <div className="mt-6">
          <FaceOff
            own={result.own.data}
            competitor={result.competitor.data}
            competitorLabel={result.competitor.label}
            ownMethods={methodsOf(result.own.data)}
            competitorMethods={methodsOf(result.competitor.data)}
          />
        </div>
      </section>

      {result.coverage && (
        <section className="rounded-2xl border border-surface-border bg-surface p-6">
          <Eyebrow>Ce qui n&apos;a pas pu être mesuré</Eyebrow>
          <h2 className="mt-3 font-display text-lg font-semibold">{result.coverage.title}</h2>
          <ul className="mt-3 grid gap-1.5 text-sm leading-relaxed text-foreground-muted">
            {result.coverage.observations.map((observation) => (
              <li key={observation}>{observation}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
            {result.coverage.consequence}
          </p>
        </section>
      )}

      <section>
        <Eyebrow>
          {gaps.length === 0
            ? "Aucun écart"
            : `${gaps.length} écart${gaps.length > 1 ? "s" : ""} à traiter`}
        </Eyebrow>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tightish">Les tâches</h2>

        {gaps.length === 0 ? (
          <p className="mt-6 max-w-xl leading-relaxed text-foreground-muted">
            Aucune règle ne s&apos;est déclenchée sur cette paire. Soit les deux sites sont
            alignés sur ce qu&apos;on sait mesurer, soit il a manqué la matière pour trancher —
            l&apos;encadré ci-dessus le dit quand c&apos;est le cas.
          </p>
        ) : (
          <ul className="mt-6 border-t border-surface-border">
            {gaps.map((gap) => (
              <li
                key={`${gap.category}::${gap.title}`}
                className="border-b border-surface-border py-6"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={gap.priority} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground-muted/70">
                    {CATEGORY_LABEL[gap.category]}
                  </span>
                </div>
                <h3 className="mt-3 text-[15px] font-medium leading-snug text-foreground">
                  {gap.title}
                </h3>
                <GapDescription text={gap.description} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Ce que <FaceOff> attend : chaque relevé, ou null quand il n'a pas pu être fait. */
function methodsOf(data: StoredExtractedData) {
  return {
    auth: readAuthMethods(data),
    payment: readPaymentMethods(data),
    paymentProviders: readPaymentProviders(data),
  };
}
