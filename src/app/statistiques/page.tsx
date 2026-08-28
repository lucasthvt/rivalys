import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/tasks/empty-state";
import { NoCompetitorState } from "@/components/competitor/no-competitor-state";
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

  const [allGapsRes, scoreRes, competitorRes] = await Promise.all([
    supabase.from("detected_gaps").select("category, status, resolved_at"),
    supabase.from("score_history").select("*").order("recorded_at", { ascending: true }),
    supabase
      .from("competitors")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // score_history ne porte pas de competitor_id : ses points décrivent l'état au moment de
  // chaque analyse, quel que soit le concurrent suivi alors. Si le concurrent courant n'a
  // jamais été analysé (cas typique juste après un changement, qui supprime ses relevés),
  // toute la courbe porte sur le précédent — même règle que sur le tableau de bord.
  const competitorSnapshotRes = competitorRes.data
    ? await supabase
        .from("site_snapshots")
        .select("id")
        .eq("user_id", user.id)
        .eq("target_type", "competitor")
        .eq("competitor_id", competitorRes.data.id)
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };
  const analysedForCurrentCompetitor = competitorSnapshotRes.data !== null;

  // Aucun concurrent suivi : il n'existe aucun historique à agréger. Des
  // compteurs à zéro se liraient comme un bilan, alors qu'aucune analyse n'a
  // jamais tourné.
  if (!competitorRes.data && !competitorRes.error) {
    return (
      <AppShell userLabel={userLabel}>
        <div className="app-ambient relative mx-auto max-w-4xl px-6 py-16 sm:px-8">
          <Header />
          <NoCompetitorState description="L'historique se remplit à chaque analyse. Ajoute un concurrent pour lancer la première." />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell userLabel={userLabel}>
      <div className="app-ambient relative mx-auto max-w-4xl px-6 py-16 sm:px-8">
        <Header />

        <section className="panel mb-5 overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-4">
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

        <section className="panel px-5 py-4">
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
          {!analysedForCurrentCompetitor && (scoreRes.data ?? []).length > 0 && (
            <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-foreground-muted/70">
              Ces relevés portent sur le concurrent suivi précédemment. La courbe repartira à
              la première analyse du concurrent actuel.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Header() {
  return (
    <header className="mb-10 border-b border-surface-border pb-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-muted/70">
        Statistiques
      </p>
      <h1 className="font-display mt-2 text-2xl sm:text-[28px]">Le terrain regagné</h1>
      <p className="mt-2 max-w-xl text-sm text-foreground-muted">
        L&rsquo;historique complet de tes écarts détectés, comblés et ignorés.
      </p>
    </header>
  );
}
