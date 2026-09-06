import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAppUrl,
  getStripe,
  isMissingCustomerError,
  isStripeConfigured,
} from "@/lib/billing/stripe";
import { forgetStripeCustomer } from "@/lib/billing/stale-customer";

/**
 * POST /api/billing/portal
 *
 * Ouvre le portail client Stripe : changement de carte, passage mensuel/annuel,
 * résiliation, factures. Rien de tout cela n'est réimplémenté ici — le portail gère les
 * prorata, les relances et la conformité, et une résiliation faite là-bas revient par le
 * même webhook que le reste.
 */
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Le paiement n'est pas encore ouvert." },
      { status: 503 },
    );
  }

  const appUrl = getAppUrl();
  if (!appUrl) {
    return NextResponse.json(
      { ok: false, error: "Configuration incomplète : URL publique de l'application absente." },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Non authentifié." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { ok: false, error: "Impossible de lire ton profil." },
      { status: 500 },
    );
  }

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { ok: false, error: "Aucun abonnement à gérer pour ce compte." },
      { status: 400 },
    );
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/dashboard`,
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    // Contrairement au paiement, le portail ne peut pas se rattraper : il n'existe pas de
    // portail « sans client ». On détache l'identifiant mort — ce qui fait retomber
    // l'écran Mon compte sur « Voir les paliers » au lieu d'un bouton qui échoue à chaque
    // clic — et on dit ce qui s'est passé plutôt que de renvoyer une panne générique.
    if (isMissingCustomerError(error)) {
      console.warn("[billing] client Stripe introuvable, identifiant détaché");
      await forgetStripeCustomer(user.id);
      return NextResponse.json(
        {
          ok: false,
          error:
            "Ton lien de facturation pointait un client Stripe qui n'existe plus. Il a été détaché : reprends un abonnement depuis la page Tarifs, ou écris-nous si tu penses payer encore.",
        },
        { status: 409 },
      );
    }

    console.error("[billing] ouverture du portail échouée", error);
    return NextResponse.json(
      { ok: false, error: "Impossible d'ouvrir la gestion de l'abonnement." },
      { status: 502 },
    );
  }
}
