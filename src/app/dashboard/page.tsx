import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/tasks/empty-state";
import { sortGapsByPriority } from "@/components/tasks/priority";
import { NoCompetitorState } from "@/components/competitor/no-competitor-state";
import { ScoreChart } from "@/components/dashboard/score-chart";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { GapStats } from "@/components/dashboard/gap-stats";
import { CategoryBars } from "@/components/dashboard/category-bars";
import { parseExtractedData, parseObservationFlags } from "@/components/dashboard/extracted-data";
import { CoverageNoticePanel } from "@/components/dashboard/coverage-notice";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { PANEL_ACTION_LINK, PanelHeader } from "@/components/layout/Panel";
import { FreePreviewPanel } from "@/components/billing/free-preview";
import { buildFreePreview } from "@/lib/billing/free-preview";
import { explainMissingSnapshot } from "@/lib/compare/analysis-state";
import { parseLastRunAt } from "@/lib/compare/rate-limit";
import { assessPricingCoverage } from "@/lib/compare/comparability";
import { hasPaidAccess } from "@/lib/billing/access";
import { Board } from "@/components/dashboard/board";
import { buildFaceOffRows } from "@/components/dashboard/face-off-rows";
import { DimensionLine } from "@/components/ui/DimensionLine";
import { CompetitorSwitcher } from "@/components/competitor/competitor-switcher";
import { orderCompetitors, resolveSelectedCompetitor } from "@/lib/competitors/selection";

