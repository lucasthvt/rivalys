import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sortGapsByPriority } from "@/components/tasks/priority";
import { TaskQueue } from "@/components/tasks/task-queue";
import { EmptyState } from "@/components/tasks/empty-state";
import { NoCompetitorState } from "@/components/competitor/no-competitor-state";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CompetitorSwitcher } from "@/components/competitor/competitor-switcher";
import { orderCompetitors, resolveSelectedCompetitor } from "@/lib/competitors/selection";
import { LockedResults, SkeletonList } from "@/components/billing/locked-results";
import { hasPaidAccess } from "@/lib/billing/access";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, first_name, subscription_tier")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed !== true) {
    redirect("/onboarding");
  }

  const userLabel = profile?.first_name?.trim() || user.email || "Toi";
  const unlocked = hasPaidAccess(profile?.subscription_tier);

  // La file est celle d'UN face-à-face : un écart appartient au concurrent qui l'a produit,
  // et fermer « pas d'essai gratuit » face à l'un ne le ferme pas face à l'autre. Mélanger
  // les files afficherait deux fois le même intitulé sans dire lequel vise qui.
  const { data: trackedCompetitors, error: competitorsError } = await supabase
    .from("competitors")
    .select("id, name, url, is_primary, created_at")
    .eq("user_id", user.id);

  const competitors = orderCompetitors(trackedCompetitors ?? []);
  const requested = (await searchParams).concurrent;
  const competitor = resolveSelectedCompetitor(
    competitors,
    typeof requested === "string" ? requested : null,
  );

  const gapsRes = competitor
    ? await supabase
        .from("detected_gaps")
        .select("*")
        .eq("competitor_id", competitor.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  const error = gapsRes.error ?? competitorsError;
  const gaps = sortGapsByPriority(gapsRes.data ?? []);
  const highCount = gaps.filter((g) => g.priority === "high").length;

  // Distinguish "no competitor tracked" from "the query failed": an empty list
  // caused by a read error must never be presented as a completed analysis.
  const noCompetitor = competitor === null && !competitorsError;

  return (
    <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
      <div className="relative mx-auto w-full max-w-4xl px-6 py-14 sm:px-8 lg:py-16">
        <PageHeader
          eyebrow="Tâches"
          title="Écarts à combler"
          lede={
            noCompetitor
              ? "Aucun concurrent suivi pour l'instant."
              : gaps.length === 0
                ? "Aucun écart ouvert pour l'instant."
                : `${gaps.length} écart${gaps.length > 1 ? "s" : ""} ouvert${
                    gaps.length > 1 ? "s" : ""
                  }${highCount > 0 ? ` · ${highCount} en priorité haute` : ""}.`
          }
        />

        {competitor && (
          <CompetitorSwitcher
            competitors={competitors.map((tracked) => ({
              id: tracked.id,
              label: tracked.name?.trim() || safeHostname(tracked.url),
            }))}
            selectedId={competitor.id}
            basePath="/tasks"
          />
        )}

        {error ? (
          <EmptyState
            title="Impossible de charger les tâches"
            description={error.message}
          />
        ) : noCompetitor ? (
          // Passe avant le verrou : sans concurrent il n'y a rien à déverrouiller,
          // et l'action qui débloque le produit est d'en ajouter un.
          <NoCompetitorState description="Les tâches sont générées à partir des écarts détectés face à un concurrent. Sans concurrent suivi, il n'y a rien à comparer — et on n'invente pas de conseils génériques." />
        ) : !unlocked ? (
          // Le nombre d'écarts reste annoncé dans l'en-tête ci-dessus : ce qui
          // est réservé, c'est leur contenu, pas le fait qu'ils existent.
          <LockedResults
            title="Tâches réservées aux offres payantes"
            description="Chaque écart détecté devient une action concrète à mener. Le détail des actions s'ouvre avec une offre payante."
          >
            <SkeletonList rows={4} />
          </LockedResults>
        ) : gaps.length === 0 ? (
          <EmptyState
            title="Aucun écart détecté pour l'instant"
            description="Dès qu'une différence factuelle avec ton concurrent est détectée, elle apparaît ici sous forme de tâche concrète."
          />
        ) : (
          <TaskQueue gaps={gaps} />
        )}
      </div>
    </AppShell>
  );
}

/** Mirrors the hostname fallback used on /dashboard and by /api/compare. */
function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
