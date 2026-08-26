import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sortGapsByPriority } from "@/components/tasks/priority";
import { GapListItem } from "@/components/tasks/gap-list-item";
import { EmptyState } from "@/components/tasks/empty-state";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ComparisonTable } from "@/components/dashboard/comparison-table";
import { ScoreChart } from "@/components/dashboard/score-chart";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { parseExtractedData } from "@/components/dashboard/extracted-data";
import { AppShell } from "@/components/layout/AppShell";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, first_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed !== true) {
    redirect("/onboarding");
  }

  const userLabel = profile?.first_name?.trim() || user.email || "Toi";

  const [gapsRes, scoreRes, competitorRes] = await Promise.all([
    supabase
      .from("detected_gaps")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase.from("score_history").select("*").order("recorded_at", { ascending: true }),
    supabase
      .from("competitors")
      .select("*")
      .eq("is_primary", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // The two primary metrics — open gaps and score — drive the whole
  // dashboard. If either failed to load, showing the normal dashboard would
  // silently render "0 écarts ouverts, score —" as if everything were fine,
  // so surface a clear error state instead of a fabricated-looking dashboard.
  if (gapsRes.error || scoreRes.error) {
    return (
      <AppShell userLabel={userLabel}>
        <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8">
          <header className="mb-10 border-b border-surface-border pb-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-muted/70">
              Tableau de bord
            </p>
            <h1 className="font-display mt-2 text-2xl sm:text-[28px]">
              Où tu perds du terrain
            </h1>
          </header>
          <EmptyState
            title="Impossible de charger le tableau de bord"
            description={(gapsRes.error ?? scoreRes.error)?.message}
          />
        </div>
      </AppShell>
    );
  }

  const gaps = sortGapsByPriority(gapsRes.data ?? []);
  const scorePoints = scoreRes.data ?? [];
  const latestScore = scorePoints.at(-1)?.score ?? null;
  const competitor = competitorRes.data;
  const competitorLoadError = Boolean(competitorRes.error);

  // Latest snapshot for each side. The competitor snapshot is scoped to the
  // primary competitor's id so this stays correct once a user can follow
  // more than one competitor.
  const [ownSnapshotRes, competitorSnapshotRes] = await Promise.all([
    supabase
      .from("site_snapshots")
      .select("*")
      .eq("target_type", "own_saas")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    competitor
      ? supabase
          .from("site_snapshots")
          .select("*")
          .eq("target_type", "competitor")
          .eq("competitor_id", competitor.id)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
  ]);

  const snapshotLoadError = Boolean(ownSnapshotRes.error || competitorSnapshotRes.error);
  const ownData = parseExtractedData(ownSnapshotRes.data?.extracted_data);
  const competitorData = parseExtractedData(competitorSnapshotRes.data?.extracted_data);
  const competitorLabel = competitorLoadError
    ? "Erreur de chargement"
    : competitor
      ? competitor.name?.trim() || safeHostname(competitor.url)
      : "ton concurrent";

  const priorityActions = gaps.slice(0, 3);
  const highCount = gaps.filter((g) => g.priority === "high").length;

  return (
    <AppShell userLabel={userLabel}>
      <div className="mx-auto max-w-5xl px-6 py-16 sm:px-8">
        <header className="mb-10 flex flex-col gap-6 border-b border-surface-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-muted/70">
              Tableau de bord
            </p>
            <h1 className="font-display mt-2 text-2xl sm:text-[28px]">
              Où tu perds du terrain
            </h1>
          </div>
          <RefreshButton />
        </header>

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            label="Score global"
            value={latestScore === null ? "—" : String(latestScore)}
            sublabel={latestScore === null ? "Pas encore calculé" : undefined}
          />
          <MetricCard
            label="Écarts ouverts"
            value={String(gaps.length)}
            sublabel={gaps.length > 0 ? `${highCount} en priorité haute` : undefined}
          />
          <MetricCard label="Concurrent suivi" value={competitorLabel} />
        </section>

        <section className="mb-8 border border-surface-border bg-surface">
          <div className="border-b border-surface-border px-5 py-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
              Actions prioritaires
            </h2>
          </div>
          {priorityActions.length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState
                title="Aucune action prioritaire"
                description="Aucun écart ouvert détecté pour l'instant."
              />
            </div>
          ) : (
            <ul className="px-5">
              {priorityActions.map((gap) => (
                <GapListItem key={gap.id} gap={gap} />
              ))}
            </ul>
          )}
        </section>

        <section className="mb-8">
          <ComparisonTable
            own={ownData}
            competitor={competitorData}
            competitorLabel={competitorLabel}
            loadError={snapshotLoadError}
          />
        </section>

        <section className="border border-surface-border bg-surface px-5 py-4">
          <h2 className="font-mono mb-4 text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
            Évolution du score
          </h2>
          <ScoreChart points={scorePoints} />
        </section>
      </div>
    </AppShell>
  );
}

// Mirrors the fallback used by /api/compare (route.ts) so the competitor's
// display name is consistent everywhere: a clean hostname (e.g. "acme.com")
// rather than a raw URL, when no name was provided.
function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