export default async function DashboardPage({
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

  // Le concurrent affiché vient de l'URL, avec repli sur le principal (voir
  // lib/competitors/selection.ts). Tout ce qui suit — écarts, relevés, score, historique —
  // décrit CE face-à-face et lui seul : mélanger trois comparaisons dans un même écran
  // produirait des chiffres qu'aucune page ne permet de reconstituer.
  const { data: trackedCompetitors, error: competitorsError } = await supabase
    .from("competitors")
    .select("*")
    .eq("user_id", user.id);

  const competitorLoadError = Boolean(competitorsError);
  const competitors = orderCompetitors(trackedCompetitors ?? []);
  const requested = (await searchParams).concurrent;
  const competitor = resolveSelectedCompetitor(
    competitors,
    typeof requested === "string" ? requested : null,
  );

  // Nothing to compare against yet: every panel below would render its own
  // empty shell (score "—", 0 écart, comparatif vide) and read like an
  // analysis that found nothing. Send the user to /concurrent instead — that
  // is the one action that unblocks the whole product.
  //
  // Placé avant les requêtes qui suivent, et non après : elles sont toutes scopées au
  // concurrent affiché, et sans lui elles n'ont pas de filtre à appliquer.
  if (!competitor) {
    return (
      <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
        <div className="relative mx-auto w-full max-w-5xl px-6 py-14 sm:px-8 lg:py-16">
          <PageHeader eyebrow="Tableau de bord" title="Où tu perds du terrain" />
          {competitorLoadError ? (
            <EmptyState
              title="Impossible de lire tes concurrents"
              description={competitorsError?.message}
            />
          ) : (
            <NoCompetitorState description="Le comparateur a besoin d'un second site pour trouver le moindre écart. Ajoute le concurrent que tu veux suivre, puis lance une première analyse." />
          )}
        </div>
      </AppShell>
    );
  }

  const [gapsRes, allGapsRes, scoreRes] = await Promise.all([
    supabase
      .from("detected_gaps")
      .select("*")
      .eq("competitor_id", competitor.id)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
    // Every status, for the stats section — which is about the whole history of this
    // face-off, not just what's currently open.
    supabase
      .from("detected_gaps")
      .select("category, status, resolved_at")
      .eq("competitor_id", competitor.id),
    supabase
      .from("score_history")
      .select("*")
      .eq("competitor_id", competitor.id)
      .order("recorded_at", { ascending: true }),
  ]);

  // The two primary metrics — open gaps and score — drive the whole
  // dashboard. If either failed to load, showing the normal dashboard would
  // silently render "0 écarts ouverts, score —" as if everything were fine,
  // so surface a clear error state instead of a fabricated-looking dashboard.
  if (gapsRes.error || scoreRes.error) {
    return (
      <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
        <div className="relative mx-auto w-full max-w-5xl px-6 py-14 sm:px-8 lg:py-16">
          <PageHeader eyebrow="Tableau de bord" title="Où tu perds du terrain" />
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

  // Latest snapshot for each side. Le relevé de notre côté est unique — le pipeline ne lit
  // notre SaaS qu'une fois par exécution — tandis que celui d'en face est scopé au
  // concurrent affiché.
  const [ownSnapshotRes, competitorSnapshotRes] = await Promise.all([
    supabase
      .from("site_snapshots")
      .select("*")
      .eq("target_type", "own_saas")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("site_snapshots")
      .select("*")
      .eq("target_type", "competitor")
      .eq("competitor_id", competitor.id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  /*
    Pourquoi ce concurrent n'a pas de relevé, quand il n'en a pas.

    L'écran lisait cette absence comme « aucune analyse pour ce concurrent ». Mais une
    analyse lit notre site PUIS celui d'en face : quand le second échoue, le premier relevé
    est quand même écrit, et c'est lui qui arme la limite de 24 h. L'écran annonçait donc
    « aucune analyse » pendant que le bouton répondait « analyse déjà effectuée il y a moins
    de 24 h » — deux phrases contradictoires côte à côte.

    `lastRunAt` est le relevé le plus récent du compte, tous côtés confondus : la même
    valeur que celle dont /api/compare se sert pour décider. C'est ce qui garantit que les
    deux racontent la même histoire.
  */
  const missingSnapshotReason = competitorSnapshotRes.data
    ? null
    : explainMissingSnapshot({
        lastRunAt: parseLastRunAt(ownSnapshotRes.data?.fetched_at),
        trackedSince:
          parseLastRunAt(competitor.url_changed_at) ?? parseLastRunAt(competitor.created_at),
        now: new Date(),
      });

  const analysisFailedLastRun = missingSnapshotReason?.kind === "failed";

  const snapshotLoadError = Boolean(ownSnapshotRes.error || competitorSnapshotRes.error);
  const ownData = parseExtractedData(ownSnapshotRes.data?.extracted_data);
  const competitorData = parseExtractedData(competitorSnapshotRes.data?.extracted_data);
  const ownFlags = parseObservationFlags(ownSnapshotRes.data?.extracted_data);
  const competitorFlags = parseObservationFlags(competitorSnapshotRes.data?.extracted_data);
  const competitorLabel = competitor.name?.trim() || safeHostname(competitor.url);

  // Formulé ici, où le nom du concurrent est connu. Le délai annoncé vient de la même
  // horloge que celle de /api/compare : les deux doivent donner le même chiffre.
  const missingSnapshotNotice =
    missingSnapshotReason?.kind === "failed"
      ? `Une analyse a bien tourné, mais le site de ${competitorLabel} n'a pas pu être lu — rien n'a donc été comparé. La prochaine tentative sera possible dans ${missingSnapshotReason.retryIn}.`
      : null;

  const switcher = (
    <CompetitorSwitcher
      competitors={competitors.map((tracked) => ({
        id: tracked.id,
        label: tracked.name?.trim() || safeHostname(tracked.url),
      }))}
      selectedId={competitor.id}
      basePath="/dashboard"
    />
  );

  /*
    Palier gratuit : l'analyse a tourné, et on en montre maintenant le début.

    Avant, cet écran était un mur complet : un nombre d'écarts et rien d'autre. Quelqu'un qui
    venait de donner deux URL et d'attendre son analyse repartait avec un chiffre qu'il
    n'avait aucun moyen de croire. C'est le doute auquel l'analyse sans compte de la page
    d'accueil répondait, en montrant UN écart en clair ; cette page-là n'existe plus, et la
    réponse vit ici, sur le vrai relevé du compte — la même donnée en mieux, rattachée à un
    utilisateur et suivie dans le temps.

    Ce qui reste fermé n'est pas flouté : il n'est PAS ENVOYÉ au navigateur. buildFreePreview
    ne laisse sortir que l'écart offert, des décomptes et des noms de familles ; les titres et
    descriptions des autres restent côté serveur. Un flou CSS reste lisible dans le HTML.
  */
  if (!unlocked) {
    const analysedAt = competitorSnapshotRes.data?.fetched_at ?? null;
    const preview = buildFreePreview(gaps);

    return (
      <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
        <div className="relative mx-auto w-full max-w-5xl px-6 py-14 sm:px-8 lg:py-16">
          {/*
            Le bouton d'analyse appartient aussi au palier gratuit.

            L'analyse tourne pour tout le monde — c'est le DÉTAIL de ce qu'elle trouve qui
            est réservé aux offres payantes. Sans ce bouton, un compte dont la première
            analyse a échoué (site injoignable, limite de débit, coupure réseau) arrivait
            sur un tableau de bord qui lui disait de lancer une analyse sans lui en donner
            le moyen : un cul-de-sac dès la fin de l'inscription. L'écran d'onboarding
            promet d'ailleurs noir sur blanc qu'on peut « relancer l'analyse depuis le
            tableau de bord ».
          */}
          <PageHeader
            eyebrow="Tableau de bord"
            title="Où tu perds du terrain"
            action={
              <RefreshButton
                // « Réessayer » et non « Lancer » quand la dernière analyse a échoué de ce
                // côté : il y a bien eu une tentative, et le bouton va d'ailleurs répondre
                // qu'elle date de moins de 24 h.
                label={
                  analysedAt ? "Actualiser" : analysisFailedLastRun ? "Réessayer" : "Lancer l'analyse"
                }
              />
            }
          />
          {switcher}

          <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <MetricCard
              label="Analyse"
              value={
                analysedAt ? "Terminée" : analysisFailedLastRun ? "Sans résultat" : "Pas encore lancée"
              }
              sublabel={
                analysedAt
                  ? formatAnalysisDate(analysedAt)
                  : analysisFailedLastRun
                    ? `Son site n'a pas pu être lu`
                    : "Lance-la pour comparer"
              }
            />
            <MetricCard
              label="Écarts détectés"
              value={analysedAt ? String(gaps.length) : "—"}
              sublabel={analysedAt ? "Le premier est ouvert ci-dessous" : undefined}
            />
            <MetricCard
              label="Concurrent suivi"
              value={competitorLabel}
              href="/concurrent"
              linkLabel="Changer"
            />
          </div>

          {analysedAt ? (
            <FreePreviewPanel
              preview={preview}
              // Le score vient de score_history, comme au palier payant : il décrit l'état
              // au moment de l'analyse, et non un calcul refait à l'affichage.
              score={latestScore}
              competitorLabel={competitorLabel}
            />
          ) : (
            <EmptyState
              title={
                analysisFailedLastRun
                  ? `Le site de ${competitorLabel} n'a pas pu être lu`
                  : "Aucune analyse pour ce concurrent"
              }
              description={
                missingSnapshotNotice ??
                `Lance une première analyse face à ${competitorLabel} pour voir ton score et ton écart le plus prioritaire.`
              }
              // Une consigne sans commande n'est pas une consigne. L'état vide porte donc
              // le bouton lui-même, en plus de celui de l'en-tête : c'est ici que le regard
              // se pose quand l'écran est vide.
              action={<RefreshButton label={analysisFailedLastRun ? "Réessayer" : "Lancer l'analyse"} />}
            />
          )}
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

  const faceOffRows = buildFaceOffRows({
    own: ownData,
    competitor: competitorData,
    ownMethods: {
      auth: ownFlags.authMethods,
      payment: ownFlags.paymentMethods,
      paymentProviders: ownFlags.paymentProviders,
    },
    competitorMethods: {
      auth: competitorFlags.authMethods,
      payment: competitorFlags.paymentMethods,
      paymentProviders: competitorFlags.paymentProviders,
    },
  });

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
      <div className="relative mx-auto w-full max-w-5xl px-6 py-14 sm:px-8 lg:py-16">
        <PageHeader
          eyebrow="Tableau de bord"
          title="Où tu perds du terrain"
          action={<RefreshButton />}
        />
        {switcher}

        {/*
          Le cartouche, emprunté au dessin technique : ce que la planche compare, et entre
          les deux le nombre d'écarts relevés. Il vit maintenant dans son propre panneau,
          comme la carte de relevé du hero de la landing — posé sous le titre plutôt que
          cousu dedans, il se lit comme la mesure qu'il est.
        */}
        <div className="panel mb-6 overflow-hidden">
          <PanelHeader
            title="Relevé comparé"
            action={
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist/50">
                {competitorSnapshotRes.data?.fetched_at
                  ? formatAnalysisDate(competitorSnapshotRes.data.fetched_at)
                  : analysisFailedLastRun
                    ? "Relevé non abouti"
                    : "Pas encore analysé"}
              </span>
            }
          />
          <div className="grid grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] items-center gap-x-3 px-6 py-6 sm:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)] sm:gap-x-5">
            <p className="truncate text-right font-mono text-sm text-signal-bright" title="Ton SaaS">
              Toi
            </p>
            <div className="flex flex-col items-center gap-1.5">
              <DimensionLine measured={gaps.length > 0} />
              <span
                className={`font-mono text-[0.62rem] uppercase tracking-[0.12em] ${
                  gaps.length > 0 ? "text-signal-bright" : "text-mist/45"
                }`}
              >
                {!analysedForCurrentCompetitor
                  ? analysisFailedLastRun
                    ? "Site non lu"
                    : "Pas encore analysé"
                  : gaps.length === 0
                    ? "Aligné"
                    : `${gaps.length} écart${gaps.length > 1 ? "s" : ""}`}
              </span>
            </div>
            <p className="truncate font-mono text-sm text-mist" title={competitorLabel}>
              {competitorLabel}
            </p>
          </div>
        </div>

        {/*
          Même raison qu'au palier gratuit : sans cette phrase, l'écran dit « pas encore
          analysé » pendant que le bouton d'actualisation répond « analyse déjà effectuée il
          y a moins de 24 h ».
        */}
        {missingSnapshotNotice && (
          <div className="panel mb-6 px-6 py-5">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist">
              Dernière analyse
            </p>
            <p className="mt-2 text-sm leading-relaxed text-mist">{missingSnapshotNotice}</p>
          </div>
        )}

        {coverageNotice && <CoverageNoticePanel notice={coverageNotice} />}

        {/*
          Le plateau : score, file d'écarts et relevé coté partagent un même état, donc un
          même composant. Cocher un écart déplace le score projeté et vide la file sans
          aller-retour serveur visible ; survoler une ligne du relevé éclaire les écarts de
          sa famille.
        */}
        <Board
          gaps={gaps}
          rows={faceOffRows}
          competitorLabel={competitorLabel}
          scoreFromHistory={latestScore}
          previousScoreFromHistory={previousScore}
          analysed={analysedForCurrentCompetitor}
          snapshotLoadError={snapshotLoadError}
        />

        <section className="panel mt-6 mb-6 overflow-hidden">
          <PanelHeader title="Où le terrain se perd" />
          <div className="px-6 py-6">
            <CategoryBars gaps={gaps} analysed={analysedForCurrentCompetitor} />
          </div>
        </section>


        <section className="panel mb-6 overflow-hidden">
          <PanelHeader
            title="Statistiques"
            action={
              <Link href="/statistiques" className={PANEL_ACTION_LINK}>
                Tout voir →
              </Link>
            }
          />
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

        <section className="panel overflow-hidden">
          <PanelHeader title="Évolution du score" />
          <div className="px-6 py-6">
          <ScoreChart points={scorePoints} />
          {/*
            score_history ne porte pas de competitor_id : ses points décrivent l'état au
            moment de chaque analyse, quel que soit le concurrent suivi alors. Quand le
            concurrent actuel n'a encore jamais été analysé, la courbe affichée porte donc
            entièrement sur le précédent. On le dit, plutôt que de laisser lire une
            continuité qui n'existe pas.
          */}
          {!analysedForCurrentCompetitor && scorePoints.length > 0 && (
            <p className="mt-4 border-t border-white/[0.08] pt-4 text-xs leading-relaxed text-mist/70">
              Ces relevés portent sur le concurrent suivi précédemment. La courbe repartira à
              la première analyse de {competitorLabel}.
            </p>
          )}
          </div>
        </section>
      </div>
    </AppShell>
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
