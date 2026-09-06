import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/layout/Panel";
import { PageHeader } from "@/components/layout/PageHeader";
import { isStripeConfigured } from "@/lib/billing/stripe";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";
import { ExportDataButton } from "./_components/ExportDataButton";
import { DeleteAccountPanel } from "./_components/DeleteAccountPanel";

/**
 * Écran « Mon compte » : ce que le service sait, et comment le reprendre ou l'effacer.
 *
 * Il existe pour une raison précise : jusqu'ici, exercer un droit RGPD supposait d'écrire
 * à une adresse email et d'attendre. Les articles 15, 20 et 17 sont ici des boutons.
 */
export default async function ComptePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "first_name, subscription_tier, subscription_status, subscription_current_period_end, stripe_customer_id, terms_accepted_at, onboarding_completed",
    )
    .eq("id", user.id)
    .maybeSingle();

  // Même règle que les autres écrans applicatifs : tant que l'onboarding n'est pas fini,
  // il n'y a pas de compte à gérer.
  if (profile?.onboarding_completed !== true) redirect("/onboarding");

  const userLabel = profile?.first_name?.trim() || user.email || "Toi";
  const hasBilling = Boolean(profile?.stripe_customer_id) && isStripeConfigured();

  return (
    <AppShell userLabel={userLabel} tier={profile?.subscription_tier}>
      <div className="relative mx-auto w-full max-w-3xl px-6 py-14 sm:px-8 lg:py-16">
        <PageHeader
          eyebrow="Mon compte"
          title="Ce que le service sait de toi"
          lede="Tes identifiants, ton abonnement, et les droits que le RGPD te donne sur tes données."
        />

        <Panel className="p-6 sm:p-7">
          <h2 className="font-brand text-lg font-bold tracking-[-0.02em] text-paper">Identité</h2>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <Row label="Email" value={user.email ?? "—"} />
            <Row label="Compte créé le" value={formatDate(user.created_at)} />
            <Row
              label="CGU acceptées le"
              value={
                profile?.terms_accepted_at
                  ? formatDate(profile.terms_accepted_at)
                  : "Non tracé (compte antérieur au suivi de l'acceptation)"
              }
            />
          </dl>
        </Panel>

        <Panel className="mt-6 p-6 sm:p-7">
          <h2 className="font-brand text-lg font-bold tracking-[-0.02em] text-paper">Abonnement</h2>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <Row label="Palier" value={TIER_LABEL[profile?.subscription_tier ?? "starter"]} />
            {profile?.subscription_status ? (
              <Row label="Statut Stripe" value={profile.subscription_status} />
            ) : null}
            {profile?.subscription_current_period_end ? (
              <Row
                label="Période payée jusqu'au"
                value={formatDate(profile.subscription_current_period_end)}
              />
            ) : null}
          </dl>
          <div className="mt-5">
            {hasBilling ? (
              <ManageBillingButton className="inline-flex h-11 items-center justify-center rounded-full border border-white/[0.14] px-6 text-sm font-semibold text-paper transition-colors hover:border-signal-bright/50 hover:text-signal-bright" />
            ) : (
              <Link
                href="/tarifs"
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/[0.14] px-6 text-sm font-semibold text-paper transition-colors hover:border-signal-bright/50 hover:text-signal-bright"
              >
                Voir les paliers
              </Link>
            )}
          </div>
        </Panel>

        <Panel className="mt-6 p-6 sm:p-7">
          <h2 className="font-brand text-lg font-bold tracking-[-0.02em] text-paper">Tes données</h2>
          <p className="mt-3 text-sm leading-relaxed text-mist">
            Articles 15 et 20 du RGPD : tu peux récupérer à tout moment une copie complète de
            ce que Rivalys stocke sur toi, dans un format lisible par une machine. Le HTML brut
            des pages tierces récupérées n&rsquo;y figure pas — ce sont des copies de pages
            publiques, pas des données te concernant.
          </p>
          <div className="mt-5">
            <ExportDataButton />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-mist/80">
            Le détail des traitements, des sous-traitants et des durées de conservation est dans
            la{" "}
            <Link
              href="/confidentialite"
              className="font-medium text-signal-bright underline underline-offset-4"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </Panel>

        <DeleteAccountPanel hasSubscription={Boolean(profile?.stripe_customer_id)} />
      </div>
    </AppShell>
  );
}

const TIER_LABEL: Record<string, string> = {
  starter: "Starter (gratuit)",
  pro: "Pro",
  growth: "Growth",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[0.08] pb-3 last:border-0 last:pb-0">
      <dt className="text-mist">{label}</dt>
      <dd className="font-mono text-xs text-paper">{value}</dd>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
