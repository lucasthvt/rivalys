// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/billing/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildFreePreview } from "../free-preview";
import type { DetectedGap } from "@/components/tasks/priority";

type Input = Pick<DetectedGap, "category" | "title" | "description" | "priority"> & {
  created_at: string;
};

let clock = 0;
function gap(
  priority: Input["priority"],
  category: Input["category"],
  title = `écart ${priority} ${category}`,
): Input {
  // Des dates distinctes et décroissantes : le tri départage les égalités de priorité par
  // date, et deux écarts au même instant rendraient l'ordre du test indéterminé.
  clock += 1000;
  return {
    priority,
    category,
    title,
    description: `description de ${title}`,
    created_at: new Date(clock).toISOString(),
  };
}

describe("buildFreePreview", () => {
  test("sans écart, rien n'est offert et rien n'est caché", () => {
    const preview = buildFreePreview([]);
    assert.equal(preview.gapCount, 0);
    assert.equal(preview.featuredGap, null);
    assert.equal(preview.hiddenCount, 0);
    assert.deepEqual(preview.counts, { high: 0, medium: 0, low: 0 });
    assert.deepEqual(preview.hiddenCategories, []);
  });

  test("offre l'écart le plus prioritaire, pas le premier venu", () => {
    const preview = buildFreePreview([
      gap("low", "reviews"),
      gap("high", "pricing"),
      gap("medium", "social_presence"),
    ]);
    assert.equal(preview.featuredGap?.priority, "high");
    assert.equal(preview.featuredGap?.category, "pricing");
  });

  test("counts porte sur tous les écarts, offert compris", () => {
    const preview = buildFreePreview([
      gap("high", "pricing"),
      gap("high", "auth"),
      gap("medium", "reviews"),
    ]);
    assert.deepEqual(preview.counts, { high: 2, medium: 1, low: 0 });
    assert.equal(preview.gapCount, 3);
  });

  test("hiddenCounts exclut l'écart offert", () => {
    // Le cas qui comptait : trois écarts de même priorité. Déduire hiddenCounts de counts
    // côté écran annoncerait « 3 autres écarts prioritaires » alors qu'il n'en reste que 2,
    // l'un des trois étant déjà affiché en clair juste au-dessus.
    const preview = buildFreePreview([
      gap("high", "pricing"),
      gap("high", "auth"),
      gap("high", "payment"),
    ]);
    assert.deepEqual(preview.counts, { high: 3, medium: 0, low: 0 });
    assert.deepEqual(preview.hiddenCounts, { high: 2, medium: 0, low: 0 });
    assert.equal(preview.hiddenCount, 2);
  });

  test("hiddenCategories exclut la famille de l'écart offert quand il est seul dedans", () => {
    // Sinon l'écran écrit « les écarts restants touchent pricing et avis » là où le seul
    // écart restant porte sur les avis.
    const preview = buildFreePreview([gap("high", "pricing"), gap("low", "reviews")]);
    assert.deepEqual(preview.hiddenCategories, ["reviews"]);
  });

  test("hiddenCategories garde la famille de l'offert si un écart caché la partage", () => {
    const preview = buildFreePreview([
      gap("high", "pricing"),
      gap("medium", "pricing"),
      gap("low", "reviews"),
    ]);
    assert.deepEqual([...preview.hiddenCategories].sort(), ["pricing", "reviews"]);
  });

  test("ne laisse sortir AUCUN texte des écarts masqués", () => {
    // L'invariant de non-divulgation, et la seule raison d'être de ce module. Ce qui est
    // masqué n'est pas flouté côté navigateur : il ne doit pas y arriver du tout.
    const secret = "titre-qui-ne-doit-pas-sortir";
    // Un seul « high » : l'écart offert doit être désigné sans ambiguïté, sinon le départage
    // par date déciderait lequel des trois sort en clair et le test ne vérifierait rien.
    const preview = buildFreePreview([
      gap("high", "pricing", "offert"),
      gap("medium", "auth", secret),
      gap("low", "reviews", secret),
    ]);

    const serialized = JSON.stringify(preview);
    assert.ok(!serialized.includes(secret), "un écart masqué a fui dans la charge envoyée");
    assert.ok(serialized.includes("offert"), "l'écart offert doit bien être présent");
  });

  test("un écart unique est offert et ne laisse rien derrière le mur", () => {
    const preview = buildFreePreview([gap("medium", "payment")]);
    assert.equal(preview.featuredGap?.category, "payment");
    assert.equal(preview.hiddenCount, 0);
    assert.deepEqual(preview.hiddenCounts, { high: 0, medium: 0, low: 0 });
    assert.deepEqual(preview.hiddenCategories, []);
  });

  test("ne modifie pas le tableau reçu", () => {
    const gaps = [gap("low", "reviews"), gap("high", "pricing")];
    const before = gaps.map((g) => g.title);
    buildFreePreview(gaps);
    assert.deepEqual(
      gaps.map((g) => g.title),
      before,
    );
  });
});
