// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildFaceOffRows } from "@/components/dashboard/face-off-rows";
import type { ExtractedSiteData } from "@/lib/supabase/database.types";

/**
 * Cette fonction décide si une ligne du relevé annonce un écart, un alignement, ou une
 * absence de mesure. Se tromper entre les deux derniers affiche « rien à rattraper » là où
 * on n'a simplement rien lu — exactement le genre d'affirmation que le produit s'interdit.
 */

function site(over: Partial<ExtractedSiteData> = {}): ExtractedSiteData {
  return {
    pricing_tiers: [],
    has_free_trial: false,
    has_free_tier: false,
    value_proposition: "",
    target_audience: "",
    ...over,
  } as ExtractedSiteData;
}

function tiers(n: number) {
  return Array.from({ length: n }, (_, i) => ({ name: `P${i}`, price: "10 €", features: [] }));
}

function rowOf(rows: ReturnType<typeof buildFaceOffRows>, key: string) {
  const row = rows.find((r) => r.key === key);
  assert.ok(row, `ligne « ${key} » absente`);
  return row;
}

describe("buildFaceOffRows — les trois états d'une ligne", () => {
  test("un côté non relevé donne « unmeasured », jamais « aligned »", () => {
    const rows = buildFaceOffRows({ own: site({ pricing_tiers: tiers(3) }), competitor: null });

    assert.equal(rowOf(rows, "tiers").state, "unmeasured");
    assert.equal(rowOf(rows, "trial").state, "unmeasured");
    assert.equal(rowOf(rows, "tiers").gapLabel, null);
  });

  test("deux valeurs égales donnent « aligned », sans cote", () => {
    const rows = buildFaceOffRows({
      own: site({ pricing_tiers: tiers(3) }),
      competitor: site({ pricing_tiers: tiers(3) }),
    });

    assert.equal(rowOf(rows, "tiers").state, "aligned");
    assert.equal(rowOf(rows, "tiers").gapLabel, null);
  });

  test("un écart de comptage est coté avec son unité", () => {
    const rows = buildFaceOffRows({
      own: site({ pricing_tiers: tiers(2) }),
      competitor: site({ pricing_tiers: tiers(5) }),
    });

    const row = rowOf(rows, "tiers");
    assert.equal(row.state, "gap");
    assert.equal(row.gapLabel, "3 paliers");
    assert.equal(row.behind, true);
  });

  test("un écart d'une seule unité reste au singulier", () => {
    const rows = buildFaceOffRows({
      own: site({ pricing_tiers: tiers(2) }),
      competitor: site({ pricing_tiers: tiers(3) }),
    });

    assert.equal(rowOf(rows, "tiers").gapLabel, "1 palier");
  });

  test("mener sur une ligne n'est pas être en retard", () => {
    const rows = buildFaceOffRows({
      own: site({ pricing_tiers: tiers(5) }),
      competitor: site({ pricing_tiers: tiers(2) }),
    });

    const row = rowOf(rows, "tiers");
    assert.equal(row.state, "gap");
    assert.equal(row.behind, false);
  });

  test("zéro observé est une mesure, pas une absence", () => {
    const rows = buildFaceOffRows({
      own: site(),
      competitor: site({ pricing_tiers: tiers(2) }),
      ownMethods: { auth: [], payment: [], paymentProviders: null },
      competitorMethods: { auth: ["google"], payment: [], paymentProviders: null },
    });

    // auth : 0 contre 1 — un écart, pas un « non relevé ».
    assert.equal(rowOf(rows, "auth").state, "gap");
    assert.equal(rowOf(rows, "auth").gapLabel, "1 méthode");
    // payment : 0 des deux côtés — aligné.
    assert.equal(rowOf(rows, "payment").state, "aligned");
  });

  test("des méthodes non observées ne se comparent pas", () => {
    const rows = buildFaceOffRows({
      own: site(),
      competitor: site(),
      ownMethods: { auth: null, payment: null, paymentProviders: null },
      competitorMethods: { auth: ["google"], payment: null, paymentProviders: null },
    });

    assert.equal(rowOf(rows, "auth").state, "unmeasured");
  });
});

describe("buildFaceOffRows — les booléens", () => {
  test("le concurrent a l'essai gratuit, pas toi", () => {
    const rows = buildFaceOffRows({
      own: site({ has_free_trial: false }),
      competitor: site({ has_free_trial: true }),
    });

    const row = rowOf(rows, "trial");
    assert.equal(row.state, "gap");
    assert.equal(row.gapLabel, "Manquant chez toi");
    assert.equal(row.behind, true);
    assert.equal(row.own.value, "Non");
    assert.equal(row.competitor.value, "Oui");
  });

  test("l'avoir quand il ne l'a pas n'est pas un retard", () => {
    const rows = buildFaceOffRows({
      own: site({ has_free_tier: true }),
      competitor: site({ has_free_tier: false }),
    });

    const row = rowOf(rows, "free-tier");
    assert.equal(row.gapLabel, "Tu es devant");
    assert.equal(row.behind, false);
  });
});

describe("buildFaceOffRows — chaque côté garde son propre détail", () => {
  test("des comptages identiques n'échangent pas les noms de paliers", () => {
    const rows = buildFaceOffRows({
      own: site({ pricing_tiers: [{ name: "MonPalier", price: "9 €", features: [] }] }),
      competitor: site({ pricing_tiers: [{ name: "SonPalier", price: "9 €", features: [] }] }),
    });

    const row = rowOf(rows, "tiers");
    assert.match(row.own.detail ?? "", /MonPalier/);
    assert.match(row.competitor.detail ?? "", /SonPalier/);
  });
});
