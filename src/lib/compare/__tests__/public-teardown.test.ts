// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { toPublicResult, type FullResult } from "../public-teardown";
import type { GapCandidate } from "../detect-gaps";
import type { GapPriority } from "@/lib/supabase/database.types";

/**
 * Ce que teste ce fichier est une frontière payante, pas une mise en forme.
 *
 * toPublicResult décide de ce qui sort vers une page publique. Une régression ici ne
 * casse rien de visible : elle offre simplement le contenu qu'on vend, et personne ne
 * s'en aperçoit avant d'avoir compté les inscriptions perdues.
 */

function gap(priority: GapPriority, seed: string): GapCandidate {
  return {
    category: "pricing",
    priority,
    title: `titre-${seed}`,
    description: `description-${seed}`,
  };
}

function full(...gaps: GapCandidate[]): FullResult {
  return {
    ownLabel: "toi.com",
    competitorLabel: "eux.com",
    score: 70,
    gaps,
    coverage: null,
  };
}

describe("toPublicResult — quel écart est offert", () => {
  test("montre le PLUS prioritaire", () => {
    const result = toPublicResult(full(gap("low", "l"), gap("medium", "m"), gap("high", "h")), false);

    assert.equal(result.featuredGap?.priority, "high");
    assert.equal(result.featuredGap?.title, "titre-h");
  });

  test("l'ordre d'entrée ne change rien", () => {
    const ascending = toPublicResult(full(gap("low", "l"), gap("medium", "m"), gap("high", "h")), false);
    const descending = toPublicResult(full(gap("high", "h"), gap("medium", "m"), gap("low", "l")), false);

    assert.equal(ascending.featuredGap?.title, "titre-h");
    assert.equal(descending.featuredGap?.title, "titre-h");
  });

  test("un seul écart : il est montré, rien n'est masqué", () => {
    const result = toPublicResult(full(gap("high", "seul")), false);

    assert.equal(result.featuredGap?.title, "titre-seul");
    assert.equal(result.hiddenCount, 0);
    assert.deepEqual(result.hiddenCounts, { high: 0, medium: 0, low: 0 });
    assert.deepEqual(result.hiddenCategories, []);
  });

  test("aucun écart : rien à montrer, rien à masquer", () => {
    const result = toPublicResult(full(), false);

    assert.equal(result.featuredGap, null);
    assert.equal(result.hiddenCount, 0);
    assert.deepEqual(result.hiddenCounts, { high: 0, medium: 0, low: 0 });
  });
});

describe("toPublicResult — décompte de ce qui reste caché", () => {
  test("compte les écarts masqués, pas tous les écarts", () => {
    const result = toPublicResult(
      full(gap("high", "h1"), gap("high", "h2"), gap("medium", "m"), gap("low", "l")),
      false,
    );

    assert.equal(result.hiddenCount, 3);
    // Un seul « high » reste caché : l'autre est celui qu'on offre.
    assert.deepEqual(result.hiddenCounts, { high: 1, medium: 1, low: 1 });
    // `counts` reste le total, écart offert compris — les deux ne disent pas la même chose.
    assert.deepEqual(result.counts, { high: 2, medium: 1, low: 1 });
  });

  test("toutes les priorités identiques : l'écart offert est décompté du masqué", () => {
    // Le cas qui casse un calcul fait côté navigateur à partir de `counts` : ici l'écart
    // montré EST prioritaire, donc il ne reste que deux prioritaires cachés, pas trois.
    const result = toPublicResult(
      full(gap("high", "a"), gap("high", "b"), gap("high", "c")),
      false,
    );

    assert.equal(result.featuredGap?.priority, "high");
    assert.equal(result.hiddenCount, 2);
    assert.deepEqual(result.hiddenCounts, { high: 2, medium: 0, low: 0 });
  });

  test("les familles annoncées sont celles des écarts masqués uniquement", () => {
    const result = toPublicResult(
      full(
        { ...gap("high", "h"), category: "reviews" },
        { ...gap("low", "l"), category: "pricing" },
      ),
      false,
    );

    // « reviews » est la famille de l'écart OFFERT : elle ne doit pas être annoncée comme
    // restant à découvrir.
    assert.deepEqual(result.hiddenCategories, ["pricing"]);
  });
});

describe("toPublicResult — le contenu masqué ne part pas", () => {
  test("aucun titre ni description d'un écart masqué n'apparaît dans la réponse", () => {
    const result = toPublicResult(
      full(gap("high", "offert"), gap("medium", "SECRET1"), gap("low", "SECRET2")),
      false,
    );

    // Sérialisé : c'est littéralement ce qui traverse le réseau. Un flou CSS n'aurait
    // aucun effet ici, et c'est le but du test — vérifier que rien n'est envoyé plutôt
    // que caché à l'affichage.
    const wire = JSON.stringify(result);

    assert.ok(!wire.includes("SECRET1"), "le titre d'un écart masqué est parti au client");
    assert.ok(!wire.includes("SECRET2"), "le titre d'un écart masqué est parti au client");
    assert.ok(wire.includes("offert"), "l'écart offert doit bien être envoyé");
  });
});
