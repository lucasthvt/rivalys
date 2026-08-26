import { EmptyState } from "@/components/tasks/empty-state";
import type { ExtractedSiteData } from "@/lib/supabase/database.types";

function formatTiers(data: ExtractedSiteData | null): string {
  if (!data) return "Pas encore de données";
  if (data.pricing_tiers.length === 0) return "Aucun palier détecté";
  return data.pricing_tiers.map((t) => `${t.name} (${t.price})`).join(" · ");
}

// Colors a boolean cell honestly: green when it's an advantage, flare-orange
// only when it reflects a real, currently-open gap (competitor has it, you
// don't) — the same rule the comparator uses to generate a task. Never
// decorative, always tied to the actual comparison.
function BoolCell({
  data,
  field,
  isDisadvantage,
}: {
  data: ExtractedSiteData | null;
  field: "has_free_trial" | "has_free_tier";
  isDisadvantage: boolean;
}) {
  if (!data) {
    return <span className="text-foreground-muted/70">Pas encore de données</span>;
  }
  const value = data[field];
  return (
    <span
      className={
        isDisadvantage
          ? "font-medium text-flare"
          : value
            ? "text-mint"
            : "text-foreground"
      }
    >
      {value ? "Oui" : "Non"}
    </span>
  );
}

export function ComparisonTable({
  own,
  competitor,
  competitorLabel,
  loadError = false,
}: {
  own: ExtractedSiteData | null;
  competitor: ExtractedSiteData | null;
  competitorLabel: string;
  /** True when a snapshot query failed — distinguishes a real fetch error from "no data yet". */
  loadError?: boolean;
}) {
  const noData = !own && !competitor;

  return (
    <div className="border border-surface-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
          Toi vs {competitorLabel}
        </h2>
        {loadError && (
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-flare">
            Erreur de chargement
          </span>
        )}
      </div>

      {noData ? (
        <div className="px-5 py-6">
          <EmptyState
            title={loadError ? "Impossible de charger les données" : "Pas encore de données"}
            description={
              loadError
                ? "Une erreur est survenue pendant la récupération des relevés. Réessaie dans un instant."
                : `Lance une première analyse pour comparer ton offre à celle de ${competitorLabel}.`
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="font-mono border-b border-surface-border text-left text-[11px] uppercase tracking-[0.12em] text-foreground-muted/70">
                <th className="px-5 py-3 font-medium">Critère</th>
                <th className="px-5 py-3 font-medium">Toi</th>
                <th className="px-5 py-3 font-medium">{competitorLabel}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-surface-border align-top">
                <td className="px-5 py-4 text-foreground-muted">Paliers de pricing</td>
                <td className="px-5 py-4 text-foreground">{formatTiers(own)}</td>
                <td className="px-5 py-4 text-foreground">{formatTiers(competitor)}</td>
              </tr>
              <tr className="border-b border-surface-border">
                <td className="px-5 py-4 text-foreground-muted">Essai gratuit</td>
                <td className="px-5 py-4">
                  <BoolCell
                    data={own}
                    field="has_free_trial"
                    isDisadvantage={Boolean(
                      own && competitor && competitor.has_free_trial && !own.has_free_trial,
                    )}
                  />
                </td>
                <td className="px-5 py-4">
                  <BoolCell data={competitor} field="has_free_trial" isDisadvantage={false} />
                </td>
              </tr>
              <tr>
                <td className="px-5 py-4 text-foreground-muted">Palier gratuit</td>
                <td className="px-5 py-4">
                  <BoolCell
                    data={own}
                    field="has_free_tier"
                    isDisadvantage={Boolean(
                      own && competitor && competitor.has_free_tier && !own.has_free_tier,
                    )}
                  />
                </td>
                <td className="px-5 py-4">
                  <BoolCell data={competitor} field="has_free_tier" isDisadvantage={false} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
