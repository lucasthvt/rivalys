import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl, getStripe, isStripeConfigured } from "@/lib/billing/stripe";

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
    console.error("[billing] ouverture du portail échouée", error);
    return NextResponse.json(
      { ok: false, error: "Impossible d'ouvrir la gestion de l'abonnement." },
      { status: 502 },
    );
  }
}
