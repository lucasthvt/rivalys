import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sortGapsByPriority } from "@/components/tasks/priority";
import { GapListItem } from "@/components/tasks/gap-list-item";
import { EmptyState } from "@/components/tasks/empty-state";
import { NoCompetitorState } from "@/components/competitor/no-competitor-state";
import { AppShell } from "@/components/layout/AppShell";

export default async function TasksPage() {
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

  const [gapsRes, competitorRes] = await Promise.all([
    supabase
      .from("detected_gaps")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase
      .from("competitors")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const error = gapsRes.error;
  const gaps = sortGapsByPriority(gapsRes.data ?? []);
  const highCount = gaps.filter((g) => g.priority === "high").length;

  // Distinguish "no competitor tracked" from "the query failed": an empty list
  // caused by a read error must never be presented as a completed analysis.
  const noCompetitor = !competitorRes.data && !competitorRes.error;

  return (
    <AppShell userLabel={userLabel}>
      <div className="app-ambient relative mx-auto max-w-3xl px-6 py-16 sm:px-8">
        <header className="mb-10 border-b border-surface-border pb-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-muted/70">
            Tâches
          </p>
          <h1 className="font-display mt-2 text-2xl sm:text-[28px]">
            Écarts à combler
          </h1>
          <p className="mt-2 text-sm text-foreground-muted">
            {noCompetitor
              ? "Aucun concurrent suivi pour l'instant."
              : gaps.length === 0
                ? "Aucun écart ouvert pour l'instant."
                : `${gaps.length} écart${gaps.length > 1 ? "s" : ""} ouvert${
                    gaps.length > 1 ? "s" : ""
                  }${highCount > 0 ? ` · ${highCount} en priorité haute` : ""}.`}
          </p>
        </header>

        {error ? (
          <EmptyState
            title="Impossible de charger les tâches"
            description={error.message}
          />
        ) : noCompetitor ? (
          <NoCompetitorState description="Les tâches sont générées à partir des écarts détectés face à un concurrent. Sans concurrent suivi, il n'y a rien à comparer — et on n'invente pas de conseils génériques." />
        ) : gaps.length === 0 ? (
          <EmptyState
            title="Aucun écart détecté pour l'instant"
            description="Dès qu'une différence factuelle avec ton concurrent est détectée, elle apparaît ici sous forme de tâche concrète."
          />
        ) : (
          <ul>
            {gaps.map((gap) => (
              <GapListItem key={gap.id} gap={gap} />
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
