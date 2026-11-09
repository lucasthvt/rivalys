import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { PanelHeader } from "@/components/layout/Panel";
import { EmptyState } from "@/components/tasks/empty-state";
import { CompetitorForm } from "./_components/CompetitorForm";
import { CompetitorList, type TrackedCompetitor } from "./_components/CompetitorList";
import { orderCompetitors } from "@/lib/competitors/selection";
import {
  canAddCompetitor,
  checkCompetitorChange,
  COMPETITOR_CHANGE_COOLDOWN_DAYS,
  COMPETITOR_SLOTS,
  formatNextChangeDate,
} from "@/lib/billing/competitor-slots";

/**
 * Les concurrents suivis — ajoutés ici et non pendant l'onboarding, pour qu'ils
 * puissent aussi être changés plus tard.
 *
 * Une place occupée = un site relu à chaque analyse. L'écran ne montre donc pas une
 * capacité théorique mais l'occupation réelle : ce qui est suivi, ce qui reste libre,
 * et ce que le palier ouvre.
 *
 * Tout ce qui est affiché vient des lignes `competitors` de l'utilisateur. Le nom
 * n'est jamais deviné : tant qu'il est vide, on montre le domaine et on le dit.
 */
export default async function ConcurrentPage() {
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

  const { data: tracked, error } = await supabase
    .from("competitors")
    .select("*")
    .eq("user_id", user.id);

  const competitors = orderCompetitors(tracked ?? []);

  const tier = profile?.subscription_tier ?? "starter";
  const slots = COMPETITOR_SLOTS[tier];
  const usedSlots = competitors.length;
  const allowance = canAddCompetitor(tier, usedSlots);

  // Le délai ne s'applique qu'en production, comme la limite de 7 jours sur
  // l'analyse : en développement il empêcherait de tester le remplacement.
  const cooldownEnforced = process.env.NODE_ENV === "production";
  const now = new Date();

  const rows: TrackedCompetitor[] = competitors.map((competitor) => {
    const change = checkCompetitorChange(
      competitor.url_changed_at ? new Date(competitor.url_changed_at) : null,
      now,
    );
    return {
      id: competitor.id,
      label: competitor.name?.trim() || safeHostname(competitor.url),
      url: competitor.url,
      isPrimary: competitor.is_primary ?? false,
      addedOn: formatDate(competitor.created_at),
      lockedUntil:
        cooldownEnforced && !change.allowed ? formatNextChangeDate(change.nextChangeAt) : null,
    };
  });

  return (
    <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
      <div className="relative mx-auto w-full max-w-3xl px-6 py-14 sm:px-8 lg:py-16">
        <PageHeader
          eyebrow="Concurrent"
          title="Le terrain d'en face"
          lede={
            <>
              Tout le comparateur repose sur ces sites. Ton palier ouvre {slots} place
              {slots > 1 ? "s" : ""}, chacune remplaçable une fois tous les{" "}
              {COMPETITOR_CHANGE_COOLDOWN_DAYS} jours.
            </>
          }
        />

        {/* Point focal : les places occupées. */}
        <section className="panel-focal mb-6 overflow-hidden">
          <PanelHeader
            title={usedSlots > 1 ? "Concurrents suivis" : "Concurrent suivi"}
            action={
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist/50">
                {usedSlots} / {slots} place{slots > 1 ? "s" : ""} utilisée
                {usedSlots > 1 ? "s" : ""}
              </span>
            }
          />

          {error ? (
            <div className="px-6 py-10">
              <EmptyState
                title="Impossible de lire tes concurrents"
                description={error.message}
              />
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-10">
              <EmptyState
                title="Aucun concurrent suivi"
                description="Renseigne le site de ton plus gros concurrent ci-dessous pour que le comparateur ait un point de comparaison."
              />
            </div>
          ) : (
            <CompetitorList competitors={rows} />
          )}
        </section>

        <section className="panel overflow-hidden">
          <PanelHeader title="Ajouter un concurrent" />

          {allowance.allowed ? (
            <CompetitorForm />
          ) : (
            <div className="px-6 py-6">
              <p className="text-sm font-medium text-paper">Toutes tes places sont occupées</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
                {allowance.reason}
              </p>
            </div>
          )}
        </section>

        {rows.some((row) => !row.isPrimary) && (
          <p className="mt-6 text-sm leading-relaxed text-mist">
            Le concurrent principal est celui que le tableau de bord, les tâches et le score
            ouvrent par défaut. Les autres restent accessibles depuis le sélecteur en haut de
            ces écrans — chacun avec ses propres écarts et son propre score.
          </p>
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date inconnue";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
}
