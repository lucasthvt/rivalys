// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeScore, countByPriority, explainScore } from "../score";
import type { GapPriority } from "@/lib/supabase/database.types";

function gaps(...priorities: GapPriority[]): { priority: GapPriority }[] {
  return priorities.map((priority) => ({ priority }));
}

describe("countByPriority", () => {
  test("counts each priority bucket independently", () => {
    const counts = countByPriority(gaps("high", "high", "medium", "low", "low", "low"));
    assert.deepEqual(counts, { high: 2, medium: 1, low: 3 });
  });

  test("returns all zeros for an empty list", () => {
    assert.deepEqual(countByPriority([]), { high: 0, medium: 0, low: 0 });
  });
});

describe("computeScore", () => {
  test("no open gaps -> perfect score", () => {
    assert.equal(computeScore({ high: 0, medium: 0, low: 0 }), 100);
  });

  test("applies the documented weights: -10/high, -5/medium, -2/low", () => {
    assert.equal(computeScore({ high: 1, medium: 0, low: 0 }), 90);
    assert.equal(computeScore({ high: 0, medium: 1, low: 0 }), 95);
    assert.equal(computeScore({ high: 0, medium: 0, low: 1 }), 98);
    assert.equal(computeScore({ high: 2, medium: 1, low: 3 }), 100 - 20 - 5 - 6);
  });

  test("clamps at 0 when penalties exceed 100", () => {
    assert.equal(computeScore({ high: 11, medium: 0, low: 0 }), 0);
    // 10*8 + 5*4 = 100 -> exactly 0, still within bounds (not clamped)
    assert.equal(computeScore({ high: 8, medium: 4, low: 0 }), 0);
    // 10*9 + 5*4 + 2*5 = 120 -> would be -20 without clamping
    assert.equal(computeScore({ high: 9, medium: 4, low: 5 }), 0);
  });

  test("never exceeds 100 (upper clamp) even with zero counts", () => {
    const score = computeScore({ high: 0, medium: 0, low: 0 });
    assert.ok(score <= 100);
    assert.equal(score, 100);
  });
});

describe("explainScore", () => {
  test("the breakdown always agrees with computeScore", () => {
    const cases = [
      { high: 0, medium: 0, low: 0 },
      { high: 1, medium: 0, low: 0 },
      { high: 2, medium: 1, low: 3 },
      { high: 9, medium: 4, low: 5 },
    ];
    for (const counts of cases) {
      assert.equal(explainScore(counts).score, computeScore(counts));
    }
  });

  test("returns one line per priority, in high -> medium -> low order", () => {
    const { lines } = explainScore({ high: 2, medium: 1, low: 3 });
    assert.deepEqual(
      lines.map((l) => l.priority),
      ["high", "medium", "low"],
    );
  });

  test("each line multiplies its count by the documented weight", () => {
    const { lines } = explainScore({ high: 2, medium: 1, low: 3 });
    assert.deepEqual(lines, [
      { priority: "high", count: 2, pointsEach: 10, pointsLost: 20 },
      { priority: "medium", count: 1, pointsEach: 5, pointsLost: 5 },
      { priority: "low", count: 3, pointsEach: 2, pointsLost: 6 },
    ]);
  });

  test("totalLost sums the lines and matches 100 - score when not clamped", () => {
    const breakdown = explainScore({ high: 2, medium: 1, low: 3 });
    assert.equal(breakdown.totalLost, 31);
    assert.equal(breakdown.score, 100 - breakdown.totalLost);
    assert.equal(breakdown.clamped, false);
  });

  test("reports clamping when penalties exceed 100, keeping the real total", () => {
    // 10*9 + 5*4 + 2*5 = 120 : le score est bloqué à 0, mais l'utilisateur doit voir 120
    // pour comprendre que fermer un écart ne le fera pas remonter immédiatement.
    const breakdown = explainScore({ high: 9, medium: 4, low: 5 });
    assert.equal(breakdown.totalLost, 120);
    assert.equal(breakdown.score, 0);
    assert.equal(breakdown.clamped, true);
  });

  test("does not report clamping when penalties land exactly on 100", () => {
    // 10*8 + 5*4 = 100 pile : le score touche 0 sans dépasser, donc pas d'écrêtage.
    const breakdown = explainScore({ high: 8, medium: 4, low: 0 });
    assert.equal(breakdown.totalLost, 100);
    assert.equal(breakdown.score, 0);
    assert.equal(breakdown.clamped, false);
  });

  test("keeps zero-count lines so the full scale stays visible", () => {
    const { lines, totalLost } = explainScore({ high: 0, medium: 0, low: 0 });
    assert.equal(lines.length, 3);
    assert.ok(lines.every((l) => l.count === 0 && l.pointsLost === 0));
    assert.equal(totalLost, 0);
  });
});
