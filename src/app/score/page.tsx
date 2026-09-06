import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { PanelHeader } from "@/components/layout/Panel";
import { LockedResults, SkeletonPanel } from "@/components/billing/locked-results";
import { hasPaidAccess } from "@/lib/billing/access";
import { EmptyState } from "@/components/tasks/empty-state";
import { NoCompetitorState } from "@/components/competitor/no-competitor-state";
import { ScoreExplorer } from "./_components/ScoreExplorer";
import { CATEGORY_LABEL, sortGapsByPriority } from "@/components/tasks/priority";
import { parseExtractedData, parseObservationFlags } from "@/components/dashboard/extracted-data";
import { MAX_SCORE } from "@/lib/compare/score";
import { detectAllAdvantages } from "@/lib/compare/advantages";

/**
 * "Pourquoi ce score" — the full derivation of the number shown on the dashboard.
 *
 * Two deliberate design constraints:
 *  - The score is recomputed here from the same pure function the pipeline uses
 *    (explainScore wraps computeScore), so the explanation can never drift from the
 *    figure stored in score_history.
 *  - There is no competitor score, and this page does not invent one. The competitor is
 *    never rated; the right-hand column lists factual advantages derived from the same
 *    public data by the mirror of the gap rules (see lib/compare/advantages.ts).
 */
