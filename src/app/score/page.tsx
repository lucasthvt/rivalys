import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/tasks/empty-state";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { CATEGORY_LABEL, sortGapsByPriority } from "@/components/tasks/priority";
import { parseExtractedData, parseObservationFlags } from "@/components/dashboard/extracted-data";
import { countByPriority, explainScore, MAX_SCORE, POINTS_PER_PRIORITY } from "@/lib/compare/score";
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
      <AppShell userLabel={userLabel}>
        <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
          <Header />
          <EmptyState
            title="Impossible de calculer le détail du score"
            description={gapsRes.error.message}
          />
        </div>
      </AppShell>
    );
  }

  const gaps = sortGapsByPriority(gapsRes.data ?? []);
  const breakdown = explainScore(countByPriority(gaps));
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
        })
      : [];

  return (
    <AppShell userLabel={userLabel}>
      <div className="mx-auto max-w-4xl px-6 py-16 sm:px-8">
        <Header />

        <section className="mb-8 border border-surface-border bg-surface px-5 py-6">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-[44px] leading-none text-foreground">
              {breakdown.score}
            </span>
            <span className="font-mono text-sm text-foreground-muted">/ {MAX_SCORE}</span>
          </div>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-foreground-muted">
            Le score part de {MAX_SCORE} et retire des points pour chaque écart encore ouvert,
            selon sa priorité. Il ne note pas la qualité de ton produit : il mesure ce qu&rsquo;il
            te reste à rattraper face à {competitorLabel}.
          </p>
        </section>

        <section className="mb-8 border border-surface-border bg-surface">
          <div className="border-b border-surface-border px-5 py-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
              Le calcul
            </h2>
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left font-mono text-[11px] uppercase tracking-[0.12em] text-foreground-muted/70">
                <th className="px-5 py-3 font-medium">Priorité</th>
                <th className="px-5 py-3 font-medium">Écarts ouverts</th>
                <th className="px-5 py-3 font-medium">Points par écart</th>
                <th className="px-5 py-3 text-right font-medium">Points retirés</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-surface-border">
                <td className="px-5 py-3 text-foreground-muted">Point de départ</td>
                <td className="px-5 py-3 text-foreground-muted">—</td>
                <td className="px-5 py-3 text-foreground-muted">—</td>
                <td className="px-5 py-3 text-right font-mono text-foreground">+{MAX_SCORE}</td>
              </tr>
              {breakdown.lines.map((line) => (
                <tr key={line.priority} className="border-b border-surface-border">
                  <td className="px-5 py-3">
                    <PriorityBadge priority={line.priority} />
                  </td>
                  <td className="px-5 py-3 font-mono text-foreground">{line.count}</td>
                  <td className="px-5 py-3 font-mono text-foreground-muted">−{line.pointsEach}</td>
                  <td className="px-5 py-3 text-right font-mono text-foreground">
                    {line.pointsLost === 0 ? "0" : `−${line.pointsLost}`}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="px-5 py-4 font-medium text-foreground" colSpan={3}>
                  Score
                </td>
                <td className="px-5 py-4 text-right font-mono text-lg text-foreground">
                  {breakdown.score}
                </td>
              </tr>
            </tbody>
          </table>

          {breakdown.clamped && (
            <p className="border-t border-surface-border px-5 py-4 text-sm leading-relaxed text-foreground-muted">
              Les pénalités totalisent {breakdown.totalLost} points, au-delà des {MAX_SCORE}{" "}
              disponibles. Le score reste donc bloqué à 0 : il ne remontera qu&rsquo;une fois les
              pénalités repassées sous {MAX_SCORE}. Ferme les écarts en priorité haute d&rsquo;abord,
              ce sont eux qui pèsent le plus.
            </p>
          )}
        </section>

        <section className="mb-8 border border-surface-border bg-surface">
          <div className="border-b border-surface-border px-5 py-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
              Les écarts qui te coûtent des points
            </h2>
          </div>
          {gaps.length === 0 ? (
            <div className="px-5 py-8">
              <EmptyState
                title="Aucun écart ouvert"
                description="Ton score est au maximum. Il baissera si une prochaine analyse détecte un écart."
              />
            </div>
          ) : (
            <ul>
              {gaps.map((gap) => (
                <li
                  key={gap.id}
                  className="flex flex-col gap-2 border-b border-surface-border px-5 py-4 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                >
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={gap.priority} />
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground-muted/70">
                        {CATEGORY_LABEL[gap.category]}
                      </span>
                    </div>
                    <p className="text-[15px] text-foreground">{gap.title}</p>
                  </div>
                  <span className="shrink-0 font-mono text-sm text-foreground-muted">
                    −{POINTS_PER_PRIORITY[gap.priority]} pts
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-surface-border bg-surface">
          <div className="border-b border-surface-border px-5 py-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
              Ce que tu as et qu&rsquo;il n&rsquo;a pas
            </h2>
          </div>

          <p className="border-b border-surface-border px-5 py-4 text-sm leading-relaxed text-foreground-muted">
            {competitorLabel} n&rsquo;a pas de score. On observe uniquement ses pages publiques, ce
            qui ne permet pas de noter son produit sans inventer. En revanche, les mêmes règles
            appliquées dans l&rsquo;autre sens montrent où tu es devant — sans que cela n&rsquo;entre
            dans ton score.
          </p>

          {advantages.length === 0 ? (
            <div className="px-5 py-8">
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
                  className="border-b border-surface-border px-5 py-4 last:border-b-0"
                >
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 border border-surface-border bg-mint/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-mint">
                      Avantage
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground-muted/70">
                      {CATEGORY_LABEL[advantage.category]}
                    </span>
                  </div>
                  <p className="text-[15px] text-foreground">{advantage.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
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

function Header() {
  return (
    <header className="mb-10 border-b border-surface-border pb-6">
      <Link
        href="/dashboard"
        className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground-muted transition-colors hover:text-foreground"
      >
        ← Tableau de bord
      </Link>
      <h1 className="font-display mt-3 text-2xl sm:text-[28px]">Pourquoi ce score</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Le calcul complet, sans boîte noire.
      </p>
    </header>
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
