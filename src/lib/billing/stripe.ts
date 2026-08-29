import Stripe from "stripe";
import type { SubscriptionTier } from "@/lib/supabase/database.types";

/**
 * Client Stripe, côté serveur uniquement.
 *
 * Construit paresseusement, jamais au chargement du module : importer ce fichier ne doit
 * pas jeter quand la clé est absente (le produit tourne sans facturation branchée). Seul
 * un appel réel échoue, et il échoue en le disant.
 *
 * La clé attendue est une clé restreinte (`rk_...`) avec les seules permissions
 * nécessaires — Checkout, Customers, Subscriptions, Billing Portal en écriture. Une clé
 * secrète (`sk_...`) marche aussi, mais donne à ce serveur bien plus de pouvoir que ce
 * qu'il utilise. Voir le README.
 */
let cached: Stripe | null = null;

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe n'est pas configuré (STRIPE_SECRET_KEY manquante).");
    this.name = "StripeNotConfiguredError";
  }
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeNotConfiguredError();

  if (!cached) {
    cached = new Stripe(key, {
      // Version épinglée : une montée de version de l'API Stripe change des formes de
      // payload, et le webhook lit ces formes. On la change en connaissance de cause.
      apiVersion: "2026-08-26.dahlia",
      appInfo: { name: "Rivalys" },
    });
  }
  return cached;
}

/** Paliers payants proposés au paiement. `starter` est gratuit, il n'a pas de prix. */
export type PaidTier = Exclude<SubscriptionTier, "starter">;
export type BillingPeriod = "monthly" | "yearly";

/**
 * Les identifiants de prix vivent dans l'environnement, jamais en dur.
 *
 * Ils diffèrent entre le mode test et le mode live : coder un `price_...` dans le dépôt
 * garantit qu'un jour la production facturera avec un prix de test, ou l'inverse.
 */
const PRICE_ENV_KEYS: Record<PaidTier, Record<BillingPeriod, string>> = {
  pro: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    yearly: "STRIPE_PRICE_PRO_YEARLY",
  },
  growth: {
    monthly: "STRIPE_PRICE_GROWTH_MONTHLY",
    yearly: "STRIPE_PRICE_GROWTH_YEARLY",
  },
};

export function resolvePriceId(tier: PaidTier, period: BillingPeriod): string | null {
  const envKey = PRICE_ENV_KEYS[tier]?.[period];
  if (!envKey) return null;
  return process.env[envKey]?.trim() || null;
}

/** Palier correspondant à un identifiant de prix Stripe, ou null s'il ne nous appartient pas. */
export function tierForPriceId(priceId: string): PaidTier | null {
  for (const tier of Object.keys(PRICE_ENV_KEYS) as PaidTier[]) {
    for (const period of ["monthly", "yearly"] as BillingPeriod[]) {
      if (resolvePriceId(tier, period) === priceId) return tier;
    }
  }
  return null;
}

export function isPaidTier(value: string): value is PaidTier {
  return value === "pro" || value === "growth";
}

export function isBillingPeriod(value: string): value is BillingPeriod {
  return value === "monthly" || value === "yearly";
}

/**
 * Statuts Stripe qui ouvrent l'accès.
 *
 * `past_due` en fait partie volontairement : le paiement a échoué mais Stripe relance
 * encore, et couper l'accès au premier échec punit surtout une carte expirée. Stripe
 * passera l'abonnement en `canceled` ou `unpaid` au bout de sa séquence de relances, et
 * c'est là que le palier retombe à `starter`.
 */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function statusGrantsAccess(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

/**
 * URL absolue de l'application, pour les retours de Checkout et du portail.
 *
 * Stripe redirige le navigateur vers ces URL : elles doivent être publiques et exactes.
 * On refuse de deviner — sans variable, l'appelant renvoie une erreur claire plutôt que
 * d'envoyer l'utilisateur sur un localhost injoignable depuis son téléphone.
 */
export function getAppUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  // Fourni automatiquement par Vercel sur les déploiements de prévisualisation.
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return null;
}
