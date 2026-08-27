// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts
//
// No network here: lookupReviewPresence's only non-pure part is askPerplexity, so the
// response handling lives in parseReviewLookupResponse and is tested directly.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectReviewPlatformsFromLinks,
  isPlatformProfileUrl,
  labelReviewPlatforms,
  mergeReviewPlatforms,
  missingReviewPlatforms,
  parseReviewLookupResponse,
} from "../reviews";

describe("detectReviewPlatformsFromLinks", () => {
  test("detects a G2 profile link (the classic footer badge)", () => {
    assert.deepEqual(
      detectReviewPlatformsFromLinks(["https://www.g2.com/products/acme/reviews"]),
      ["g2"],
    );
  });

  test("ignores a bare link to the platform's root", () => {
    assert.deepEqual(
      detectReviewPlatformsFromLinks([
        "https://www.g2.com/",
        "https://capterra.com",
        "https://www.trustpilot.com/",
      ]),
      [],
    );
  });

  test("ignores category and search pages — they name no product", () => {
    assert.deepEqual(
      detectReviewPlatformsFromLinks([
        "https://www.g2.com/categories/crm",
        "https://www.capterra.com/project-management-software/",
        "https://www.producthunt.com/topics/saas",
      ]),
      [],
    );
  });

  test("ignores unrelated outbound links", () => {
    assert.deepEqual(
      detectReviewPlatformsFromLinks(["https://acme.com/blog", "https://stripe.com"]),
      [],
    );
  });

  test("ignores relative, malformed and non-http links", () => {
    assert.deepEqual(
      detectReviewPlatformsFromLinks([
        "/avis",
        "mailto:hello@acme.com",
        "javascript:void(0)",
        "not a url",
      ]),
      [],
    );
  });

  test("matches the capterra.fr host", () => {
    assert.deepEqual(
      detectReviewPlatformsFromLinks(["https://www.capterra.fr/logiciel/123456/acme"]),
      ["capterra"],
    );
  });

  test("matches the fr.trustpilot.com locale subdomain", () => {
    assert.deepEqual(
      detectReviewPlatformsFromLinks(["https://fr.trustpilot.com/review/acme.com"]),
      ["trustpilot"],
    );
  });

  test("returns platforms in a stable declaration order regardless of link order", () => {
    const found = detectReviewPlatformsFromLinks([
      "https://www.producthunt.com/posts/acme",
      "https://fr.trustpilot.com/review/acme.com",
      "https://www.g2.com/products/acme/reviews",
    ]);
    assert.deepEqual(found, ["g2", "trustpilot", "producthunt"]);
  });

  test("does not duplicate a platform linked twice on different hosts", () => {
    const found = detectReviewPlatformsFromLinks([
      "https://www.capterra.com/p/123456/Acme/",
      "https://www.capterra.fr/logiciel/123456/acme",
    ]);
    assert.deepEqual(found, ["capterra"]);
  });

  test("returns an empty list for no links at all", () => {
    assert.deepEqual(detectReviewPlatformsFromLinks([]), []);
  });
});

describe("isPlatformProfileUrl", () => {
  test("accepts a valid profile URL on the platform it names", () => {
    assert.equal(isPlatformProfileUrl("https://www.g2.com/products/acme/reviews", "g2"), true);
    assert.equal(
      isPlatformProfileUrl("https://www.capterra.com/p/123456/Acme/", "capterra"),
      true,
    );
    assert.equal(
      isPlatformProfileUrl("https://www.trustpilot.com/review/acme.com", "trustpilot"),
      true,
    );
    assert.equal(
      isPlatformProfileUrl("https://www.producthunt.com/products/acme", "producthunt"),
      true,
    );
  });

  test("rejects a real profile URL claimed for the WRONG platform", () => {
    assert.equal(isPlatformProfileUrl("https://www.capterra.com/p/123456/Acme/", "g2"), false);
    assert.equal(isPlatformProfileUrl("https://www.g2.com/products/acme/reviews", "trustpilot"), false);
  });

  test("rejects the platform's homepage", () => {
    assert.equal(isPlatformProfileUrl("https://www.g2.com/", "g2"), false);
    assert.equal(isPlatformProfileUrl("https://www.trustpilot.com", "trustpilot"), false);
  });

  test("rejects a non-profile path on the right host", () => {
    assert.equal(isPlatformProfileUrl("https://www.g2.com/categories/crm", "g2"), false);
    assert.equal(isPlatformProfileUrl("https://www.trustpilot.com/categories/bank", "trustpilot"), false);
  });

  test("rejects a lookalike host that merely contains the platform name", () => {
    assert.equal(isPlatformProfileUrl("https://g2.com.evil.example/products/acme", "g2"), false);
    assert.equal(isPlatformProfileUrl("https://notg2.com/products/acme", "g2"), false);
  });

  test("rejects a malformed or non-http URL", () => {
    assert.equal(isPlatformProfileUrl("g2.com/products/acme", "g2"), false);
    assert.equal(isPlatformProfileUrl("javascript:void(0)", "g2"), false);
  });

  test("keeps query strings (badge links carry utm params)", () => {
    assert.equal(
      isPlatformProfileUrl("https://www.g2.com/products/acme/reviews?utm_source=badge", "g2"),
      true,
    );
  });
});

