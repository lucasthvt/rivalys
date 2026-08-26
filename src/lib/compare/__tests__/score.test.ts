// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeScore, countByPriority } from "../score";
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
    // 10*8 + 5*4 + 2*5 = 100 -> exactly 0, still within bounds (not clamped)
    assert.equal(computeScore({ high: 8, medium: 4, low: 5 }), 0);
    // 10*9 + 5*4 + 2*5 = 120 -> would be -20 without clamping
    assert.equal(computeScore({ high: 9, medium: 4, low: 5 }), 0);
  });

  test("never exceeds 100 (upper clamp) even with zero counts", () => {
    const score = computeScore({ high: 0, medium: 0, low: 0 });
    assert.ok(score <= 100);
    assert.equal(score, 100);
  });
});
