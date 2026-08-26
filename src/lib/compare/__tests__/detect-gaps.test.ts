// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts
// (Node 22+ runs .ts files natively; the tiny loader registered above just lets its
// extensionless relative imports resolve to sibling .ts files — see that file for why.)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { detectPricingGaps, buildPositioningGap } from "../detect-gaps";
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

describe("detectPricingGaps", () => {
  test("flags a high-priority gap when competitor has a free trial and we don't", () => {
    const own = makeSite({ has_free_trial: false });
    const competitor = makeSite({ has_free_trial: true });

    const gaps = detectPricingGaps(own, competitor, "Concurrent X", true, true);

    const trialGap = gaps.find((g) => g.title.includes("essai gratuit"));
    assert.ok(trialGap, "expected a free-trial gap");
    assert.equal(trialGap?.category, "pricing");
    assert.equal(trialGap?.priority, "high");
    assert.match(trialGap!.description, /Concurrent X/);
  });

  test("does NOT flag a free-trial gap when we also have a free trial", () => {
    const own = makeSite({ has_free_trial: true });
    const competitor = makeSite({ has_free_trial: true });

    const gaps = detectPricingGaps(own, competitor, "Concurrent X", true, true);

    assert.ok(!gaps.some((g) => g.title.includes("essai gratuit")));
  });

  test("does NOT flag a free-trial gap when competitor doesn't have one either", () => {
    const own = makeSite({ has_free_trial: false });
    const competitor = makeSite({ has_free_trial: false });

    const gaps = detectPricingGaps(own, competitor, "Concurrent X", true, true);

    assert.ok(!gaps.some((g) => g.title.includes("essai gratuit")));
  });

  test("flags a high-priority gap when competitor has a free tier and we don't", () => {
    const own = makeSite({ has_free_tier: false });
    const competitor = makeSite({ has_free_tier: true });

    const gaps = detectPricingGaps(own, competitor, "Concurrent X", true, true);

    const tierGap = gaps.find((g) => g.title.includes("palier gratuit"));
    assert.ok(tierGap, "expected a free-tier gap");
    assert.equal(tierGap?.priority, "high");
  });

  test("flags a medium-priority gap when competitor has strictly more pricing tiers", () => {
    const own = makeSite({
      pricing_tiers: [{ name: "Starter", price: "9€", features: [] }],
    });
    const competitor = makeSite({
      pricing_tiers: [
        { name: "Starter", price: "9€", features: [] },
        { name: "Pro", price: "29€", features: [] },
        { name: "Enterprise", price: "Sur devis", features: [] },
      ],
    });

    const gaps = detectPricingGaps(own, competitor, "Concurrent X", true, true);

    const tierCountGap = gaps.find((g) => g.title.includes("plus de paliers"));
    assert.ok(tierCountGap, "expected a tier-count gap");
    assert.equal(tierCountGap?.priority, "medium");
    assert.match(tierCountGap!.description, /3 paliers/);
    assert.match(tierCountGap!.description, /1 pour toi/);
  });

  test("does NOT flag a tier-count gap when we have equal or more tiers", () => {
    const own = makeSite({
      pricing_tiers: [
        { name: "Starter", price: "9€", features: [] },
        { name: "Pro", price: "29€", features: [] },
      ],
    });
    const competitor = makeSite({
      pricing_tiers: [{ name: "Starter", price: "9€", features: [] }],
    });

    const gaps = detectPricingGaps(own, competitor, "Concurrent X", true, true);

    assert.ok(!gaps.some((g) => g.title.includes("plus de paliers")));
  });

  test("returns all three pricing gaps at once when every rule matches", () => {
    const own = makeSite({
      has_free_trial: false,
      has_free_tier: false,
      pricing_tiers: [{ name: "Starter", price: "9€", features: [] }],
    });
    const competitor = makeSite({
      has_free_trial: true,
      has_free_tier: true,
      pricing_tiers: [
        { name: "Free", price: "0€", features: [] },
        { name: "Starter", price: "9€", features: [] },
        { name: "Pro", price: "29€", features: [] },
      ],
    });

    const gaps = detectPricingGaps(own, competitor, "Concurrent X", true, true);

    assert.equal(gaps.length, 3);
    assert.deepEqual(
      gaps.map((g) => g.priority).sort(),
      ["high", "high", "medium"],
    );
  });

  test("falls back to a generic label when competitorLabel is empty", () => {
    const own = makeSite({ has_free_trial: false });
    const competitor = makeSite({ has_free_trial: true });

    const gaps = detectPricingGaps(own, competitor, "   ", true, true);

    assert.match(gaps[0].description, /ton concurrent/i);
  });

  test("returns no pricing gaps when our own pricing page wasn't found, even if every rule would otherwise match", () => {
    const own = makeSite({
      has_free_trial: false,
      has_free_tier: false,
      pricing_tiers: [{ name: "Starter", price: "9€", features: [] }],
    });
    const competitor = makeSite({
      has_free_trial: true,
      has_free_tier: true,
      pricing_tiers: [
        { name: "Free", price: "0€", features: [] },
        { name: "Starter", price: "9€", features: [] },
        { name: "Pro", price: "29€", features: [] },
      ],
    });

    // own's has_free_trial/has_free_tier: false are unverified defaults here (no pricing
    // page found), not a confirmed absence — must not be compared against the competitor.
    const gaps = detectPricingGaps(own, competitor, "Concurrent X", false, true);

    assert.deepEqual(gaps, []);
  });

  test("returns no pricing gaps when the competitor's pricing page wasn't found", () => {
    const own = makeSite({ has_free_trial: false });
    const competitor = makeSite({ has_free_trial: true });

    const gaps = detectPricingGaps(own, competitor, "Concurrent X", true, false);

    assert.deepEqual(gaps, []);
  });
});

describe("buildPositioningGap", () => {
  test("returns null when positioning is not flagged as very different", () => {
    const own = makeSite();
    const competitor = makeSite();

    const gap = buildPositioningGap(own, competitor, false, "Concurrent X");

    assert.equal(gap, null);
  });

  test("returns a low-priority positioning gap referencing both value propositions", () => {
    const own = makeSite({ value_proposition: "Pour les développeurs solo" });
    const competitor = makeSite({ value_proposition: "Pour les grandes entreprises" });

    const gap = buildPositioningGap(own, competitor, true, "Concurrent X");

    assert.ok(gap);
    assert.equal(gap?.category, "positioning");
    assert.equal(gap?.priority, "low");
    assert.match(gap!.description, /développeurs solo/);
    assert.match(gap!.description, /grandes entreprises/);
  });
});
