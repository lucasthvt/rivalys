// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectPaymentMethods,
  labelPaymentMethods,
  missingPaymentMethods,
} from "../payment-methods";

function input(overrides: Partial<Parameters<typeof detectPaymentMethods>[0]> = {}) {
  return {
    pricingText: null,
    homepageText: "",
    links: [] as string[],
    ...overrides,
  };
}

describe("detectPaymentMethods — via les liens", () => {
  test("le SDK de paiement chargé sur la page vaut carte bancaire", () => {
    assert.deepEqual(
      detectPaymentMethods(input({ links: ["https://js.stripe.com/v3/"] })),
      ["card"],
    );
  });

  test("reconnaît PayPal et le paiement fractionné à leur domaine", () => {
    assert.deepEqual(
      detectPaymentMethods(
        input({ links: ["https://www.paypal.com/sdk/js", "https://www.klarna.com/fr/"] }),
      ),
      ["paypal", "bnpl"],
    );
  });

  test("un sous-domaine compte, un domaine qui ressemble ne compte pas", () => {
    assert.deepEqual(
      detectPaymentMethods(input({ links: ["https://cdn.paypal.com/x.js"] })),
      ["paypal"],
    );
    assert.deepEqual(
      detectPaymentMethods(input({ links: ["https://notpaypal.com/x.js"] })),
      [],
    );
  });
});

describe("detectPaymentMethods — via le texte affiché", () => {
  test("lit les moyens annoncés sur la page de tarifs", () => {
    const found = detectPaymentMethods(
      input({ pricingText: "Nous acceptons Visa, Mastercard, PayPal et Apple Pay." }),
    );

    assert.deepEqual(found, ["card", "paypal", "apple_pay"]);
  });

  test("reconnaît les formulations françaises de virement et de facture", () => {
    const found = detectPaymentMethods(
      input({ pricingText: "Paiement sur facture ou par virement bancaire pour les entreprises." }),
    );

    assert.deepEqual(found, ["sepa", "invoice"]);
  });

  test("retombe sur la page d'accueil quand il n'y a pas de page de tarifs", () => {
    const found = detectPaymentMethods(
      input({ homepageText: "Paiement sécurisé par carte bancaire." }),
    );

    assert.deepEqual(found, ["card"]);
  });

  /**
   * Le cas qui compte le plus : ne RIEN trouver est une observation faible, pas une
   * conclusion. La liste vide remonte telle quelle, et c'est la règle d'écart puis
   * l'écran qui disent que le constat ne porte que sur l'affichage.
   */
  test("un site qui n'affiche aucun moyen de paiement renvoie une liste vide", () => {
    assert.deepEqual(
      detectPaymentMethods(input({ homepageText: "Le CRM le plus simple pour les indépendants." })),
      [],
    );
  });

  test("sortie stable dans l'ordre de PAYMENT_METHODS", () => {
    const found = detectPaymentMethods(
      input({ pricingText: "Google Pay, PayPal, Apple Pay, carte bancaire" }),
    );

    assert.deepEqual(found, ["card", "paypal", "apple_pay", "google_pay"]);
  });
});

describe("missingPaymentMethods", () => {
  test("ne renvoie que ce que le concurrent affiche en plus", () => {
    assert.deepEqual(missingPaymentMethods(["card"], ["card", "paypal"]), ["paypal"]);
  });
});

describe("labelPaymentMethods", () => {
  test("traduit les identifiants en libellés affichables", () => {
    assert.deepEqual(labelPaymentMethods(["card", "apple_pay"]), [
      "Carte bancaire",
      "Apple Pay",
    ]);
  });
});
