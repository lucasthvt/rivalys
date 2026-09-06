import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { PanelHeader } from "@/components/layout/Panel";
import { TestimonialPrompt } from "@/components/testimonials/testimonial-prompt";
import { fetchOwnTestimonial } from "@/lib/testimonials/queries";

/**
 * L'écran « Avis » — écrire son retour, et voir où il en est.
 *
 * Le formulaire vivait en bas du tableau de bord. Le moment était juste (on demande son
 * avis à quelqu'un qui vient de lire ses résultats, pas à quelqu'un qui arrive), l'endroit
 * ne l'était pas : l'écran qui répond « où je perds du terrain » finissait par demander un
 * service, et il n'y avait aucun endroit où revenir pour modifier ou retirer son accord.
 *
 * La règle d'affichage ne change pas : le formulaire n'apparaît qu'à quelqu'un dont
 * l'analyse a tourné sur son concurrent actuel. Avant ça, la question « ce que Rivalys t'a
 * montré » n'a pas de réponse possible, et un avis écrit sans avoir rien vu ne vaut rien —
 * ni pour la landing, ni pour la directive Omnibus, qui demande de pouvoir démontrer que
 * chaque avis publié émane d'un utilisateur réel du produit.
 */
export default async function AvisPage() {
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

  const { data: competitor } = await supabase
    .from("competitors")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Même condition d'existence que sur le tableau de bord : un relevé du concurrent
  // actuellement suivi. Sans lui, l'analyse n'a rien montré de ce produit-ci.
  const { data: snapshot } = competitor
    ? await supabase
        .from("site_snapshots")
        .select("id")
        .eq("user_id", user.id)
        .eq("target_type", "competitor")
        .eq("competitor_id", competitor.id)
        .limit(1)
        .maybeSingle()
    : { data: null };

  const analysed = snapshot !== null;
  const ownTestimonial = analysed ? await fetchOwnTestimonial(user.id) : null;

  return (
    <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
      <div className="relative mx-auto w-full max-w-3xl px-6 py-14 sm:px-8 lg:py-16">
        <PageHeader
          eyebrow="Avis"
          title="Ton retour sur Rivalys"
          lede="Ce que l'outil t'a montré, dans tes mots. Publié seulement si tu le décides, et retirable à tout moment."
        />

        {analysed ? (
          <TestimonialPrompt existing={ownTestimonial} />
        ) : (
          <div className="panel p-6 sm:p-7">
            <p className="font-brand text-lg font-bold tracking-[-0.02em] text-paper">
              Rien à raconter pour l&rsquo;instant
            </p>
            <p className="mt-3 text-sm leading-relaxed text-mist">
              {competitor
                ? "Aucune analyse n'a encore tourné sur le concurrent que tu suis. Lance-en une depuis le tableau de bord : la question « ce que Rivalys t'a montré » attend d'avoir une réponse."
                : "Aucun concurrent suivi pour l'instant. Ajoute-en un, lance une analyse, et reviens ici une fois que tu auras vu ton premier écart."}
            </p>
            <Link
              href={competitor ? "/dashboard" : "/concurrent"}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-white/[0.14] px-6 text-sm font-semibold text-paper transition-colors hover:border-signal-bright/50 hover:text-signal-bright"
            >
              {competitor ? "Aller au tableau de bord" : "Ajouter un concurrent"}
            </Link>
          </div>
        )}

        <section className="panel mt-6 overflow-hidden">
          <PanelHeader title="Ce qui se passe ensuite" />
          <ul className="flex flex-col divide-y divide-white/[0.08]">
            {PUBLICATION_STEPS.map((step, index) => (
              <li key={step.title} className="flex items-baseline gap-4 px-6 py-5">
                <span aria-hidden="true" className="font-mono text-[0.68rem] text-signal-bright">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-brand text-[1.02rem] font-medium tracking-[-0.01em] text-paper">
                    {step.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-mist">{step.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

/**
 * Le parcours réel d'un avis, tel que le code l'applique — deux booléens séparés
 * (`consent_public` côté personne, `published` côté nous) et un trigger qui remet en file
 * d'attente tout texte modifié après validation. Écrit ici pour que la personne qui donne
 * son accord sache exactement ce qu'elle autorise.
 */
const PUBLICATION_STEPS = [
  {
    title: "Tu écris, tu décides",
    body: "La case d'autorisation est décochée par défaut. Sans elle, ton retour reste interne : il nous sert à corriger l'outil, il ne quitte pas la base.",
  },
  {
    title: "On relit avant de publier",
    body: "Ton accord ne publie pas tout seul. Un avis n'apparaît sur la page d'accueil que si tu l'as autorisé ET qu'on l'a validé — deux conditions distinctes, et tu ne peux pas publier à notre place, ni nous à la tienne.",
  },
  {
    title: "Tu peux revenir dessus",
    body: "Modifier ton texte le remet en file d'attente ; retirer ton accord le dépublie. Les deux se font depuis cette page, sans écrire à personne.",
  },
];
