import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { CompetitorSwitcher } from "@/components/competitor/competitor-switcher";
import { orderCompetitors, resolveSelectedCompetitor } from "@/lib/competitors/selection";
import { PanelHeader } from "@/components/layout/Panel";
import { LockedResults, SkeletonPanel } from "@/components/billing/locked-results";
import { hasPaidAccess } from "@/lib/billing/access";
import { EmptyState } from "@/components/tasks/empty-state";
import { NoCompetitorState } from "@/components/competitor/no-competitor-state";
import { GapStats } from "@/components/dashboard/gap-stats";
import { ScoreChart } from "@/components/dashboard/score-chart";
import { AnalysisStats } from "@/components/dashboard/analysis-stats";

/**
 * Vue agrégée sur tout l'historique d'écarts de l'utilisateur.
 *
 * Tout ce qui est affiché ici est compté à partir de lignes réellement présentes en base —
 * aucune projection, aucune estimation, aucun chiffre issu d'une source externe. Le suivi
 * du score dans le temps vient de score_history, alimenté à chaque recalcul.
 */
export default async function StatistiquesPage({
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

  // Le bilan porte sur UN face-à-face, comme les autres écrans de résultat. Additionner
  // trois comparaisons donnerait un « total d'écarts » que rien sur la page ne permet de
  // rattacher à un concurrent — et qui grossirait en achetant une place.
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

  const [allGapsRes, scoreRes] = competitor
    ? await Promise.all([
        supabase
          .from("detected_gaps")
          .select("category, status, priority, created_at, resolved_at")
          .eq("competitor_id", competitor.id),
        supabase
          .from("score_history")
          .select("*")
          .eq("competitor_id", competitor.id)
          .order("recorded_at", { ascending: true }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];

  // Les points de score portent désormais leur competitor_id (migration 20260906000000),
  // donc la courbe ne mélange plus deux concurrents. Reste le cas d'un concurrent tout
  // juste ajouté ou remplacé : ses relevés ont été supprimés, la courbe affichée est vide
  // et on le dit plutôt que de laisser lire une absence de progrès.
  const competitorSnapshotRes = competitor
    ? await supabase
        .from("site_snapshots")
        .select("id")
        .eq("user_id", user.id)
        .eq("target_type", "competitor")
        .eq("competitor_id", competitor.id)
        .limit(1)
        .maybeSingle()
    : { data: null, error: null };
  const analysedForCurrentCompetitor = competitorSnapshotRes.data !== null;

  // Aucun concurrent suivi : il n'existe aucun historique à agréger. Des
  // compteurs à zéro se liraient comme un bilan, alors qu'aucune analyse n'a
  // jamais tourné.
  if (!competitor && !competitorsError) {
    return (
      <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
        <div className="relative mx-auto w-full max-w-4xl px-6 py-14 sm:px-8 lg:py-16">
          <PageHeader
            eyebrow="Statistiques"
            title="Le terrain regagné"
            lede="L'historique complet de tes écarts détectés, comblés et ignorés."
          />
          <NoCompetitorState description="L'historique se remplit à chaque analyse. Ajoute un concurrent pour lancer la première." />
        </div>
      </AppShell>
    );
  }

  // Palier gratuit : les agrégats restent fermés au même titre que le reste des
  // résultats d'analyse. Aucun compteur réel n'est rendu ci-dessous.
  if (!hasPaidAccess(profile?.subscription_tier)) {
    return (
      <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
        <div className="relative mx-auto w-full max-w-4xl px-6 py-14 sm:px-8 lg:py-16">
          <PageHeader
            eyebrow="Statistiques"
            title="Le terrain regagné"
            lede="L'historique complet de tes écarts détectés, comblés et ignorés."
          />
          <LockedResults
            title="Statistiques réservées aux offres payantes"
            description="Le bilan de tes écarts et l'évolution de ton score dans le temps s'ouvrent avec une offre payante."
          >
            <div className="flex flex-col gap-5">
              <SkeletonPanel height="h-44" />
              <SkeletonPanel height="h-56" />
            </div>
          </LockedResults>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
      <div className="relative mx-auto w-full max-w-4xl px-6 py-14 sm:px-8 lg:py-16">
        <PageHeader
            eyebrow="Statistiques"
            title="Le terrain regagné"
            lede="L'historique complet de tes écarts détectés, comblés et ignorés, face au concurrent affiché."
          />

        {competitor && (
          <CompetitorSwitcher
            competitors={competitors.map((tracked) => ({
              id: tracked.id,
              label: tracked.name?.trim() || safeHostname(tracked.url),
            }))}
            selectedId={competitor.id}
            basePath="/statistiques"
          />
        )}

        {/* Point focal : la vue d'ensemble commande les détails qui suivent. */}
        <section className="panel-focal mb-6 overflow-hidden">
          <PanelHeader title="Vue d'ensemble" />
          <div className="px-6 py-6">
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

        <section className="panel mb-6 overflow-hidden">
          <PanelHeader title="Ton rythme" />
          <div className="px-6 py-6">
            {allGapsRes.error || scoreRes.error ? (
              <EmptyState
                title="Impossible de charger ces chiffres"
                description={(allGapsRes.error ?? scoreRes.error)?.message}
              />
            ) : (
              <AnalysisStats
                gaps={allGapsRes.data ?? []}
                scorePoints={scoreRes.data ?? []}
              />
            )}
          </div>
        </section>

        <section className="panel overflow-hidden">
          <PanelHeader title="Évolution du score" />
          <div className="px-6 py-6">
          {scoreRes.error ? (
            <EmptyState
              title="Impossible de charger l'historique du score"
              description={scoreRes.error.message}
            />
          ) : (
            <ScoreChart points={scoreRes.data ?? []} />
          )}
          {!analysedForCurrentCompetitor && (scoreRes.data ?? []).length > 0 && (
            <p className="mt-4 border-t border-white/[0.08] pt-4 text-xs leading-relaxed text-mist/70">
              Ces relevés portent sur le concurrent suivi précédemment. La courbe repartira à
              la première analyse du concurrent actuel.
            </p>
          )}
          </div>
        </section>
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
