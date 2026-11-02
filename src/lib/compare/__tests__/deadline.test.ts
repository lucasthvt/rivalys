// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ANALYSIS_BUDGET_MS, startDeadline, UNBOUNDED } from "../deadline";

/** Horloge manuelle : le temps n'avance que quand le test le dit. */
function fakeClock(start = 1_000_000) {
  let current = start;
  return {
    now: () => current,
    advance(ms: number) {
      current += ms;
    },
  };
}

describe("startDeadline", () => {
  test("part avec tout le budget", () => {
    const clock = fakeClock();
    const deadline = startDeadline(10_000, clock.now);
    assert.equal(deadline.remainingMs(), 10_000);
  });

  test("décompte le temps écoulé", () => {
    const clock = fakeClock();
    const deadline = startDeadline(10_000, clock.now);
    clock.advance(4_000);
    assert.equal(deadline.remainingMs(), 6_000);
  });

  test("ne descend jamais sous zéro", () => {
    const clock = fakeClock();
    const deadline = startDeadline(10_000, clock.now);
    clock.advance(45_000);
    assert.equal(deadline.remainingMs(), 0);
  });

  test("capTimeout rend le délai demandé quand le budget est large", () => {
    const clock = fakeClock();
    const deadline = startDeadline(30_000, clock.now);
    assert.equal(deadline.capTimeout(8_000), 8_000);
  });

  test("capTimeout rabat le délai sur ce qui reste", () => {
    const clock = fakeClock();
    const deadline = startDeadline(10_000, clock.now);
    clock.advance(7_000);
    assert.equal(deadline.capTimeout(8_000), 3_000);
  });

  test("capTimeout garde un plancher : un appel obligatoire part toujours", () => {
    const clock = fakeClock();
    const deadline = startDeadline(10_000, clock.now);
    clock.advance(10_000);
    // Budget épuisé, mais l'appel reçoit de quoi aboutir dans le meilleur des cas plutôt
    // qu'un délai de zéro, qui l'annulerait avant même son départ.
    assert.ok(deadline.capTimeout(8_000) > 0);
  });

  test("capTimeout divise le budget par le nombre de tentatives", () => {
    // Le trou qui faisait dépasser les 30 s : le SDK applique le MÊME délai à chaque
    // tentative, et il le reçoit une seule fois. Deux tentatives à 16 s, c'est 32 s — plus
    // que le budget entier. Le délai rendu doit donc tenir compte des réessais.
    const clock = fakeClock();
    const deadline = startDeadline(20_000, clock.now);
    assert.equal(deadline.capTimeout(16_000, 2), 10_000);
    assert.ok(deadline.capTimeout(16_000, 2) * 2 <= deadline.remainingMs());
  });

  test("capTimeout sans tentatives déclarées se comporte comme avant", () => {
    const clock = fakeClock();
    const deadline = startDeadline(20_000, clock.now);
    assert.equal(deadline.capTimeout(16_000), 16_000);
    assert.equal(deadline.capTimeout(16_000, 1), 16_000);
  });

  test("capTimeout rend TOUJOURS un entier", () => {
    // Le SDK Anthropic refuse un délai à virgule (« timeout must be an integer ») et
    // transforme l'appel en erreur réseau. La division par le nombre de tentatives en
    // produisait un dès que les millisecondes restantes étaient impaires : une extraction
    // sur deux échouait, au hasard de l'horloge, et le relevé du site tombait avec elle.
    for (const budget of [20_001, 19_999, 13_333, 7, 1]) {
      for (const attempts of [1, 2, 3]) {
        const deadline = startDeadline(budget, fakeClock().now);
        const value = deadline.capTimeout(16_000, attempts);
        assert.ok(
          Number.isInteger(value),
          `budget ${budget} sur ${attempts} tentatives a rendu ${value}`,
        );
      }
    }
  });

  test("hasRoomFor autorise tant que le budget couvre l'étage", () => {
    const clock = fakeClock();
    const deadline = startDeadline(10_000, clock.now);
    assert.equal(deadline.hasRoomFor(6_000), true);
    clock.advance(5_000);
    assert.equal(deadline.hasRoomFor(6_000), false);
    assert.equal(deadline.hasRoomFor(5_000), true);
  });

  test("hasRoomFor refuse tout étage optionnel une fois le budget épuisé", () => {
    const clock = fakeClock();
    const deadline = startDeadline(10_000, clock.now);
    clock.advance(10_000);
    assert.equal(deadline.hasRoomFor(1), false);
  });

  test("le budget par défaut tient la promesse des 30 s", () => {
    // La valeur elle-même est un engagement produit : l'analyse doit rester sous 30 s, et
    // le budget réseau doit laisser de la place aux écritures en base et au démarrage de la
    // fonction. Un relèvement silencieux au-delà casserait la promesse sans rien signaler.
    assert.ok(ANALYSIS_BUDGET_MS < 30_000);
  });
});

describe("UNBOUNDED", () => {
  test("ne borne rien", () => {
    assert.equal(UNBOUNDED.capTimeout(120_000), 120_000);
    assert.equal(UNBOUNDED.hasRoomFor(600_000), true);
    assert.equal(UNBOUNDED.remainingMs(), Number.POSITIVE_INFINITY);
  });
});