describe("parseReviewLookupResponse", () => {
  test("keeps every entry whose URL verifies", () => {
    const raw = JSON.stringify([
      { platform: "g2", url: "https://www.g2.com/products/acme/reviews" },
      { platform: "capterra", url: "https://www.capterra.com/p/123456/Acme/" },
    ]);
    assert.deepEqual(parseReviewLookupResponse(raw), ["g2", "capterra"]);
  });

  test("DROPS an entry whose URL doesn't verify, keeping the ones that do", () => {
    // The model claims a Trustpilot listing but points at Trustpilot's homepage — an
    // unverifiable claim never becomes a task in the user's list.
    const raw = JSON.stringify([
      { platform: "g2", url: "https://www.g2.com/products/acme/reviews" },
      { platform: "trustpilot", url: "https://www.trustpilot.com/" },
    ]);
    assert.deepEqual(parseReviewLookupResponse(raw), ["g2"]);
  });

  test("drops an entry whose URL belongs to another platform than the one it names", () => {
    const raw = JSON.stringify([
      { platform: "g2", url: "https://www.capterra.com/p/123456/Acme/" },
    ]);
    assert.deepEqual(parseReviewLookupResponse(raw), []);
  });

  test("drops an unknown platform id", () => {
    const raw = JSON.stringify([
      { platform: "getapp", url: "https://www.getapp.com/p/123456/Acme/" },
    ]);
    assert.deepEqual(parseReviewLookupResponse(raw), []);
  });

  test("drops malformed entries (missing url, wrong types, nested arrays)", () => {
    const raw = JSON.stringify([
      { platform: "g2" },
      { platform: 42, url: "https://www.g2.com/products/acme" },
      { platform: "g2", url: 7 },
      ["g2", "https://www.g2.com/products/acme"],
      null,
    ]);
    assert.deepEqual(parseReviewLookupResponse(raw), []);
  });

  test("accepts a markdown-fenced answer", () => {
    const raw = '```json\n[{"platform": "producthunt", "url": "https://www.producthunt.com/posts/acme"}]\n```';
    assert.deepEqual(parseReviewLookupResponse(raw), ["producthunt"]);
  });

  test("returns [] — checked, found nothing — for a well-formed empty array", () => {
    assert.deepEqual(parseReviewLookupResponse("[]"), []);
  });

  test("returns null on malformed JSON: unusable answer means 'never checked'", () => {
    assert.equal(parseReviewLookupResponse("Je n'ai rien trouvé de fiable."), null);
    assert.equal(parseReviewLookupResponse('[{"platform": "g2",'), null);
  });

  test("returns null on a non-array JSON value", () => {
    assert.equal(parseReviewLookupResponse('{"platform": "g2"}'), null);
    assert.equal(parseReviewLookupResponse("null"), null);
  });

  test("returns null on a missing or blank answer (Perplexity failure path)", () => {
    assert.equal(parseReviewLookupResponse(null), null);
    assert.equal(parseReviewLookupResponse("   "), null);
  });

  test("normalizes the platform id's case and whitespace", () => {
    const raw = JSON.stringify([
      { platform: " G2 ", url: "https://www.g2.com/products/acme/reviews" },
    ]);
    assert.deepEqual(parseReviewLookupResponse(raw), ["g2"]);
  });

  test("returns platforms in declaration order, deduped", () => {
    const raw = JSON.stringify([
      { platform: "producthunt", url: "https://www.producthunt.com/posts/acme" },
      { platform: "g2", url: "https://www.g2.com/products/acme" },
      { platform: "g2", url: "https://www.g2.com/sellers/acme" },
    ]);
    assert.deepEqual(parseReviewLookupResponse(raw), ["g2", "producthunt"]);
  });
});

describe("missingReviewPlatforms", () => {
  test("returns the competitor's platforms we're not on", () => {
    assert.deepEqual(missingReviewPlatforms(["g2"], ["g2", "capterra", "trustpilot"]), [
      "capterra",
      "trustpilot",
    ]);
  });

  test("returns nothing when we match or exceed the competitor", () => {
    assert.deepEqual(missingReviewPlatforms(["g2", "capterra"], ["g2"]), []);
  });
});

describe("mergeReviewPlatforms", () => {
  test("unions both sources, deduped and in declaration order", () => {
    assert.deepEqual(mergeReviewPlatforms(["producthunt"], ["g2", "producthunt"]), [
      "g2",
      "producthunt",
    ]);
  });

  test("handles empty inputs", () => {
    assert.deepEqual(mergeReviewPlatforms([], []), []);
    assert.deepEqual(mergeReviewPlatforms([], ["capterra"]), ["capterra"]);
  });
});

describe("labelReviewPlatforms", () => {
  test("maps ids to display labels", () => {
    assert.deepEqual(labelReviewPlatforms(["g2", "producthunt"]), ["G2", "Product Hunt"]);
  });

  test("passes through an unknown id rather than dropping it", () => {
    assert.deepEqual(labelReviewPlatforms(["getapp"]), ["getapp"]);
  });
});
