// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  detectPricingAdvantages,
  detectSocialAdvantage,
  detectAllAdvantages,
} from "../advantages";
import type { ExtractedSiteData } from "@/lib/supabase/database.types";

function makeSite(overrides: Partial<ExtractedSiteData> = {}): ExtractedSiteData {
  return {
    pricing_tiers: [
      { name: "Starter", price: "9€/mois", features: ["A"] },
      { name: "Pro", price: "29€/mois", features: ["A", "B"] },
    ],
    has_free_trial: false,
    has_free_tier: false,
    value_proposition: "Aide les équipes à gérer leurs tâches",
    target_audience: "Petites équipes",
    ...overrides,
  };
}

describe("detectPricingAdvantages", () => {
  test("flags a free trial we have and the competitor doesn't", () => {
    const own = makeSite({ has_free_trial: true });
    const competitor = makeSite({ has_free_trial: false });

    const found = detectPricingAdvantages(own, competitor, "Concurrent X", true, true);

    const trial = found.find((a) => a.title.includes("essai gratuit"));
    assert.ok(trial);
    assert.equal(trial?.category, "pricing");
    assert.match(trial!.description, /Concurrent X/);
  });

  test("is the exact mirror of the gap rule — no advantage when the competitor also has it", () => {
    const own = makeSite({ has_free_trial: true });
    const competitor = makeSite({ has_free_trial: true });

    const found = detectPricingAdvantages(own, competitor, "Concurrent X", true, true);

    assert.ok(!found.some((a) => a.title.includes("essai gratuit")));
  });

  test("flags a free tier we have and the competitor doesn't", () => {
    const found = detectPricingAdvantages(
      makeSite({ has_free_tier: true }),
      makeSite({ has_free_tier: false }),
      "Concurrent X",
      true,
      true,
    );

    assert.ok(found.some((a) => a.title.includes("palier gratuit")));
  });

  test("flags having strictly more pricing tiers, with both counts in the text", () => {
    const own = makeSite({
      pricing_tiers: [
        { name: "A", price: "9€", features: [] },
        { name: "B", price: "19€", features: [] },
        { name: "C", price: "29€", features: [] },
      ],
    });
    const competitor = makeSite({ pricing_tiers: [{ name: "A", price: "9€", features: [] }] });

    const found = detectPricingAdvantages(own, competitor, "Concurrent X", true, true);
    const tiers = found.find((a) => a.title.includes("paliers"));

    assert.ok(tiers);
    assert.match(tiers!.description, /3 paliers/);
    assert.match(tiers!.description, /1 pour/);
  });

  test("does NOT flag a tier advantage on an equal count", () => {
    const found = detectPricingAdvantages(makeSite(), makeSite(), "Concurrent X", true, true);
    assert.ok(!found.some((a) => a.title.includes("paliers")));
  });

  test("returns nothing when our pricing page wasn't found", () => {
    // Our has_free_trial: true would be an unverified default here, not a confirmed fact.
    const found = detectPricingAdvantages(
      makeSite({ has_free_trial: true }),
      makeSite({ has_free_trial: false }),
      "Concurrent X",
      false,
      true,
    );

    assert.deepEqual(found, []);
  });

  test("returns nothing when the competitor's pricing page wasn't found", () => {
    const found = detectPricingAdvantages(
      makeSite({ has_free_trial: true }),
      makeSite({ has_free_trial: false }),
      "Concurrent X",
      true,
      false,
    );

    assert.deepEqual(found, []);
  });
});

describe("detectSocialAdvantage", () => {
  test("flags platforms we link to that the competitor doesn't", () => {
    const adv = detectSocialAdvantage(["linkedin", "youtube"], ["linkedin"], "Concurrent X", true);

    assert.ok(adv);
    assert.equal(adv?.category, "social_presence");
    assert.match(adv!.description, /YouTube/);
    assert.ok(!adv!.description.includes("LinkedIn"));
  });

  test("returns null when the competitor matches or exceeds us", () => {
    assert.equal(detectSocialAdvantage(["linkedin"], ["linkedin", "x"], "C", true), null);
  });

  test("returns null when a site wasn't observed", () => {
    assert.equal(detectSocialAdvantage(["linkedin"], [], "C", false), null);
  });
});

describe("detectAllAdvantages", () => {
  test("combines pricing and social advantages", () => {
    const found = detectAllAdvantages({
      own: makeSite({ has_free_trial: true }),
      competitor: makeSite({ has_free_trial: false }),
      competitorLabel: "Concurrent X",
      ownPricingFound: true,
      competitorPricingFound: true,
      ownPlatforms: ["linkedin"],
      competitorPlatforms: [],
      bothSitesObserved: true,
    });

    assert.equal(found.length, 2);
    assert.deepEqual(
      found.map((a) => a.category),
      ["pricing", "social_presence"],
    );
  });

  test("returns an empty list when we lead on nothing", () => {
    const found = detectAllAdvantages({
      own: makeSite(),
      competitor: makeSite(),
      competitorLabel: "Concurrent X",
      ownPricingFound: true,
      competitorPricingFound: true,
      ownPlatforms: [],
      competitorPlatforms: [],
      bothSitesObserved: true,
    });

    assert.deepEqual(found, []);
  });
});
