// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/competitors/__tests__/*.test.ts
// (le script `npm test` couvre ce dossier)

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { orderCompetitors, resolveSelectedCompetitor } from "../selection";

const PRIMARY = { id: "p", is_primary: true, created_at: "2026-08-20T10:00:00.000Z" };
const OLD = { id: "a", is_primary: false, created_at: "2026-08-01T10:00:00.000Z" };
const RECENT = { id: "b", is_primary: false, created_at: "2026-09-01T10:00:00.000Z" };

describe("orderCompetitors", () => {
  test("place le concurrent principal en tête, quel que soit son âge", () => {
    const ordered = orderCompetitors([OLD, RECENT, PRIMARY]);
    assert.deepEqual(
      ordered.map((competitor) => competitor.id),
      ["p", "a", "b"],
    );
  });

  test("ordonne les autres du plus ancien au plus récent", () => {
    const ordered = orderCompetitors([RECENT, OLD]);
    assert.deepEqual(
      ordered.map((competitor) => competitor.id),
      ["a", "b"],
    );
  });

  test("ne modifie pas le tableau reçu", () => {
    const input = [RECENT, PRIMARY];
    orderCompetitors(input);
    assert.deepEqual(
      input.map((competitor) => competitor.id),
      ["b", "p"],
    );
  });
});

describe("resolveSelectedCompetitor", () => {
  test("retourne null quand aucun concurrent n'est suivi", () => {
    assert.equal(resolveSelectedCompetitor([], "p"), null);
  });

  test("retourne le concurrent principal sans sélection demandée", () => {
    assert.equal(resolveSelectedCompetitor([OLD, PRIMARY, RECENT], null)?.id, "p");
  });

  test("honore la sélection demandée", () => {
    assert.equal(resolveSelectedCompetitor([OLD, PRIMARY, RECENT], "b")?.id, "b");
  });

  // Un lien partagé, un signet, ou une place remplacée : la sélection devient caduque.
  // Vider l'écran laisserait croire que l'analyse n'a rien trouvé.
  test("retombe sur le principal si l'identifiant demandé est inconnu", () => {
    assert.equal(resolveSelectedCompetitor([OLD, PRIMARY], "inconnu")?.id, "p");
  });

  // Cas réel : `setPrimaryCompetitor` éteint tous les principaux avant d'en rallumer un,
  // et un échec au milieu laisse zéro principal. La sélection doit rester déterministe.
  test("sans aucun principal, retombe sur le plus ancien", () => {
    assert.equal(resolveSelectedCompetitor([RECENT, OLD], null)?.id, "a");
  });
});
