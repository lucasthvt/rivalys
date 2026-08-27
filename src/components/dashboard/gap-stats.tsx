import { CATEGORY_LABEL } from "@/components/tasks/priority";
import type { Database } from "@/lib/supabase/database.types";

type DetectedGap = Database["public"]["Tables"]["detected_gaps"]["Row"];
type GapCategory = DetectedGap["category"];

export interface GapStatsInput {
  /** Every gap of this user, all statuses — the stats are about the whole history. */
  allGaps: Pick<DetectedGap, "category" | "status" | "resolved_at">[];
}

const CATEGORY_ORDER: GapCategory[] = ["pricing", "positioning", "reviews", "social_presence"];

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-surface-border bg-surface px-4 py-3">
      <p className="font-mono text-[22px] leading-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-foreground-muted">{label}</p>
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
export function GapStats({ allGaps }: GapStatsInput) {
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

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    total: allGaps.filter((g) => g.category === category).length,
    open: allGaps.filter((g) => g.category === category && g.status === "open").length,
  })).filter((row) => row.total > 0);

  const totalDetected = allGaps.length;

  if (totalDetected === 0) {
    return (
      <div className="border border-dashed border-surface-border px-5 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Pas encore de statistiques</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-foreground-muted">
          Elles apparaîtront dès qu&rsquo;une analyse aura détecté des écarts. Lance
          «&nbsp;Actualiser&nbsp;» pour lancer une comparaison.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile value={String(totalDetected)} label="Écarts détectés au total" />
        <StatTile value={String(open)} label="Encore ouverts" />
        <StatTile value={String(done)} label="Comblés" />
        <StatTile value={String(dismissed)} label="Ignorés" />
      </div>

      <p className="mt-4 text-sm text-foreground-muted">
        {closedThisMonth > 0
          ? `${closedThisMonth} écart${closedThisMonth > 1 ? "s" : ""} fermé${
              closedThisMonth > 1 ? "s" : ""
            } sur les 30 derniers jours.`
          : "Aucun écart fermé sur les 30 derniers jours."}
        {closedWithoutDate > 0 && (
          <>
            {" "}
            <span className="text-foreground-muted/70">
              ({closedWithoutDate} écart{closedWithoutDate > 1 ? "s" : ""} fermé
              {closedWithoutDate > 1 ? "s" : ""} avant le suivi des dates, non compté
              {closedWithoutDate > 1 ? "s" : ""} ici.)
            </span>
          </>
        )}
      </p>

      {byCategory.length > 0 && (
        <div className="mt-6">
          <p className="font-mono mb-3 text-[11px] uppercase tracking-[0.14em] text-foreground-muted/70">
            Par catégorie
          </p>
          <ul className="flex flex-col gap-2">
            {byCategory.map((row) => {
              const percent = Math.round((row.total / totalDetected) * 100);
              return (
                <li key={row.category} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-foreground-muted">
                    {CATEGORY_LABEL[row.category]}
                  </span>
                  <span
                    className="h-1.5 min-w-[2px] rounded-full bg-accent-strong"
                    style={{ width: `${percent}%` }}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-xs text-foreground-muted">
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
