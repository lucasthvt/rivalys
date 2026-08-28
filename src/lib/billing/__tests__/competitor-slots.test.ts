// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/billing/__tests__/*.test.ts
// (le script `npm test` couvre ce dossier en plus de src/lib/compare/__tests__)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  checkCompetitorChange,
  COMPETITOR_CHANGE_COOLDOWN_DAYS,
  COMPETITOR_SLOTS,
  formatNextChangeDate,
} from "../competitor-slots";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-28T12:00:00.000Z");

describe("checkCompetitorChange", () => {
  test("autorise un premier remplacement — l'URL n'a jamais changé", () => {
    assert.deepEqual(checkCompetitorChange(null, NOW), { allowed: true });
  });

  test("refuse un remplacement à l'intérieur du délai", () => {
    const lastChange = new Date(NOW.getTime() - 5 * DAY_MS);
    const result = checkCompetitorChange(lastChange, NOW);

    assert.equal(result.allowed, false);
    assert.ok(!result.allowed && result.nextChangeAt instanceof Date);
    assert.equal(
      !result.allowed && result.nextChangeAt.getTime(),
      lastChange.getTime() + COMPETITOR_CHANGE_COOLDOWN_DAYS * DAY_MS,
    );
  });

  test("autorise à nouveau une fois le délai écoulé", () => {
    const lastChange = new Date(NOW.getTime() - (COMPETITOR_CHANGE_COOLDOWN_DAYS + 1) * DAY_MS);

    assert.deepEqual(checkCompetitorChange(lastChange, NOW), { allowed: true });
  });

  test("autorise pile à l'échéance, pas une seconde plus tard", () => {
    const lastChange = new Date(NOW.getTime() - COMPETITOR_CHANGE_COOLDOWN_DAYS * DAY_MS);
    assert.deepEqual(checkCompetitorChange(lastChange, NOW), { allowed: true });

    const oneSecondShort = new Date(lastChange.getTime() + 1000);
    assert.equal(checkCompetitorChange(oneSecondShort, NOW).allowed, false);
  });

  /**
   * Une date illisible en base ne doit pas verrouiller le compte : le délai existe pour
   * borner un coût, pas pour enfermer quelqu'un derrière une donnée corrompue.
   */
  test("autorise quand la date stockée est invalide", () => {
    assert.deepEqual(checkCompetitorChange(new Date("pas-une-date"), NOW), { allowed: true });
  });
});

describe("COMPETITOR_SLOTS", () => {
  test("une place sur les paliers à un concurrent, trois sur Growth", () => {
    assert.equal(COMPETITOR_SLOTS.starter, 1);
    assert.equal(COMPETITOR_SLOTS.pro, 1);
    assert.equal(COMPETITOR_SLOTS.growth, 3);
  });

  test("Growth ouvre strictement plus de places que Pro", () => {
    assert.ok(COMPETITOR_SLOTS.growth > COMPETITOR_SLOTS.pro);
  });
});

describe("formatNextChangeDate", () => {
  test("rend une date lisible en français", () => {
    assert.equal(formatNextChangeDate(new Date("2026-09-27T12:00:00.000Z")), "27 septembre 2026");
  });
});
