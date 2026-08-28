// Run with:
//   node --import ./src/lib/compare/__tests__/register-ts-extensions.mjs --test src/lib/compare/__tests__/*.test.ts

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  assessPricingCoverage,
  publishesPricing,
  type PricingObservation,
} from "../comparability";

const WITH_PRICING: PricingObservation = { pageFound: true, tierCount: 3 };
const NO_PAGE: PricingObservation = { pageFound: false, tierCount: 0 };
const EMPTY_PAGE: PricingObservation = { pageFound: true, tierCount: 0 };

describe("publishesPricing", () => {
  test("un palier extrait suffit, même sans page de tarifs dédiée", () => {
    assert.equal(publishesPricing({ pageFound: false, tierCount: 1 }), true);
  });

  test("une page de tarifs sans aucun prix ne compte pas", () => {
    // Le cas « devis gratuit » : la page existe, elle n'annonce aucun montant. C'est
    // précisément la situation qui produisait un comparatif vide sans explication.
    assert.equal(publishesPricing(EMPTY_PAGE), false);
  });

  test("ni page ni palier", () => {
    assert.equal(publishesPricing(NO_PAGE), false);
  });
});

describe("assessPricingCoverage", () => {
  test("les deux côtés publient leurs prix : rien à signaler", () => {
    assert.equal(assessPricingCoverage(WITH_PRICING, WITH_PRICING, "Acme"), null);
  });

  test("son propre site n'affiche aucun prix : avertit que l'outil ne lui convient peut-être pas", () => {
    const notice = assessPricingCoverage(NO_PAGE, WITH_PRICING, "Acme");
    assert.ok(notice);
    assert.equal(notice.scope, "own");
    assert.equal(notice.observations.length, 1);
    assert.match(notice.observations[0], /ton site/);
    assert.ok(notice.fitWarning);
    assert.match(notice.fitWarning, /devis/);
  });

  test("seul le concurrent n'affiche aucun prix : pas d'avertissement d'inadéquation", () => {
    const notice = assessPricingCoverage(WITH_PRICING, NO_PAGE, "Acme");
    assert.ok(notice);
    assert.equal(notice.scope, "competitor");
    // Le message doit nommer le concurrent, pas parler du site de l'utilisateur.
    assert.match(notice.observations[0], /Acme/);
    assert.doesNotMatch(notice.observations[0], /ton site/);
    // Un SaaS enterprise en « contact commercial » n'est pas un défaut de l'utilisateur :
    // lui suggérer que Rivalys ne lui convient pas serait faux.
    assert.equal(notice.fitWarning, null);
  });

  test("aucun des deux n'affiche de prix : les deux constats, et l'avertissement", () => {
    const notice = assessPricingCoverage(NO_PAGE, EMPTY_PAGE, "Acme");
    assert.ok(notice);
    assert.equal(notice.scope, "both");
    assert.equal(notice.observations.length, 2);
    assert.ok(notice.fitWarning);
  });

  test("distingue « aucune page trouvée » de « page trouvée mais sans prix »", () => {
    const noPage = assessPricingCoverage(NO_PAGE, WITH_PRICING, "Acme");
    const emptyPage = assessPricingCoverage(EMPTY_PAGE, WITH_PRICING, "Acme");
    assert.ok(noPage && emptyPage);
    assert.notEqual(noPage.observations[0], emptyPage.observations[0]);
    assert.match(emptyPage.observations[0], /n'affiche aucun prix/);
  });

  test("ne prétend jamais que le reste du comparatif est bloqué", () => {
    // Le constat porte sur les prix seuls. Les avis publics, la présence sociale et le
    // positionnement se comparent sans le moindre tarif — laisser croire l'inverse
    // découragerait l'utilisateur de lancer une analyse qui a encore de la valeur.
    for (const notice of [
      assessPricingCoverage(NO_PAGE, WITH_PRICING, "Acme"),
      assessPricingCoverage(WITH_PRICING, NO_PAGE, "Acme"),
      assessPricingCoverage(NO_PAGE, NO_PAGE, "Acme"),
    ]) {
      assert.ok(notice);
      assert.match(notice.consequence, /positionnement, les avis publics et la présence sociale/);
    }
  });

  test("n'annonce jamais un score ou un écart : ce n'est pas un écart détecté", () => {
    // Ce constat ne doit pas entrer dans detected_gaps ni peser sur le score : ce n'est pas
    // un retard sur un concurrent, c'est une limite de mesure. Le vocabulaire doit le
    // refléter, sinon quelqu'un finira par le traiter comme une tâche.
    const notice = assessPricingCoverage(NO_PAGE, NO_PAGE, "Acme");
    assert.ok(notice);
    const text = [notice.title, notice.consequence, notice.fitWarning ?? ""].join(" ");
    assert.doesNotMatch(text, /écart détecté|priorité|tâche à faire/i);
  });
});
