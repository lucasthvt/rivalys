import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/tasks/empty-state";
import { CompetitorForm } from "./_components/CompetitorForm";

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
    .select("onboarding_completed, first_name")
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

  return (
    <AppShell userLabel={userLabel}>
      <div className="app-ambient relative mx-auto max-w-3xl px-6 py-16 sm:px-8">
        <header className="mb-10 border-b border-surface-border pb-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-foreground-muted/70">
            Concurrent
          </p>
          <h1 className="font-display mt-2 text-2xl sm:text-[28px]">Le terrain d&rsquo;en face</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground-muted">
            Tout le comparateur repose sur ce seul site. Tu peux en changer quand tu veux.
          </p>
        </header>

        <section className="panel mb-5 overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
              Concurrent suivi
            </h2>
          </div>

          {error ? (
            <div className="px-5 py-8">
              <EmptyState
                title="Impossible de lire ton concurrent"
                description={error.message}
              />
            </div>
          ) : competitor ? (
            <div className="px-5 py-5">
              <p className="text-[15px] font-medium text-foreground">
                {competitor.name?.trim() || safeHostname(competitor.url)}
              </p>
              <a
                href={competitor.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-block break-all font-mono text-sm text-accent-strong transition-colors hover:text-foreground"
              >
                {competitor.url}
              </a>
              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-surface-border pt-4">
                <div>
                  <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground-muted/70">
                    Ajouté le
                  </dt>
                  <dd className="mt-1 font-mono text-sm text-foreground">
                    {formatDate(competitor.created_at)}
                  </dd>
                </div>
              </dl>
              {!competitor.name?.trim() && (
                <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
                  Aucun nom enregistré pour ce concurrent — on affiche son domaine plutôt que
                  d&rsquo;en inventer un.
                </p>
              )}
            </div>
          ) : (
            <div className="px-5 py-8">
              <EmptyState
                title="Aucun concurrent suivi"
                description="Renseigne le site de ton plus gros concurrent ci-dessous pour que le comparateur ait un point de comparaison."
              />
            </div>
          )}
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
              {competitor ? "Changer de concurrent" : "Ajouter un concurrent"}
            </h2>
          </div>
          <CompetitorForm hasCompetitor={Boolean(competitor)} />
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date inconnue";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
}
