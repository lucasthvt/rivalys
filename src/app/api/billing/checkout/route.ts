import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAppUrl,
  getStripe,
  isBillingPeriod,
  isPaidTier,
  isStripeConfigured,
  resolvePriceId,
} from "@/lib/billing/stripe";

/**
 * POST /api/billing/checkout
 *
 * Ouvre une session Stripe Checkout hébergée pour le palier demandé et renvoie son URL.
 *
 * Checkout hébergé plutôt qu'un formulaire intégré, pour une raison précise : Apple Pay
 * et Google Pay y apparaissent automatiquement sur les appareils compatibles, sans avoir
 * à faire vérifier notre domaine auprès d'Apple. Le paiement se fait sur checkout.stripe.com,
 * qui est déjà un domaine vérifié.
 *
 * Aucun `payment_method_types` n'est passé : Stripe choisit dynamiquement les moyens
 * éligibles selon le client et la configuration du Dashboard. Le figer à ["card"]
 * supprimerait précisément Apple Pay.
 *
 * Corps attendu : { tier: "pro" | "growth", period: "monthly" | "yearly" }
 */
export async function POST(request: NextRequest) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requête invalide." }, { status: 400 });
  }

  const { tier, period } = (body ?? {}) as { tier?: string; period?: string };
  if (typeof tier !== "string" || !isPaidTier(tier)) {
    return NextResponse.json({ ok: false, error: "Palier inconnu." }, { status: 400 });
  }
  const billingPeriod = typeof period === "string" && isBillingPeriod(period) ? period : "monthly";

  const priceId = resolvePriceId(tier, billingPeriod);
  if (!priceId) {
    return NextResponse.json(
      { ok: false, error: "Ce palier n'a pas encore de tarif configuré." },
      { status: 503 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("stripe_customer_id, first_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { ok: false, error: "Impossible de lire ton profil." },
      { status: 500 },
    );
  }

  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Client existant réutilisé s'il y en a un : sans ça, un même utilisateur qui
      // repasse par Checkout se retrouve avec deux clients Stripe, deux abonnements, et
      // un webhook qui ne sait plus lequel décrit son accès.
      ...(profile?.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: user.email ?? undefined }),
      client_reference_id: user.id,
      // Portés jusque sur l'abonnement : le webhook reçoit des événements
      // `customer.subscription.*` qui ne connaissent pas la session de Checkout.
      subscription_data: { metadata: { user_id: user.id, tier } },
      metadata: { user_id: user.id, tier },
      allow_promotion_codes: true,
      // Étiquette de suivi dans le Dashboard Stripe, pour comparer les parcours.
      integration_identifier: "rivalys-checkout-qkzmwbtn",
      success_url: `${appUrl}/dashboard?paiement=ok`,
      cancel_url: `${appUrl}/tarifs?paiement=annule`,
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe n'a pas renvoyé d'URL de paiement." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, url: session.url });
  } catch (error) {
    // Le message d'erreur Stripe peut contenir des détails de compte : on le journalise
    // côté serveur et on renvoie une phrase neutre au navigateur.
    console.error("[billing] création de session Checkout échouée", error);
    return NextResponse.json(
      { ok: false, error: "Impossible d'ouvrir le paiement pour le moment." },
      { status: 502 },
    );
  }
}