export default async function ScorePage() {
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

  const [gapsRes, competitorRes] = await Promise.all([
    supabase
      .from("detected_gaps")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    supabase
      .from("competitors")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (gapsRes.error) {
    return (
      <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
        <div className="relative mx-auto w-full max-w-4xl px-6 py-14 sm:px-8 lg:py-16">
          <PageHeader
            eyebrow="Score"
            title="Pourquoi ce score"
            lede="Le calcul complet, sans boîte noire."
            back={{ href: "/dashboard", label: "Tableau de bord" }}
          />
          <EmptyState
            title="Impossible de calculer le détail du score"
            description={gapsRes.error.message}
          />
        </div>
      </AppShell>
    );
  }

  // Sans concurrent suivi, aucun écart n'a pu être détecté : le score partirait
  // de 100 et se lirait comme « rien à rattraper », alors qu'aucune comparaison
  // n'a eu lieu. On le dit au lieu de l'afficher.
  if (!competitorRes.data && !competitorRes.error) {
    return (
      <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
        <div className="relative mx-auto w-full max-w-4xl px-6 py-14 sm:px-8 lg:py-16">
          <PageHeader
            eyebrow="Score"
            title="Pourquoi ce score"
            lede="Le calcul complet, sans boîte noire."
            back={{ href: "/dashboard", label: "Tableau de bord" }}
          />
          <NoCompetitorState description="Le score mesure ce qu'il te reste à rattraper face à un concurrent. Tant qu'aucun n'est suivi, il n'y a rien à calculer." />
        </div>
      </AppShell>
    );
  }

  // Palier gratuit : le détail du score est ce que l'offre payante ouvre. Les
  // écarts eux-mêmes ne sont pas rendus ici — voir components/billing.
  if (!hasPaidAccess(profile?.subscription_tier)) {
    return (
      <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
        <div className="relative mx-auto w-full max-w-4xl px-6 py-14 sm:px-8 lg:py-16">
          <PageHeader
            eyebrow="Score"
            title="Pourquoi ce score"
            lede="Le calcul complet, sans boîte noire."
            back={{ href: "/dashboard", label: "Tableau de bord" }}
          />
          <LockedResults
            title="Détail du score réservé aux offres payantes"
            description="Le calcul complet — chaque écart, son poids, et ce que le concurrent fait mieux — s'ouvre avec une offre payante."
          >
            <div className="flex flex-col gap-5">
              <SkeletonPanel height="h-40" />
              <SkeletonPanel height="h-56" />
            </div>
          </LockedResults>
        </div>
      </AppShell>
    );
  }

  const gaps = sortGapsByPriority(gapsRes.data ?? []);
  const competitor = competitorRes.data;
  const competitorLabel = competitor
    ? competitor.name?.trim() || safeHostname(competitor.url)
    : "ton concurrent";

  const [ownSnapshotRes, competitorSnapshotRes] = await Promise.all([
    supabase
      .from("site_snapshots")
      .select("extracted_data")
      .eq("user_id", user.id)
      .eq("target_type", "own_saas")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    competitor
      ? supabase
          .from("site_snapshots")
          .select("extracted_data")
          .eq("user_id", user.id)
          .eq("target_type", "competitor")
          .eq("competitor_id", competitor.id)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
  ]);

  const ownData = parseExtractedData(ownSnapshotRes.data?.extracted_data);
  const competitorData = parseExtractedData(competitorSnapshotRes.data?.extracted_data);
  const ownFlags = parseObservationFlags(ownSnapshotRes.data?.extracted_data);
  const competitorFlags = parseObservationFlags(competitorSnapshotRes.data?.extracted_data);

  // Même règle que le tableau de bord (voir dashboard/page.tsx) : un score n'existe que si
  // le concurrent actuellement suivi a été analysé. Sans ce garde-fou, la page afficherait
  // 100 sur zéro écart après un changement de concurrent — un sans-faute qui n'a jamais été
  // constaté. Les deux écrans recalculent depuis les mêmes écarts ouverts et appliquent la
  // même condition d'existence : ils ne peuvent donc pas diverger.
  const analysedForCurrentCompetitor = competitorSnapshotRes.data !== null;

  const advantages =
    ownData && competitorData
      ? detectAllAdvantages({
          own: ownData,
          competitor: competitorData,
          competitorLabel,
          ownPricingFound: ownFlags.pricingPageFound,
          competitorPricingFound: competitorFlags.pricingPageFound,
          ownPlatforms: ownFlags.socialPlatforms ?? [],
          competitorPlatforms: competitorFlags.socialPlatforms ?? [],
          bothSitesObserved:
            ownFlags.socialPlatforms !== null && competitorFlags.socialPlatforms !== null,
          ownReviewPlatforms: ownFlags.reviewPlatforms ?? [],
          competitorReviewPlatforms: competitorFlags.reviewPlatforms ?? [],
          bothSitesReviewsObserved:
            ownFlags.reviewPlatforms !== null && competitorFlags.reviewPlatforms !== null,
        })
      : [];

  return (
    <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
      <div className="relative mx-auto w-full max-w-4xl px-6 py-14 sm:px-8 lg:py-16">
        <PageHeader
            eyebrow="Score"
            title="Pourquoi ce score"
            lede="Le calcul complet, sans boîte noire."
            back={{ href: "/dashboard", label: "Tableau de bord" }}
          />

        {/*
          Point focal de l'écran, et désormais le pilote des deux sections qui suivent :
          cliquer une ligne du calcul filtre les écarts, simuler une fermeture recalcule
          le score. Les trois blocs parlaient des mêmes chiffres sans jamais se répondre.

          Rien à explorer tant que rien n'a été mesuré : sans analyse du concurrent
          courant, un calcul complet aboutirait à 100 sous un score affiché « — ».
        */}
        {analysedForCurrentCompetitor ? (
          <ScoreExplorer gaps={gaps} competitorLabel={competitorLabel} />
        ) : (
          <section className="panel-focal mb-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-brand text-[3.2rem] font-bold leading-[0.9] tracking-[-0.05em] tabular-nums text-mist/50 sm:text-[4rem]">
                —
              </span>
              <span className="font-mono text-sm text-mist/60">/{MAX_SCORE}</span>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist">
              {competitorLabel} n&rsquo;a pas encore été analysé, il n&rsquo;y a donc rien à
              calculer. Lance une analyse depuis le tableau de bord pour obtenir un score.
            </p>
          </section>
        )}

        <section className="panel overflow-hidden">
          <PanelHeader title="Ce que tu as et qu'il n'a pas" />

          <p className="border-b border-white/[0.08] px-6 py-5 text-sm leading-relaxed text-mist">
            {competitorLabel} n&rsquo;a pas de score. On observe uniquement ses pages publiques, ce
            qui ne permet pas de noter son produit sans inventer. En revanche, les mêmes règles
            appliquées dans l&rsquo;autre sens montrent où tu es devant — sans que cela n&rsquo;entre
            dans ton score.
          </p>

          {advantages.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="Aucun avantage détecté pour l'instant"
                description={`Sur les critères publics comparés (pricing, essai gratuit, palier gratuit, réseaux sociaux), rien ne te place devant ${competitorLabel} aujourd'hui.`}
              />
            </div>
          ) : (
            <ul>
              {advantages.map((advantage) => (
                <li
                  key={advantage.title}
                  className="border-b border-white/[0.08] px-6 py-5 transition-colors last:border-b-0 hover:bg-white/[0.022]"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="inline-flex items-center gap-2 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-mint">
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-mint" />
                      Avantage
                    </span>
                    <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist/60">
                      {CATEGORY_LABEL[advantage.category]}
                    </span>
                  </div>
                  <p className="font-brand text-[1.05rem] font-medium leading-snug tracking-[-0.01em] text-paper">
                    {advantage.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-mist">
                    {advantage.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
