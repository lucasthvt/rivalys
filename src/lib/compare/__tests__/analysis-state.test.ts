// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { explainMissingSnapshot } from "../analysis-state";
import { ANALYSIS_COOLDOWN_MS } from "../rate-limit";

const NOW = new Date("2026-11-02T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

function ago(ms: number): Date {
  return new Date(NOW.getTime() - ms);
}

describe("explainMissingSnapshot", () => {
  test("aucune analyse n'a jamais tourné : en attente", () => {
    const reason = explainMissingSnapshot({ lastRunAt: null, trackedSince: ago(HOUR), now: NOW });
    assert.equal(reason.kind, "pending");
  });

  test("concurrent ajouté APRÈS la dernière analyse : en attente", () => {
    // La limite de /api/compare se lève dans ce cas précis (isNewPair), donc le bouton
    // marchera. Annoncer un échec serait faux.
    const reason = explainMissingSnapshot({
      lastRunAt: ago(3 * HOUR),
      trackedSince: ago(HOUR),
      now: NOW,
    });
    assert.equal(reason.kind, "pending");
  });

  test("analyse récente postérieure à l'ajout, sans relevé : échec du côté concurrent", () => {
    const lastRunAt = ago(2 * HOUR);
    const reason = explainMissingSnapshot({
      lastRunAt,
      trackedSince: ago(10 * HOUR),
      now: NOW,
    });
    assert.equal(reason.kind, "failed");
    if (reason.kind !== "failed") throw new Error("unreachable");
    assert.equal(reason.lastRunAt.getTime(), lastRunAt.getTime());
    assert.equal(reason.retryAt.getTime(), lastRunAt.getTime() + ANALYSIS_COOLDOWN_MS);
    assert.match(reason.retryIn, /h$/);
  });

  test("le délai annoncé est celui que le bouton fera respecter", () => {
    // L'écran et /api/compare doivent dire la même chose : c'est tout l'objet du module.
    const lastRunAt = ago(HOUR);
    const reason = explainMissingSnapshot({
      lastRunAt,
      trackedSince: ago(5 * HOUR),
      now: NOW,
    });
    if (reason.kind !== "failed") throw new Error("expected a failure");
    assert.equal(reason.retryIn, "23 h");
  });

  test("limite expirée : en attente, pas d'échec annoncé", () => {
    // L'analyse a bien échoué il y a deux jours, mais plus rien ne bloque : ce qui compte
    // maintenant est que le bouton marche, pas l'histoire ancienne.
    const reason = explainMissingSnapshot({
      lastRunAt: ago(ANALYSIS_COOLDOWN_MS + HOUR),
      trackedSince: ago(ANALYSIS_COOLDOWN_MS + 5 * HOUR),
      now: NOW,
    });
    assert.equal(reason.kind, "pending");
  });

  test("sans date de suivi connue, une analyse récente compte comme un échec", () => {
    // trackedSince absent ne doit pas se lire comme « ajouté à l'instant » : ce serait
    // promettre un bouton qui va refuser.
    const reason = explainMissingSnapshot({
      lastRunAt: ago(HOUR),
      trackedSince: null,
      now: NOW,
    });
    assert.equal(reason.kind, "failed");
  });
});
