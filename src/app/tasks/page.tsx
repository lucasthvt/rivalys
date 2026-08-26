import { redirect } from "next/navigation";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { sortGapsByPriority, MONO_STACK } from "@/components/tasks/priority";
import { GapListItem } from "@/components/tasks/gap-list-item";
import { EmptyState } from "@/components/tasks/empty-state";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600"] });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500"] });

export default async function TasksPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarding_completed !== true) {
    redirect("/onboarding");
  }

  const { data: gapsRaw, error } = await supabase
    .from("detected_gaps")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false });

  const gaps = sortGapsByPriority(gapsRaw ?? []);
  const highCount = gaps.filter((g) => g.priority === "high").length;

  return (
    <main className={`${plexSans.className} min-h-[calc(100vh-4rem)] bg-[#0F1613] text-[#EDF2EE]`}>
      <div className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
        <header className="mb-10 border-b border-[#2A362F] pb-6">
          <p
            className="text-[11px] uppercase tracking-[0.2em] text-[#5C7568]"
            style={{ fontFamily: MONO_STACK }}
          >
            Tâches
          </p>
          <h1 className={`${spaceGrotesk.className} mt-2 text-2xl sm:text-[28px]`}>
            Écarts à combler
          </h1>
          <p className="mt-2 text-sm text-[#8CA093]">
            {gaps.length === 0
              ? "Aucun écart ouvert pour l'instant."
              : `${gaps.length} écart${gaps.length > 1 ? "s" : ""} ouvert${
                  gaps.length > 1 ? "s" : ""
                }${highCount > 0 ? ` · ${highCount} en priorité haute` : ""}.`}
          </p>
        </header>

        {error ? (
          <EmptyState
            title="Impossible de charger les tâches"
            description={error.message}
          />
        ) : gaps.length === 0 ? (
          <EmptyState
            title="Aucun écart détecté pour l'instant"
            description="Dès qu'une différence factuelle avec ton concurrent est détectée, elle apparaît ici sous forme de tâche concrète."
          />
        ) : (
          <ul>
            {gaps.map((gap) => (
              <GapListItem key={gap.id} gap={gap} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
