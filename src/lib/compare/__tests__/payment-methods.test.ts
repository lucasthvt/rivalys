// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  followPurchaseLinks,
  detectPaymentMethods,
  detectPaymentProviders,
  labelPaymentMethods,
  labelPaymentProviders,
  missingPaymentMethods,
} from "../payment-methods";

function input(overrides: Partial<Parameters<typeof detectPaymentMethods>[0]> = {}) {
  return {
    pricingText: null,
    homepageText: "",
    links: [] as string[],
    html: null as string | null,
    ...overrides,
  };
}

describe("detectPaymentMethods — via les liens", () => {
  /**
   * Un prestataire n'est pas un moyen de paiement, et les confondre ferait affirmer au
   * produit ce qu'il ne peut pas voir : un site sous Stripe accepte la carte, ou la carte
   * ET Apple Pay, ET PayPal — cette configuration vit dans le Dashboard de son
   * propriétaire. Stripe est donc relevé comme prestataire, jamais comme moyen.
   */
  test("le SDK de paiement seul ne prouve aucun moyen précis", () => {
    assert.deepEqual(detectPaymentMethods(input({ links: ["https://js.stripe.com/v3/"] })), []);
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

describe("detectPaymentProviders", () => {
  /**
   * Le cas qui a motivé cette lecture : un SDK de paiement se charge par un `<script src>`,
   * pas par un `href`. En ne regardant que les liens, on ratait le signal le plus fiable
   * sur les sites dont le tunnel est derrière un clic — et l'écran affichait « rien
   * d'affiché publiquement » là où « paiement géré par Stripe » était vrai et utile.
   */
  test("un SDK chargé en <script src> est vu, alors qu'il n'est pas un lien", () => {
    assert.deepEqual(
      detectPaymentProviders({
        links: [],
        html: '<script src="https://js.stripe.com/v3" async></script>',
      }),
      ["stripe"],
    );
  });

  test("reconnaît un preconnect vers le prestataire", () => {
    assert.deepEqual(
      detectPaymentProviders({
        links: [],
        html: '<link rel="preconnect" href="https://paypal.com">',
      }),
      ["paypal"],
    );
  });

  test("reconnaît aussi un prestataire présent dans les liens", () => {
    assert.deepEqual(
      detectPaymentProviders({ links: ["https://checkout.paddle.com/x"], html: null }),
      ["paddle"],
    );
  });

  test("reconnaît Whop et Gumroad", () => {
    assert.deepEqual(
      detectPaymentProviders({ links: ["https://whop.com/mon-produit/"], html: null }),
      ["whop"],
    );
    assert.deepEqual(
      detectPaymentProviders({ links: [], html: '<a href="https://gumroad.com/l/x">' }),
      ["gumroad"],
    );
  });

  test("du balisage sans prestataire ne conclut rien", () => {
    assert.deepEqual(
      detectPaymentProviders({
        links: [],
        html: '<script src="https://www.clarity.ms/tag/x"></script>',
      }),
      [],
    );
  });

  test("traduit les identifiants en libellés affichables", () => {
    assert.deepEqual(labelPaymentProviders(["stripe", "paddle"]), ["Stripe", "Paddle"]);
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

describe("followPurchaseLinks", () => {
  const redirects: Record<string, string | null> = {
    "https://exemple.com/checkout": "https://checkout.stripe.com/c/pay/cs_test_123",
    "https://exemple.com/abonnement": "https://whop.com/mon-produit/",
    "https://exemple.com/blog": "https://exemple.com/blog/2026",
    "https://exemple.com/souscrire": "https://exemple.com/login",
  };

  const fetchUrl = async (url: string) => ({ location: redirects[url] ?? null });

  test("relève le prestataire vers lequel un bouton d'abonnement redirige", async () => {
    assert.deepEqual(
      await followPurchaseLinks(["https://exemple.com/checkout"], fetchUrl),
      ["stripe"],
    );
  });

  test("suit aussi les libellés français", async () => {
    assert.deepEqual(
      await followPurchaseLinks(["https://exemple.com/abonnement"], fetchUrl),
      ["whop"],
    );
  });

  test("ignore les liens qui ne ressemblent pas à un achat", async () => {
    assert.deepEqual(await followPurchaseLinks(["https://exemple.com/blog"], fetchUrl), []);
  });

  /**
   * Le cas le plus fréquent : le site exige un compte avant de payer. La redirection mène
   * à sa page de connexion, ce qui n'apprend rien — et ne doit donc rien affirmer.
   */
  test("une redirection vers la page de connexion ne conclut rien", async () => {
    assert.deepEqual(await followPurchaseLinks(["https://exemple.com/souscrire"], fetchUrl), []);
  });

  test("ne suit pas plus de deux liens", async () => {
    const visited: string[] = [];
    await followPurchaseLinks(
      [
        "https://exemple.com/checkout",
        "https://exemple.com/abonnement",
        "https://exemple.com/souscrire",
      ],
      async (url) => {
        visited.push(url);
        return { location: redirects[url] ?? null };
      },
    );
    assert.equal(visited.length, 2);
  });

  test("un lien injoignable est ignoré sans faire échouer le relevé", async () => {
    assert.deepEqual(
      await followPurchaseLinks(["https://exemple.com/checkout"], async () => {
        throw new Error("réseau");
      }),
      [],
    );
  });
});
