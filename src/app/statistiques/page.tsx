import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/tasks/empty-state";
import { GapStats } from "@/components/dashboard/gap-stats";
import { ScoreChart } from "@/components/dashboard/score-chart";

/**
 * Vue agrégée sur tout l'historique d'écarts de l'utilisateur.
 *
 * Tout ce qui est affiché ici est compté à partir de lignes réellement présentes en base —
 * aucune projection, aucune estimation, aucun chiffre issu d'une source externe. Le suivi
 * du score dans le temps vient de score_history, alimenté à chaque recalcul.
 */
export default async function StatistiquesPage() {
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

  const [allGapsRes, scoreRes] = await Promise.all([
    supabase.from("detected_gaps").select("category, status, resolved_at"),
    supabase.from("score_history").select("*").order("recorded_at", { ascending: true }),
  ]);

  return (
    <AppShell userLabel={userLabel}>
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        <header className="mb-10 border-b border-surface-border pb-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-muted/70">
            Statistiques
          </p>
          <h1 className="font-display mt-2 text-2xl sm:text-[28px]">Le terrain regagné</h1>
          <p className="mt-2 max-w-xl text-sm text-foreground-muted">
            L&rsquo;historique complet de tes écarts détectés, comblés et ignorés.
          </p>
        </header>

        <section className="mb-8 border border-surface-border bg-surface">
          <div className="border-b border-surface-border px-5 py-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
              Vue d&rsquo;ensemble
            </h2>
          </div>
          <div className="px-5 py-5">
            {allGapsRes.error ? (
              <EmptyState
                title="Impossible de charger les statistiques"
                description={allGapsRes.error.message}
              />
            ) : (
              <GapStats allGaps={allGapsRes.data ?? []} />
            )}
          </div>
        </section>

        <section className="border border-surface-border bg-surface px-5 py-4">
          <h2 className="font-mono mb-4 text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
            Évolution du score
          </h2>
          {scoreRes.error ? (
            <EmptyState
              title="Impossible de charger l'historique du score"
              description={scoreRes.error.message}
            />
          ) : (
            <ScoreChart points={scoreRes.data ?? []} />
          )}
        </section>
      </div>
    </AppShell>
  );
}
