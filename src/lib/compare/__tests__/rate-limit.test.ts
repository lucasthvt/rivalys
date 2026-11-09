// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  ANALYSIS_COOLDOWN_LABEL,
  ANALYSIS_COOLDOWN_MS,
  checkAnalysisRateLimit,
  formatRetryDelay,
  parseLastRunAt,
  rateLimitMessage,
  retryAfterSeconds,
  type AnalysisRateLimitDecision,
} from "../rate-limit";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const SECOND = 1000;

const LAST_RUN = new Date("2026-08-27T09:00:00.000Z");

function plus(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

/** Asserts the decision is a refusal and narrows it so `retryAt` is readable. */
function refusal(decision: AnalysisRateLimitDecision): { retryAt: Date } {
  assert.equal(decision.allowed, false, "expected the analysis to be refused");
  if (decision.allowed) throw new Error("unreachable");
  return decision;
}

describe("ANALYSIS_COOLDOWN_MS", () => {
  test("is exactly 7 days", () => {
    assert.equal(ANALYSIS_COOLDOWN_MS, 7 * 24 * HOUR);
  });

  test("its French label says the same duration", () => {
    assert.equal(ANALYSIS_COOLDOWN_LABEL, "7 jours");
  });
});

describe("parseLastRunAt", () => {
  test("parses a Postgres timestamptz string", () => {
    const parsed = parseLastRunAt("2026-08-27T09:00:00.000Z");
    assert.ok(parsed instanceof Date);
    assert.equal(parsed.getTime(), LAST_RUN.getTime());
  });

  test("returns null when the user has never run an analysis", () => {
    assert.equal(parseLastRunAt(null), null);
    assert.equal(parseLastRunAt(undefined), null);
    assert.equal(parseLastRunAt(""), null);
  });

  test("returns null for an unparseable value instead of an Invalid Date", () => {
    assert.equal(parseLastRunAt("pas une date"), null);
  });
});

describe("checkAnalysisRateLimit", () => {
  test("allows the very first analysis (never run before)", () => {
    assert.deepEqual(checkAnalysisRateLimit(null, LAST_RUN), { allowed: true });
  });

  test("allows the run rather than locking the user out on a corrupt timestamp", () => {
    const decision = checkAnalysisRateLimit(new Date("pas une date"), LAST_RUN);
    assert.deepEqual(decision, { allowed: true });
  });

  test("refuses just under the 7-day boundary, by a single millisecond", () => {
    const now = plus(LAST_RUN, ANALYSIS_COOLDOWN_MS - 1);
    const { retryAt } = refusal(checkAnalysisRateLimit(LAST_RUN, now));
    assert.equal(retryAt.getTime(), LAST_RUN.getTime() + ANALYSIS_COOLDOWN_MS);
  });

  test("refuses the day after — retryAt stays anchored on the last run, not on now", () => {
    const now = plus(LAST_RUN, 24 * HOUR);
    const { retryAt } = refusal(checkAnalysisRateLimit(LAST_RUN, now));
    assert.equal(retryAt.toISOString(), "2026-09-03T09:00:00.000Z");
  });

  test("allows exactly at the 7-day boundary (window is closed at its end)", () => {
    const now = plus(LAST_RUN, ANALYSIS_COOLDOWN_MS);
    assert.deepEqual(checkAnalysisRateLimit(LAST_RUN, now), { allowed: true });
  });

  test("allows just over the boundary", () => {
    const now = plus(LAST_RUN, ANALYSIS_COOLDOWN_MS + 1);
    assert.deepEqual(checkAnalysisRateLimit(LAST_RUN, now), { allowed: true });
  });

  test("allows again long after the cooldown", () => {
    assert.deepEqual(checkAnalysisRateLimit(LAST_RUN, plus(LAST_RUN, 30 * 24 * HOUR)), {
      allowed: true,
    });
  });

  test("a future-dated last run (clock skew) refuses rather than bypasses the limit", () => {
    const now = plus(LAST_RUN, -2 * HOUR);
    const { retryAt } = refusal(checkAnalysisRateLimit(LAST_RUN, now));
    assert.equal(retryAt.getTime(), LAST_RUN.getTime() + ANALYSIS_COOLDOWN_MS);
  });

  test("does not mutate the dates it is given", () => {
    const lastRun = new Date(LAST_RUN);
    const now = plus(LAST_RUN, HOUR);
    checkAnalysisRateLimit(lastRun, now);
    assert.equal(lastRun.getTime(), LAST_RUN.getTime());
    assert.equal(now.getTime(), LAST_RUN.getTime() + HOUR);
  });
});

describe("retryAfterSeconds", () => {
  test("a full cooldown is 604800 seconds", () => {
    const retryAt = plus(LAST_RUN, ANALYSIS_COOLDOWN_MS);
    assert.equal(retryAfterSeconds(retryAt, LAST_RUN), 604800);
  });

  test("rounds up to whole seconds so the header never sends the client back too early", () => {
    const now = plus(LAST_RUN, 0);
    assert.equal(retryAfterSeconds(plus(now, 1500), now), 2);
  });

  test("never returns 0 or a negative value", () => {
    const now = plus(LAST_RUN, HOUR);
    assert.equal(retryAfterSeconds(now, now), 1);
    assert.equal(retryAfterSeconds(plus(now, -5 * MINUTE), now), 1);
  });
});

describe("formatRetryDelay", () => {
  test("uses hours from 1 h up to a day", () => {
    assert.equal(formatRetryDelay(plus(LAST_RUN, 7 * HOUR), LAST_RUN), "7 h");
    assert.equal(formatRetryDelay(plus(LAST_RUN, HOUR), LAST_RUN), "1 h");
  });

  test("uses days from 24 h up, singular for one", () => {
    assert.equal(formatRetryDelay(plus(LAST_RUN, 24 * HOUR), LAST_RUN), "1 jour");
    assert.equal(formatRetryDelay(plus(LAST_RUN, 3 * 24 * HOUR), LAST_RUN), "3 jours");
    assert.equal(formatRetryDelay(plus(LAST_RUN, ANALYSIS_COOLDOWN_MS), LAST_RUN), "7 jours");
  });

  test("rounds days up too: 2 days and 1 hour left is announced as 3 days", () => {
    assert.equal(formatRetryDelay(plus(LAST_RUN, 2 * 24 * HOUR + HOUR), LAST_RUN), "3 jours");
  });

  test("uses minutes below one hour", () => {
    assert.equal(formatRetryDelay(plus(LAST_RUN, HOUR - 1), LAST_RUN), "60 min");
    assert.equal(formatRetryDelay(plus(LAST_RUN, 45 * MINUTE), LAST_RUN), "45 min");
    assert.equal(formatRetryDelay(plus(LAST_RUN, 90 * SECOND), LAST_RUN), "2 min");
  });

  test("rounds up, never announcing a shorter wait than the real one", () => {
    // 7 h 30 remaining must not read as "7 h", or the next click is refused again.
    assert.equal(formatRetryDelay(plus(LAST_RUN, 7 * HOUR + 30 * MINUTE), LAST_RUN), "8 h");
    assert.equal(formatRetryDelay(plus(LAST_RUN, 23 * HOUR + 59 * MINUTE), LAST_RUN), "24 h");
  });

  test("floors at 1 min for a wait under a minute or already elapsed", () => {
    assert.equal(formatRetryDelay(plus(LAST_RUN, 30 * SECOND), LAST_RUN), "1 min");
    assert.equal(formatRetryDelay(LAST_RUN, LAST_RUN), "1 min");
    assert.equal(formatRetryDelay(plus(LAST_RUN, -HOUR), LAST_RUN), "1 min");
  });
});

describe("rateLimitMessage", () => {
  test("tells the user when the next analysis is possible", () => {
    const message = rateLimitMessage(plus(LAST_RUN, 7 * HOUR), LAST_RUN);
    assert.equal(
      message,
      "Analyse déjà effectuée il y a moins de 7 jours. La prochaine sera possible dans 7 h.",
    );
  });

  test("switches to minutes when the wait is short", () => {
    const message = rateLimitMessage(plus(LAST_RUN, 12 * MINUTE), LAST_RUN);
    assert.ok(message.endsWith("dans 12 min."), message);
  });

  test("never exposes a raw timestamp", () => {
    const message = rateLimitMessage(plus(LAST_RUN, 7 * HOUR), LAST_RUN);
    assert.ok(!message.includes("2026"), message);
    assert.ok(!/\d{2}:\d{2}/.test(message), message);
  });
});
