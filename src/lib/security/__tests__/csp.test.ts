// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/security/__tests__/*.test.ts
//
// Ces tests ne décrivent pas un comportement d'écran : ils décrivent une frontière de
// sécurité. Un test qui casse ici veut dire que quelqu'un a élargi la politique — pas que
// l'affichage a changé. C'est exactement pour ça qu'ils existent : élargir une CSP ne se
// voit nulle part à l'œil nu.

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { buildCsp } from "../csp";

const NONCE = "test-nonce-value";

/** Extrait une directive par son nom, sans le nom. */
function directive(csp: string, name: string): string | null {
  const found = csp
    .split("; ")
    .find((part) => part === name || part.startsWith(`${name} `));
  if (found === undefined) return null;
  return found === name ? "" : found.slice(name.length + 1);
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("buildCsp", () => {
  test("porte le nonce de la requête sur script-src", () => {
    const scriptSrc = directive(buildCsp({ nonce: NONCE, dev: false }), "script-src");
    assert.ok(scriptSrc?.includes(`'nonce-${NONCE}'`));
  });

  test("n'autorise jamais de script en ligne ni d'eval en production", () => {
    const scriptSrc = directive(buildCsp({ nonce: NONCE, dev: false }), "script-src") ?? "";
    // 'unsafe-inline' sur script-src rendrait le nonce décoratif : n'importe quelle
    // injection s'exécuterait. C'est la régression la plus coûteuse possible ici.
    assert.ok(!scriptSrc.includes("'unsafe-inline'"));
    assert.ok(!scriptSrc.includes("'unsafe-eval'"));
  });

  test("n'ouvre 'unsafe-eval' qu'en développement", () => {
    const dev = directive(buildCsp({ nonce: NONCE, dev: true }), "script-src") ?? "";
    assert.ok(dev.includes("'unsafe-eval'"));
  });

  test("interdit l'encadrement et les formulaires sortants", () => {
    const csp = buildCsp({ nonce: NONCE, dev: false });
    assert.equal(directive(csp, "frame-ancestors"), "'none'");
    assert.equal(directive(csp, "form-action"), "'self'");
    assert.equal(directive(csp, "base-uri"), "'self'");
    assert.equal(directive(csp, "object-src"), "'none'");
  });

  test("autorise Supabase en REST et en WebSocket", () => {
    const connectSrc = directive(buildCsp({ nonce: NONCE, dev: false }), "connect-src") ?? "";
    assert.ok(connectSrc.includes("https://project.supabase.co"));
    assert.ok(connectSrc.includes("wss://project.supabase.co"));
  });

  test("force le HTTPS en production, pas en développement", () => {
    assert.ok(buildCsp({ nonce: NONCE, dev: false }).includes("upgrade-insecure-requests"));
    assert.ok(!buildCsp({ nonce: NONCE, dev: true }).includes("upgrade-insecure-requests"));
  });

  describe("captcha absent", () => {
    test("ferme complètement frame-src", () => {
      assert.equal(directive(buildCsp({ nonce: NONCE, dev: false }), "frame-src"), "'none'");
    });

    test("n'autorise aucune origine Cloudflare", () => {
      const csp = buildCsp({ nonce: NONCE, dev: false });
      assert.ok(!csp.includes("challenges.cloudflare.com"));
    });
  });

  describe("captcha configuré", () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
    });

    test("ouvre l'iframe du widget, et elle seule", () => {
      // Le widget Turnstile s'affiche dans une iframe : sans cette ouverture, le captcha
      // est invisible et personne ne peut plus se connecter. Le test vérifie aussi que
      // l'ouverture reste limitée à cette origine.
      assert.equal(
        directive(buildCsp({ nonce: NONCE, dev: false }), "frame-src"),
        "https://challenges.cloudflare.com",
      );
    });

    test("autorise le script du widget", () => {
      const scriptSrc = directive(buildCsp({ nonce: NONCE, dev: false }), "script-src") ?? "";
      assert.ok(scriptSrc.includes("https://challenges.cloudflare.com"));
      // Le nonce et strict-dynamic restent en place : l'origine n'est là que pour les
      // navigateurs qui ignorent strict-dynamic.
      assert.ok(scriptSrc.includes("'strict-dynamic'"));
      assert.ok(scriptSrc.includes(`'nonce-${NONCE}'`));
    });

    test("autorise les appels réseau du widget", () => {
      const connectSrc = directive(buildCsp({ nonce: NONCE, dev: false }), "connect-src") ?? "";
      assert.ok(connectSrc.includes("https://challenges.cloudflare.com"));
    });
  });
});
