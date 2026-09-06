"use client";

import { useState } from "react";
import { CATEGORY_LABEL } from "@/components/tasks/priority";
import type { Database } from "@/lib/supabase/database.types";

type DetectedGap = Database["public"]["Tables"]["detected_gaps"]["Row"];
type GapCategory = DetectedGap["category"];

export interface GapStatsInput {
  /** Every gap of this user, all statuses — the stats are about the whole history. */
  allGaps: Pick<DetectedGap, "category" | "status" | "resolved_at">[];
}

const CATEGORY_ORDER: GapCategory[] = [
  "pricing",
  "auth",
  "payment",
  "positioning",
  "reviews",
  "social_presence",
];

/**
 * Une tuile de statistique, devenue un filtre.
 *
 * Les quatre chiffres décrivent chacun une population d'écarts ; la répartition par
 * catégorie juste en dessous décrivait toujours la population entière. On ne pouvait
 * donc pas répondre à « mes écarts comblés, ils venaient d'où ? » — la seule question
 * intéressante de cet écran. Cliquer une tuile restreint la répartition à sa population.
 *
 * `onSelect` absent : la tuile reste un simple affichage, sans affordance trompeuse.
 */
function StatTile({
  value,
  label,
  selected = false,
  onSelect,
}: {
  value: string;
  label: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  if (!onSelect) return <StatTileBody value={value} label={label} />;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`rounded-xl text-left transition-colors ${
        selected ? "ring-1 ring-signal-bright/45" : "hover:ring-1 hover:ring-white/10"
      }`}
    >
      <StatTileBody value={value} label={label} selected={selected} />
    </button>
  );
}

function StatTileBody({ value, label }: { value: string; label: string; selected?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.1] bg-white/[0.02] px-4 py-3.5">
      <p className="font-brand text-[1.75rem] font-bold leading-[1] tracking-[-0.035em] tabular-nums text-paper">
        {value}
      </p>
      <p className="mt-2 text-xs text-mist">{label}</p>
    </div>
  );
}

/**
 * Aggregate view over the user's whole gap history.
 *
 * Everything here is counted from rows that exist — nothing is projected or estimated.
 * The "comblés ce mois-ci" figure deliberately counts only gaps carrying a resolved_at:
 * gaps closed before that column was added have no known closure date, and dating them
 * from created_at (or from now) would fabricate a history that never happened.
 */
type StatusFilter = "open" | "done" | "dismissed" | null;

export function GapStats({ allGaps }: GapStatsInput) {
  const [status, setStatus] = useState<StatusFilter>(null);

  const open = allGaps.filter((g) => g.status === "open").length;
  const done = allGaps.filter((g) => g.status === "done").length;
  const dismissed = allGaps.filter((g) => g.status === "dismissed").length;

  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const closedThisMonth = allGaps.filter(
    (g) => g.resolved_at !== null && new Date(g.resolved_at) >= monthAgo,
  ).length;

  // Gaps closed before resolved_at existed: counted as "done" above, but invisible to any
  // date-based figure. Surfaced explicitly rather than silently skewing the month count.
  const closedWithoutDate = allGaps.filter(
    (g) => g.status !== "open" && g.resolved_at === null,
  ).length;

  // La répartition suit le filtre. Sans ça, cliquer une tuile ne changeait rien à ce
  // qui est affiché en dessous et la tuile ne serait qu'une décoration cliquable.
  const scoped = status === null ? allGaps : allGaps.filter((g) => g.status === status);

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    total: scoped.filter((g) => g.category === category).length,
    open: scoped.filter((g) => g.category === category && g.status === "open").length,
  })).filter((row) => row.total > 0);

  const totalDetected = allGaps.length;
  const scopedTotal = scoped.length;

  const STATUS_LABEL: Record<Exclude<StatusFilter, null>, string> = {
    open: "encore ouverts",
    done: "comblés",
    dismissed: "ignorés",
  };

  if (totalDetected === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-5 py-12 text-center">
        <p className="text-sm font-medium text-paper">Pas encore de statistiques</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-mist">
          Elles apparaîtront dès qu&rsquo;une analyse aura détecté des écarts. Lance
          «&nbsp;Actualiser&nbsp;» pour lancer une comparaison.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          value={String(totalDetected)}
          label="Écarts détectés au total"
          selected={status === null}
          onSelect={() => setStatus(null)}
        />
        <StatTile
          value={String(open)}
          label="Encore ouverts"
          selected={status === "open"}
          onSelect={open > 0 ? () => setStatus(status === "open" ? null : "open") : undefined}
        />
        <StatTile
          value={String(done)}
          label="Comblés"
          selected={status === "done"}
          onSelect={done > 0 ? () => setStatus(status === "done" ? null : "done") : undefined}
        />
        <StatTile
          value={String(dismissed)}
          label="Ignorés"
          selected={status === "dismissed"}
          onSelect={
            dismissed > 0 ? () => setStatus(status === "dismissed" ? null : "dismissed") : undefined
          }
        />
      </div>

      <p className="mt-5 text-sm text-mist">
        {closedThisMonth > 0
          ? `${closedThisMonth} écart${closedThisMonth > 1 ? "s" : ""} fermé${
              closedThisMonth > 1 ? "s" : ""
            } sur les 30 derniers jours.`
          : "Aucun écart fermé sur les 30 derniers jours."}
        {closedWithoutDate > 0 && (
          <>
            {" "}
            <span className="text-mist/70">
              ({closedWithoutDate} écart{closedWithoutDate > 1 ? "s" : ""} fermé
              {closedWithoutDate > 1 ? "s" : ""} avant le suivi des dates, non compté
              {closedWithoutDate > 1 ? "s" : ""} ici.)
            </span>
          </>
        )}
      </p>

      {byCategory.length === 0 && status !== null && (
        <p className="mt-6 text-sm text-mist">
          Aucun écart {STATUS_LABEL[status]} pour l&rsquo;instant.
        </p>
      )}

      {byCategory.length > 0 && (
        <div className="mt-6">
          <p className="font-mono mb-4 text-[0.62rem] uppercase tracking-[0.14em] text-mist/60">
            Par catégorie
            {status !== null && (
              <span className="text-signal-bright"> · {STATUS_LABEL[status]}</span>
            )}
          </p>
          <ul className="flex flex-col gap-2">
            {byCategory.map((row) => {
              // Échelle sur la population affichée : rapporter au total ferait des
              // barres minuscules dès qu'un filtre réduit l'ensemble, alors que la
              // question posée est « comment celle-ci se répartit », pas « quelle part
              // du tout elle représente ».
              const percent = Math.round((row.total / Math.max(scopedTotal, 1)) * 100);
              return (
                <li key={row.category} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-mist">
                    {CATEGORY_LABEL[row.category]}
                  </span>
                  <span
                    className="meter-fill h-1.5 min-w-[2px] rounded-full bg-signal-bright"
                    style={{ width: `${percent}%` }}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-xs tabular-nums text-mist">
                    {row.total} · {row.open} ouvert{row.open > 1 ? "s" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
