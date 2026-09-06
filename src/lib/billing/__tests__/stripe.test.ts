// Run with: npm test

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getAppUrl,
  isBillingPeriod,
  isMissingCustomerError,
  isPaidTier,
  isStripeConfigured,
  resolvePriceId,
  statusGrantsAccess,
  tierForPriceId,
} from "../stripe";

/**
 * Ce fichier ne teste pas Stripe : il teste les décisions que NOUS prenons autour de
 * Stripe, et dont dépend l'accès aux résultats d'analyse.
 *
 * La plus importante est `tierForPriceId` : le webhook s'en sert pour accorder un palier
 * à partir de la ligne réellement facturée. Si elle renvoie un palier pour un prix qui
 * n'est pas le nôtre, n'importe quel abonnement Stripe ouvrirait l'accès.
 */

const PRICE_ENV = [
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
  "STRIPE_PRICE_GROWTH_MONTHLY",
  "STRIPE_PRICE_GROWTH_YEARLY",
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_APP_URL",
  "VERCEL_URL",
];

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of PRICE_ENV) {
    saved.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  saved.clear();
});

describe("resolvePriceId", () => {
  test("lit l'identifiant de prix dans l'environnement", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_m";
    assert.equal(resolvePriceId("pro", "monthly"), "price_pro_m");
  });

  test("renvoie null quand le prix n'est pas configuré", () => {
    assert.equal(resolvePriceId("growth", "yearly"), null);
  });

  test("traite une variable vide ou blanche comme absente", () => {
    process.env.STRIPE_PRICE_PRO_YEARLY = "   ";
    assert.equal(resolvePriceId("pro", "yearly"), null);
  });
});

describe("tierForPriceId", () => {
  test("associe chaque prix configuré à son palier", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_m";
    process.env.STRIPE_PRICE_PRO_YEARLY = "price_pro_y";
    process.env.STRIPE_PRICE_GROWTH_MONTHLY = "price_growth_m";

    assert.equal(tierForPriceId("price_pro_m"), "pro");
    assert.equal(tierForPriceId("price_pro_y"), "pro");
    assert.equal(tierForPriceId("price_growth_m"), "growth");
  });

  /**
   * Le garde-fou central du webhook : un prix qui n'est pas l'un des nôtres n'accorde
   * aucun palier. Sans ça, n'importe quel abonnement du compte Stripe (un test, un produit
   * annexe) ouvrirait l'accès complet.
   */
  test("renvoie null pour un prix qui ne nous appartient pas", () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_m";
    assert.equal(tierForPriceId("price_quelque_chose_dautre"), null);
  });

  test("renvoie null quand aucun prix n'est configuré", () => {
    assert.equal(tierForPriceId("price_pro_m"), null);
  });

  test("ne confond pas une variable vide avec le prix reçu", () => {
    // resolvePriceId renvoie null sur une variable vide : comparer null à "" accorderait
    // un palier à un abonnement sans prix.
    process.env.STRIPE_PRICE_PRO_MONTHLY = "";
    assert.equal(tierForPriceId(""), null);
  });
});

describe("statusGrantsAccess", () => {
  test("ouvre l'accès sur un abonnement actif ou en essai", () => {
    assert.equal(statusGrantsAccess("active"), true);
    assert.equal(statusGrantsAccess("trialing"), true);
  });

  test("laisse l'accès ouvert pendant les relances de paiement", () => {
    // Couper au premier échec punit surtout une carte expirée ; Stripe finira par passer
    // l'abonnement en canceled ou unpaid, et c'est là que l'accès se ferme.
    assert.equal(statusGrantsAccess("past_due"), true);
  });

  test("ferme l'accès sur les statuts terminaux", () => {
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      assert.equal(statusGrantsAccess(status), false, status);
    }
  });

  test("ferme l'accès sur un statut inconnu", () => {
    assert.equal(statusGrantsAccess("quelque_chose_de_nouveau"), false);
  });
});

describe("getAppUrl", () => {
  test("préfère l'URL explicite et retire la barre finale", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://rivalys.com/";
    assert.equal(getAppUrl(), "https://rivalys.com");
  });

  test("retombe sur l'URL de déploiement Vercel", () => {
    process.env.VERCEL_URL = "rivalys-preview.vercel.app";
    assert.equal(getAppUrl(), "https://rivalys-preview.vercel.app");
  });

  test("renvoie null plutôt que de deviner une URL", () => {
    // Une URL devinée renverrait l'utilisateur, après paiement, sur une adresse
    // injoignable depuis son téléphone.
    assert.equal(getAppUrl(), null);
  });
});

describe("gardes de type", () => {
  test("isPaidTier n'accepte que les paliers facturables", () => {
    assert.equal(isPaidTier("pro"), true);
    assert.equal(isPaidTier("growth"), true);
    assert.equal(isPaidTier("starter"), false);
    assert.equal(isPaidTier("enterprise"), false);
  });

  test("isBillingPeriod n'accepte que mensuel et annuel", () => {
    assert.equal(isBillingPeriod("monthly"), true);
    assert.equal(isBillingPeriod("yearly"), true);
    assert.equal(isBillingPeriod("weekly"), false);
  });

  test("isStripeConfigured suit la présence de la clé", () => {
    assert.equal(isStripeConfigured(), false);
    process.env.STRIPE_SECRET_KEY = "rk_test_x";
    assert.equal(isStripeConfigured(), true);
  });
});

describe("isMissingCustomerError", () => {
  // La forme réellement reçue en production, relevée dans les logs Vercel :
  // « No such customer: 'cus_…' », sur /api/billing/checkout comme sur /portal.
  const missingCustomer = {
    type: "StripeInvalidRequestError",
    code: "resource_missing",
    param: "customer",
    raw: { code: "resource_missing", param: "customer" },
  };

  test("reconnaît un client Stripe introuvable", () => {
    assert.equal(isMissingCustomerError(missingCustomer), true);
  });

  test("le reconnaît aussi quand seul `raw` porte le détail", () => {
    assert.equal(
      isMissingCustomerError({
        type: "StripeInvalidRequestError",
        raw: { code: "resource_missing", param: "customer" },
      }),
      true,
    );
  });

  // Le point qui compte : `resource_missing` sort aussi pour un PRIX inexistant. Détacher
  // le client dans ce cas effacerait un lien de facturation parfaitement valide pour une
  // erreur de configuration qui n'a rien à voir.
  test("ignore un prix introuvable", () => {
    assert.equal(
      isMissingCustomerError({
        type: "StripeInvalidRequestError",
        code: "resource_missing",
        param: "line_items[0][price]",
      }),
      false,
    );
  });

  test("ignore les autres erreurs Stripe et les valeurs vides", () => {
    assert.equal(
      isMissingCustomerError({ type: "StripeCardError", code: "card_declined" }),
      false,
    );
    assert.equal(isMissingCustomerError(new Error("réseau")), false);
    assert.equal(isMissingCustomerError(null), false);
    assert.equal(isMissingCustomerError(undefined), false);
  });
});
