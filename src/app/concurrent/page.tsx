import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { PanelHeader } from "@/components/layout/Panel";
import { EmptyState } from "@/components/tasks/empty-state";
import { CompetitorForm } from "./_components/CompetitorForm";
import {
  checkCompetitorChange,
  COMPETITOR_CHANGE_COOLDOWN_DAYS,
  COMPETITOR_SLOTS,
  formatNextChangeDate,
} from "@/lib/billing/competitor-slots";

/**
 * Le concurrent suivi — ajouté ici et non pendant l'onboarding, pour qu'il
 * puisse aussi être changé plus tard.
 *
 * Tout ce qui est affiché vient de la ligne `competitors` de l'utilisateur.
 * Le nom n'est jamais deviné : tant qu'il est vide, on montre le domaine et
 * on le dit.
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

  const { data: competitor, error } = await supabase
    .from("competitors")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const tier = profile?.subscription_tier ?? "starter";
  const slots = COMPETITOR_SLOTS[tier];
  const usedSlots = competitor ? 1 : 0;

  // Le délai ne s'applique qu'en production, comme la limite de 24 h sur
  // l'analyse : en développement il empêcherait de tester le remplacement.
  const cooldownEnforced = process.env.NODE_ENV === "production";
  const allowance = checkCompetitorChange(
    competitor?.url_changed_at ? new Date(competitor.url_changed_at) : null,
    new Date(),
  );
  const changeLocked = cooldownEnforced && !allowance.allowed;

  return (
    <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
      <div className="relative mx-auto w-full max-w-3xl px-6 py-14 sm:px-8 lg:py-16">
        <PageHeader
          eyebrow="Concurrent"
          title="Le terrain d'en face"
          lede={
            <>
              Tout le comparateur repose sur ce seul site. Ton palier ouvre {slots} place
              {slots > 1 ? "s" : ""} de concurrent, remplaçable une fois tous les{" "}
              {COMPETITOR_CHANGE_COOLDOWN_DAYS} jours.
            </>
          }
        />

        {/* Point focal : le concurrent actuellement suivi. */}
        <section className="panel-focal mb-6 overflow-hidden">
          <PanelHeader title="Concurrent suivi" />

          {error ? (
            <div className="px-6 py-10">
              <EmptyState
                title="Impossible de lire ton concurrent"
                description={error.message}
              />
            </div>
          ) : competitor ? (
            <div className="px-6 py-6">
              <p className="font-brand text-xl font-bold tracking-[-0.02em] text-paper">
                {competitor.name?.trim() || safeHostname(competitor.url)}
              </p>
              <a
                href={competitor.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1.5 inline-block break-all font-mono text-sm text-signal-bright transition-colors hover:text-paper"
              >
                {competitor.url}
              </a>
              <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/[0.08] pt-5">
                <div>
                  <dt className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist/60">
                    Ajouté le
                  </dt>
                  <dd className="mt-1.5 font-mono text-sm text-paper">
                    {formatDate(competitor.created_at)}
                  </dd>
                </div>
              </dl>
              {!competitor.name?.trim() && (
                <p className="mt-5 text-sm leading-relaxed text-mist">
                  Aucun nom enregistré pour ce concurrent — on affiche son domaine plutôt que
                  d&rsquo;en inventer un.
                </p>
              )}
            </div>
          ) : (
            <div className="px-6 py-10">
              <EmptyState
                title="Aucun concurrent suivi"
                description="Renseigne le site de ton plus gros concurrent ci-dessous pour que le comparateur ait un point de comparaison."
              />
            </div>
          )}
        </section>

        <section className="panel overflow-hidden">
          <PanelHeader
            title={competitor ? "Changer de concurrent" : "Ajouter un concurrent"}
            action={
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist/50">
                {usedSlots} / {slots} place{slots > 1 ? "s" : ""} utilisée
                {usedSlots > 1 ? "s" : ""}
              </span>
            }
          />

          {changeLocked ? (
            <div className="px-6 py-6">
              <p className="text-sm font-medium text-paper">
                Changement possible le {formatNextChangeDate(allowance.nextChangeAt)}
              </p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
                Ton concurrent a été remplacé il y a moins de{" "}
                {COMPETITOR_CHANGE_COOLDOWN_DAYS} jours. Chaque remplacement efface les relevés
                du site précédent et relance une analyse complète — le délai évite qu&rsquo;une
                place unique serve à scanner le marché entier.
              </p>
            </div>
          ) : (
            <CompetitorForm hasCompetitor={Boolean(competitor)} />
          )}
        </section>

        {slots < COMPETITOR_SLOTS.growth && (
          <p className="mt-6 text-sm leading-relaxed text-mist">
            Le palier Growth ouvrira {COMPETITOR_SLOTS.growth} places de concurrent. Le suivi
            de plusieurs concurrents en parallèle est encore en construction — il n&rsquo;est
            pas vendu tant qu&rsquo;il ne tourne pas.
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
