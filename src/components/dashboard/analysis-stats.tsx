import { PRIORITY_LABEL } from "@/components/tasks/priority";
import type { GapPriority, GapStatus } from "@/lib/supabase/database.types";

export type StatGap = {
  status: GapStatus;
  priority: GapPriority;
  created_at: string;
  resolved_at: string | null;
};

export type StatScorePoint = { score: number; recorded_at: string };

const PRIORITY_ORDER: GapPriority[] = ["high", "medium", "low"];

function Tile({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
      {/* truncate : une valeur inattendue doit être coupée, jamais déborder de la carte. */}
      <p className="font-mono truncate text-[22px] leading-tight text-foreground" title={value}>
        {value}
      </p>
      <p className="mt-1 text-xs text-foreground-muted">{label}</p>
      {hint && <p className="mt-1 text-[11px] text-foreground-muted/60">{hint}</p>}
    </div>
  );
}

/** Médiane, pas moyenne : un seul écart oublié six mois tirerait la moyenne à lui seul. */
function medianDays(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * Un délai lisible, jamais un flottant brut.
 *
 * Un écart fermé dans l'heure vaut 0,049 jour : arrondi au jour il devient
 * « 0 j », ce qui se lit comme une absence de mesure. En dessous d'une journée
 * on bascule donc sur les heures, et sur les minutes en dessous d'une heure.
 */
function formatDelay(days: number): string {
  if (days >= 1) return `${Math.round(days)} j`;

  const hours = days * 24;
  if (hours >= 1) return `${Math.round(hours)} h`;

  const minutes = Math.round(hours * 60);
  return `${Math.max(minutes, 1)} min`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/**
 * Le rythme de travail, par opposition au bilan des écarts (voir GapStats).
 *
 * Chaque chiffre vient de lignes réellement présentes en base. Ce qui n'est pas
 * mesurable est dit « — » plutôt qu'estimé : un délai de résolution ne se calcule
 * que sur des écarts qui portent une date de fermeture, et le nombre exclu est
 * annoncé, faute de quoi la médiane passerait pour un chiffre complet.
 */
export function AnalysisStats({
  gaps,
  scorePoints,
}: {
  gaps: StatGap[];
  scorePoints: StatScorePoint[];
}) {
  const runs = scorePoints.length;
  const lastRun = scorePoints.at(-1);
  const bestScore = runs > 0 ? Math.max(...scorePoints.map((p) => p.score)) : null;

  const resolutionDays = gaps
    .filter((gap) => gap.status !== "open" && gap.resolved_at !== null)
    .map((gap) => {
      const opened = new Date(gap.created_at).getTime();
      const closed = new Date(gap.resolved_at!).getTime();
      return (closed - opened) / (1000 * 60 * 60 * 24);
    })
    .filter((days) => Number.isFinite(days) && days >= 0);

  const median = medianDays(resolutionDays);
  const closedWithoutDate = gaps.filter(
    (gap) => gap.status !== "open" && gap.resolved_at === null,
  ).length;

  const open = gaps.filter((gap) => gap.status === "open");
  const done = gaps.filter((gap) => gap.status === "done").length;
  const dismissed = gaps.filter((gap) => gap.status === "dismissed").length;
  const total = gaps.length;

  const openByPriority = PRIORITY_ORDER.map((priority) => ({
    priority,
    count: open.filter((gap) => gap.priority === priority).length,
  }));
  const worstOpen = Math.max(...openByPriority.map((row) => row.count), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          value={String(runs)}
          label={`Analyse${runs > 1 ? "s" : ""} lancée${runs > 1 ? "s" : ""}`}
        />
        <Tile
          value={lastRun ? formatDate(lastRun.recorded_at) : "—"}
          label="Dernière analyse"
        />
        <Tile value={bestScore === null ? "—" : String(bestScore)} label="Meilleur score atteint" />
        <Tile
          value={median === null ? "—" : formatDelay(median)}
          label="Délai médian de fermeture"
          hint={
            median === null
              ? "Aucun écart fermé avec une date"
              : closedWithoutDate > 0
                ? `${closedWithoutDate} écart${closedWithoutDate > 1 ? "s" : ""} sans date, exclu${closedWithoutDate > 1 ? "s" : ""}`
                : undefined
          }
        />
      </div>

      {total > 0 && (
        <div>
          <p className="font-mono mb-3 text-[11px] uppercase tracking-[0.14em] text-foreground-muted/70">
            Ce que tu en as fait
          </p>
          {/*
            Une seule barre pour les trois issues : elles se partagent le même
            total, donc les empiler dit d'un coup ce que trois compteurs séparés
            obligeaient à recalculer de tête.
          */}
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-void">
            <span
              className="block h-full bg-gradient-to-r from-signal to-signal-bright"
              style={{ width: `${(done / total) * 100}%` }}
            />
            <span
              className="block h-full bg-signal-bright/25"
              style={{ width: `${(dismissed / total) * 100}%` }}
            />
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <li className="text-foreground-muted">
              <span className="font-mono text-foreground">{done}</span> comblé
              {done > 1 ? "s" : ""}
            </li>
            <li className="text-foreground-muted">
              <span className="font-mono text-foreground">{dismissed}</span> ignoré
              {dismissed > 1 ? "s" : ""}
            </li>
            <li className="text-foreground-muted">
              <span className="font-mono text-foreground">{open.length}</span> encore ouvert
              {open.length > 1 ? "s" : ""}
            </li>
          </ul>
        </div>
      )}

      {open.length > 0 && (
        <div>
          <p className="font-mono mb-3 text-[11px] uppercase tracking-[0.14em] text-foreground-muted/70">
            Écarts ouverts par priorité
          </p>
          <ul className="flex flex-col gap-2">
            {openByPriority.map((row) => (
              <li key={row.priority} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-foreground-muted">
                  {PRIORITY_LABEL[row.priority]}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-void">
                  <span
                    className="block h-full rounded-full bg-accent-strong"
                    style={{ width: `${worstOpen === 0 ? 0 : (row.count / worstOpen) * 100}%` }}
                  />
                </span>
                <span className="font-mono w-6 shrink-0 text-right text-xs text-foreground-muted">
                  {row.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
