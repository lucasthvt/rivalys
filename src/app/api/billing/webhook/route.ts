import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { getStripe, isStripeConfigured, statusGrantsAccess, tierForPriceId } from "@/lib/billing/stripe";
import type { SubscriptionTier } from "@/lib/supabase/database.types";

/**
 * POST /api/billing/webhook
 *
 * Seul endroit du produit qui écrit `profiles.subscription_tier`. L'accès aux résultats
 * d'analyse en dépend entièrement (voir src/lib/billing/access.ts), donc ce fichier décide
 * qui a payé.
 *
 * Trois règles portent cette responsabilité :
 *
 * 1. SIGNATURE D'ABORD. Le corps est lu en texte brut et vérifié avec le secret de
 *    signature avant toute lecture de son contenu. Sans cette vérification, n'importe qui
 *    connaissant l'URL s'offrirait le palier Growth avec un POST.
 *
 * 2. LE DROIT VIENT DU PRIX, PAS DES MÉTADONNÉES. Le palier accordé est déduit de
 *    l'identifiant de prix réellement facturé sur l'abonnement. Les métadonnées ne servent
 *    qu'à retrouver l'utilisateur : elles sont posées par nous, mais un abonnement peut
 *    être modifié depuis le Dashboard ou le portail client, et c'est la ligne facturée qui
 *    fait foi.
 *
 * 3. CLIENT SERVICE-ROLE. Aucune session utilisateur n'existe ici — la requête vient de
 *    Stripe. Les écritures passent donc par le client service-role, hors RLS, et sont
 *    toujours filtrées explicitement sur l'identifiant du profil concerné.
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ ok: false, error: "Stripe non configuré." }, { status: 503 });
  }

  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signingSecret) {
    console.error("[billing] STRIPE_WEBHOOK_SECRET absent — événement refusé.");
    return NextResponse.json({ ok: false, error: "Webhook non configuré." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "Signature absente." }, { status: 400 });
  }

  // Corps brut obligatoire : la signature porte sur les octets exacts envoyés par Stripe.
  // Un JSON reparsé puis re-sérialisé ne correspondrait plus.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, signingSecret);
  } catch (error) {
    console.error("[billing] signature de webhook invalide", error);
    return NextResponse.json({ ok: false, error: "Signature invalide." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        // Un paiement peut aboutir sans que l'abonnement soit encore lisible sur la
        // session : on relit l'abonnement chez Stripe plutôt que de déduire le palier de
        // ce qui traîne dans la session.
        if (typeof session.subscription === "string") {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription);
          await applySubscription(subscription, session.client_reference_id ?? null);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await applySubscription(event.data.object, null);
        break;
      }

      default:
        // Événement non traité : on répond 200 quand même. Un non-2xx ferait rejouer
        // l'événement par Stripe indéfiniment alors qu'il n'y a rien à en faire.
        break;
    }
  } catch (error) {
    // 500 volontaire : Stripe rejouera. Mieux vaut un événement retenté qu'un palier
    // laissé faux en silence.
    console.error(`[billing] traitement de ${event.type} échoué`, error);
    return NextResponse.json({ ok: false, error: "Traitement échoué." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/**
 * Écrit dans le profil ce que Stripe dit de l'abonnement.
 *
 * `fallbackUserId` ne sert qu'au tout premier paiement, quand le profil ne porte pas
 * encore d'identifiant client Stripe et qu'aucune métadonnée n'a survécu.
 */
async function applySubscription(
  subscription: Stripe.Subscription,
  fallbackUserId: string | null,
): Promise<void> {
  const supabase = createServiceClient();

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const userId = await resolveUserId(subscription, customerId, fallbackUserId);
  if (!userId) {
    // Rien à faire : un abonnement Stripe qui ne correspond à aucun profil (compte de
    // test, client créé à la main dans le Dashboard) ne doit pas faire échouer le webhook.
    console.warn(`[billing] abonnement ${subscription.id} sans profil correspondant.`);
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const paidTier = priceId ? tierForPriceId(priceId) : null;
  const active = statusGrantsAccess(subscription.status);

  // Le palier retombe à `starter` dès que l'abonnement cesse d'être actif, ou si le prix
  // facturé ne correspond à aucun de nos paliers — on n'accorde jamais un accès qu'on ne
  // peut pas relier à une ligne facturée.
  const tier: SubscriptionTier = active && paidTier ? paidTier : "starter";

  const periodEnd = subscription.items.data[0]?.current_period_end ?? null;

  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_tier: tier,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      subscription_current_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
    })
    .eq("id", userId);

  if (error) {
    // Remonté à l'appelant, qui renverra 500 pour que Stripe rejoue l'événement.
    throw new Error(`Mise à jour du profil ${userId} échouée : ${error.message}`);
  }
}

/** Retrouve le profil concerné, du signal le plus fiable au plus faible. */
async function resolveUserId(
  subscription: Stripe.Subscription,
  customerId: string,
  fallbackUserId: string | null,
): Promise<string | null> {
  const supabase = createServiceClient();

  // 1. Le client Stripe déjà rattaché à un profil — la seule source qui survit à une
  //    modification de l'abonnement depuis le Dashboard.
  const { data: byCustomer } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (byCustomer?.id) return byCustomer.id;

  // 2. Les métadonnées posées à la création de la session de Checkout.
  const fromMetadata = subscription.metadata?.user_id;
  if (typeof fromMetadata === "string" && fromMetadata) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", fromMetadata)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // 3. La référence client de la session, pour le tout premier paiement.
  if (fallbackUserId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", fallbackUserId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
}
