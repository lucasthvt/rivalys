// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { detectAuthMethods, labelAuthMethods, missingAuthMethods } from "../auth-methods";

describe("detectAuthMethods — via les liens", () => {
  test("un lien vers le point d'entrée OAuth vaut preuve", () => {
    const found = detectAuthMethods({
      loginPageText: null,
      links: ["https://accounts.google.com/o/oauth2/auth?client_id=123"],
    });

    assert.deepEqual(found, ["google"]);
  });

  test("reconnaît Apple, Microsoft et GitHub à leur point d'entrée", () => {
    const found = detectAuthMethods({
      loginPageText: null,
      links: [
        "https://appleid.apple.com/auth/authorize",
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "https://github.com/login/oauth/authorize",
      ],
    });

    assert.deepEqual(found, ["apple", "microsoft", "github"]);
  });

  test("ignore un lien malformé ou non http(s)", () => {
    const found = detectAuthMethods({
      loginPageText: null,
      links: ["pas-une-url", "javascript:void(0)", "mailto:hello@example.com"],
    });

    assert.deepEqual(found, []);
  });
});

describe("detectAuthMethods — via le texte de la page de connexion", () => {
  test("reconnaît les boutons français et anglais", () => {
    assert.deepEqual(
      detectAuthMethods({ loginPageText: "Continuer avec Google", links: [] }),
      ["google"],
    );
    assert.deepEqual(
      detectAuthMethods({ loginPageText: "Sign in with Apple", links: [] }),
      ["apple"],
    );
  });

  test("reconnaît le SSO et le lien magique", () => {
    assert.deepEqual(
      detectAuthMethods({ loginPageText: "Connexion SSO pour les équipes", links: [] }),
      ["sso"],
    );
    assert.deepEqual(
      detectAuthMethods({ loginPageText: "Recevoir un lien magique par email", links: [] }),
      ["magic_link"],
    );
  });

  /**
   * Le faux positif que ces motifs existent pour éviter. Sur une page d'accueil,
   * « Google » parle d'une intégration neuf fois sur dix — c'est pourquoi le texte
   * confronté est celui de la page de connexion, et pourquoi le mot seul ne suffit pas.
   */
  test("le nom d'un fournisseur seul ne prouve rien", () => {
    const found = detectAuthMethods({
      loginPageText:
        "Synchronise tes fichiers avec Google Drive et Microsoft 365. Exporte vers GitHub.",
      links: [],
    });

    assert.deepEqual(found, []);
  });

  test("ne conclut rien quand aucune page de connexion n'a été lue", () => {
    assert.deepEqual(detectAuthMethods({ loginPageText: null, links: [] }), []);
  });

  test("sortie stable dans l'ordre d'AUTH_PROVIDERS, quel que soit l'ordre d'entrée", () => {
    const found = detectAuthMethods({
      loginPageText: "Sign in with GitHub. Continuer avec Google. Sign in with Apple.",
      links: [],
    });

    assert.deepEqual(found, ["google", "apple", "github"]);
  });

  test("ne compte pas deux fois un fournisseur trouvé par lien ET par texte", () => {
    const found = detectAuthMethods({
      loginPageText: "Continuer avec Google",
      links: ["https://accounts.google.com/o/oauth2/auth"],
    });

    assert.deepEqual(found, ["google"]);
  });
});

describe("missingAuthMethods", () => {
  test("ne renvoie que ce que le concurrent a en plus", () => {
    assert.deepEqual(missingAuthMethods(["google"], ["google", "apple"]), ["apple"]);
  });

  test("renvoie une liste vide quand nous sommes au moins à égalité", () => {
    assert.deepEqual(missingAuthMethods(["google", "apple"], ["google"]), []);
  });
});

describe("labelAuthMethods", () => {
  test("traduit les identifiants en libellés affichables", () => {
    assert.deepEqual(labelAuthMethods(["google", "sso"]), ["Google", "SSO / SAML"]);
  });

  test("laisse passer un identifiant inconnu sans planter", () => {
    assert.deepEqual(labelAuthMethods(["inconnu"]), ["inconnu"]);
  });
});
