import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sortGapsByPriority } from "@/components/tasks/priority";
import { GapListItem } from "@/components/tasks/gap-list-item";
import { EmptyState } from "@/components/tasks/empty-state";
import { NoCompetitorState } from "@/components/competitor/no-competitor-state";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ScoreMeter } from "@/components/dashboard/score-meter";
import { FaceOff } from "@/components/dashboard/face-off";
import { ScoreChart } from "@/components/dashboard/score-chart";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { GapStats } from "@/components/dashboard/gap-stats";
import { CategoryBars } from "@/components/dashboard/category-bars";
import { parseExtractedData, parseObservationFlags } from "@/components/dashboard/extracted-data";
import { CoverageNoticePanel } from "@/components/dashboard/coverage-notice";
import { AppShell } from "@/components/layout/AppShell";
import {
  LockedResults,
  SkeletonList,
  SkeletonPanel,
} from "@/components/billing/locked-results";
import { assessPricingCoverage } from "@/lib/compare/comparability";
import { countByPriority } from "@/lib/compare/score";
import { hasPaidAccess } from "@/lib/billing/access";

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
    .select("onboarding_completed, first_name, subscription_tier")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed !== true) {
    redirect("/onboarding");
  }

  const userLabel = profile?.first_name?.trim() || user.email || "Toi";
  const unlocked = hasPaidAccess(profile?.subscription_tier);

  const [gapsRes, allGapsRes, scoreRes, competitorRes] = await Promise.all([
    supabase
      .from("detected_gaps")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    // Every status, for the stats section — which is about the whole history, not just
    // what's currently open.
    supabase.from("detected_gaps").select("category, status, resolved_at"),
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
      <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
        <div className="app-ambient relative mx-auto max-w-5xl px-6 py-16 sm:px-8">
          <DashboardHeader />
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
  // Avant-dernier point : le delta montré dans l'anneau compare deux analyses
  // réelles, jamais le score recalculé en direct contre l'historique.
  const previousScore = scorePoints.length >= 2 ? scorePoints.at(-2)!.score : null;
  const competitor = competitorRes.data;
  const competitorLoadError = Boolean(competitorRes.error);

  // Nothing to compare against yet: every panel below would render its own
  // empty shell (score "—", 0 écart, comparatif vide) and read like an
  // analysis that found nothing. Send the user to /concurrent instead — that
  // is the one action that unblocks the whole product.
  if (!competitor && !competitorLoadError) {
    return (
      <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
        <div className="app-ambient relative mx-auto max-w-5xl px-6 py-16 sm:px-8">
          <DashboardHeader />
          <NoCompetitorState description="Le comparateur a besoin d'un second site pour trouver le moindre écart. Ajoute le concurrent que tu veux suivre, puis lance une première analyse." />
        </div>
      </AppShell>
    );
  }

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
  const ownFlags = parseObservationFlags(ownSnapshotRes.data?.extracted_data);
  const competitorFlags = parseObservationFlags(competitorSnapshotRes.data?.extracted_data);
  const competitorLabel = competitorLoadError
    ? "Erreur de chargement"
    : competitor
      ? competitor.name?.trim() || safeHostname(competitor.url)
      : "ton concurrent";

  const priorityActions = gaps.slice(0, 3);
  const highCount = gaps.filter((g) => g.priority === "high").length;

  // Palier gratuit : l'analyse a tourné, ses résultats restent fermés. Seuls
  // les agrégats sans contenu sortent d'ici (analyse effectuée, date, nombre
  // d'écarts) ; ni les écarts eux-mêmes, ni le comparatif, ni le score ne sont
  // envoyés au navigateur — voir components/billing/locked-results.tsx.
  if (!unlocked) {
    const analysedAt = competitorSnapshotRes.data?.fetched_at ?? null;

    return (
      <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
        <div className="app-ambient relative mx-auto max-w-5xl px-6 py-16 sm:px-8">
          <DashboardHeader />

          <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <MetricCard
              label="Analyse"
              value={analysedAt ? "Terminée" : "Pas encore lancée"}
              sublabel={analysedAt ? formatAnalysisDate(analysedAt) : "Lance-la pour comparer"}
            />
            <MetricCard
              label="Écarts détectés"
              value={analysedAt ? String(gaps.length) : "—"}
              sublabel={analysedAt ? "Détail réservé aux offres payantes" : undefined}
            />
            <MetricCard
              label="Concurrent suivi"
              value={competitorLabel}
              href="/concurrent"
              linkLabel="Changer"
            />
          </div>

          <LockedResults
            description={
              analysedAt
                ? `L'analyse face à ${competitorLabel} est terminée et ${gaps.length} écart${
                    gaps.length > 1 ? "s ont" : " a"
                  } été détecté${gaps.length > 1 ? "s" : ""}. Le détail — score, comparatif des tarifs et actions à mener — s'ouvre avec une offre payante.`
                : "Le détail des résultats — score, comparatif des tarifs et actions à mener — s'ouvre avec une offre payante."
            }
          >
            <div className="flex flex-col gap-5">
              <SkeletonPanel height="h-40" />
              <div className="panel px-5 py-5">
                <SkeletonList rows={3} />
              </div>
              <SkeletonPanel height="h-52" />
            </div>
          </LockedResults>
        </div>
      </AppShell>
    );
  }

  // Un score n'existe que si le concurrent actuellement suivi a été analysé. Changer de
  // concurrent supprime ses relevés (voir app/concurrent/actions.ts), donc cette valeur
  // repasse à false et le score redevient « — » plutôt que d'afficher 100 : zéro écart
  // ouvert signifie alors « rien n'a été mesuré », pas « rien à rattraper ».
  // score_history ne peut pas servir de signal ici — ses points peuvent décrire un
  // concurrent précédent.
  const analysedForCurrentCompetitor = competitorSnapshotRes.data !== null;

  // Ce que le comparateur n'a pas pu mesurer, faute de tarifs publics d'un côté ou de
  // l'autre. Conditionné aux deux relevés : avant une analyse, l'absence de tarifs ne dit
  // rien du site, seulement qu'on ne l'a pas encore lu — et l'écran affiche déjà « — »
  // partout, donc il n'y a rien à qualifier.
  //
  // Recalculé ici plutôt que lu depuis la réponse de /api/compare : le constat doit rester
  // affiché au rechargement de la page, longtemps après l'analyse qui l'a produit.
  const coverageNotice =
    analysedForCurrentCompetitor && ownData && competitorData
      ? assessPricingCoverage(
          { pageFound: ownFlags.pricingPageFound, tierCount: ownData.pricing_tiers.length },
          {
            pageFound: competitorFlags.pricingPageFound,
            tierCount: competitorData.pricing_tiers.length,
          },
          competitorLabel,
        )
      : null;

  return (
    <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
      <div className="app-ambient relative mx-auto max-w-5xl px-6 py-16 sm:px-8">
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

        {coverageNotice && <CoverageNoticePanel notice={coverageNotice} />}

        {/*
          Grille asymétrique plutôt qu'une pile de blocs pleine largeur : le score occupe
          deux colonnes et porte seul la lueur, les deux faits de contexte s'empilent à côté.
          C'est la composition, pas la matière, qui établit la hiérarchie.
        */}
        <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ScoreMeter
              counts={countByPriority(gaps)}
              analysed={analysedForCurrentCompetitor}
              scoreFromHistory={latestScore}
              previousScoreFromHistory={previousScore}
            />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <MetricCard
              label="Écarts ouverts"
              value={String(gaps.length)}
              sublabel={gaps.length > 0 ? `${highCount} en priorité haute` : "Rien à rattraper"}
              href="/tasks"
              linkLabel="Voir les tâches"
            />
            <MetricCard
              label="Concurrent suivi"
              value={competitorLabel}
              href="/concurrent"
              linkLabel="Changer"
            />
          </div>
        </div>

        <section className="panel mb-5 overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
              Où le terrain se perd
            </h2>
          </div>
          <div className="px-5 py-5">
            <CategoryBars gaps={gaps} analysed={analysedForCurrentCompetitor} />
          </div>
        </section>

        <section className="panel mb-5 overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
              À faire maintenant
            </h2>
          </div>
          {priorityActions.length === 0 ? (
            <div className="px-5 py-10">
              <EmptyState
                title="Rien à traiter"
                description="Aucun écart ouvert. La prochaine analyse en détectera peut-être."
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
          <FaceOff
            own={ownData}
            competitor={competitorData}
            competitorLabel={competitorLabel}
            loadError={snapshotLoadError}
          />
        </section>

        <section className="panel mb-5 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
              Statistiques
            </h2>
            <Link
              href="/statistiques"
              className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent-strong transition-colors hover:text-foreground"
            >
              Tout voir →
            </Link>
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
          <ScoreChart points={scorePoints} />
          {/*
            score_history ne porte pas de competitor_id : ses points décrivent l'état au
            moment de chaque analyse, quel que soit le concurrent suivi alors. Quand le
            concurrent actuel n'a encore jamais été analysé, la courbe affichée porte donc
            entièrement sur le précédent. On le dit, plutôt que de laisser lire une
            continuité qui n'existe pas.
          */}
          {!analysedForCurrentCompetitor && scorePoints.length > 0 && (
            <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-foreground-muted/70">
              Ces relevés portent sur le concurrent suivi précédemment. La courbe repartira à
              la première analyse de {competitorLabel}.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function DashboardHeader() {
  return (
    <header className="mb-10 border-b border-surface-border pb-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-muted/70">
        Tableau de bord
      </p>
      <h1 className="font-display mt-2 text-2xl sm:text-[28px]">Où tu perds du terrain</h1>
    </header>
  );
}

/** "Analysé le 28 août 2026" — la seule information de date montrée au palier gratuit. */
function formatAnalysisDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return `Analysé le ${date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
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
