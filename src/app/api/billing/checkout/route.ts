import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAppUrl,
  getStripe,
  isBillingPeriod,
  isMissingCustomerError,
  isPaidTier,
  isStripeConfigured,
  resolvePriceId,
} from "@/lib/billing/stripe";
import { forgetStripeCustomer } from "@/lib/billing/stale-customer";

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

  /**
   * La session, avec ou sans client existant.
   *
   * Client existant réutilisé s'il y en a un : sans ça, un même utilisateur qui repasse
   * par Checkout se retrouve avec deux clients Stripe, deux abonnements, et un webhook qui
   * ne sait plus lequel décrit son accès.
   */
  const openSession = (customerId: string | null) =>
    stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(customerId ? { customer: customerId } : { customer_email: user.email ?? undefined }),
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

  try {
    let session;
    try {
      session = await openSession(profile?.stripe_customer_id ?? null);
    } catch (error) {
      // Le client enregistré n'existe plus chez Stripe — identifiant d'un autre compte ou
      // d'un autre mode (voir isMissingCustomerError). Sans ce rattrapage, la personne ne
      // peut PLUS JAMAIS payer : chaque tentative rejoue le même identifiant mort.
      // On le détache et on rouvre la session comme pour un nouveau client ; le webhook
      // réécrira l'identifiant du compte courant à la fin du paiement.
      if (!isMissingCustomerError(error)) throw error;

      console.warn(
        "[billing] client Stripe introuvable, détaché puis paiement rouvert sans lui",
      );
      await forgetStripeCustomer(user.id);
      session = await openSession(null);
    }

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
