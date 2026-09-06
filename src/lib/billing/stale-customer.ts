import { createServiceClient } from "@/lib/supabase/service";

/**
 * Détache un identifiant client Stripe devenu introuvable. Serveur uniquement.
 *
 * Constaté en production : `No such customer: 'cus_…'` sur /api/billing/checkout ET sur
 * /api/billing/portal, pour le même compte. Un `cus_…` appartient à un compte Stripe et à
 * un mode donnés ; passer de test à live, ou changer de compte, laisse en base des
 * identifiants qui ne désignent plus rien. Les deux routes échouaient alors à chaque
 * tentative, sans issue depuis l'interface : impossible de payer, impossible d'ouvrir le
 * portail, et rien à l'écran pour dire pourquoi.
 *
 * Écrit avec la clé service_role : `stripe_customer_id` n'est pas accessible en écriture
 * au rôle `authenticated`, et c'est volontaire — y écrire l'identifiant d'un autre client
 * donnerait accès à ses factures et à sa carte (voir la migration 20260830000000).
 *
 * `subscription_tier` n'est PAS touché. Ce serait couper l'accès à quelqu'un dont
 * l'abonnement tourne peut-être encore sur l'ancien compte Stripe : un identifiant caduc
 * dit que le lien est cassé, pas que le paiement a cessé. Seul le webhook décide du palier.
 */
export async function forgetStripeCustomer(userId: string): Promise<void> {
  const { error } = await createServiceClient()
    .from("profiles")
    .update({ stripe_customer_id: null })
    .eq("id", userId);

  if (error) {
    // Journalisé sans être propagé : l'appelant a déjà une réponse utile à rendre, et
    // faire échouer un paiement qui pouvait aboutir serait pire que garder une ligne sale.
    console.error("[billing] détachement du client Stripe caduc échoué", error);
  }
}
