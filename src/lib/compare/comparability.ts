/**
 * Le comparateur peut-il réellement travailler sur ce couple de sites ?
 *
 * Tout le moteur suppose un SaaS qui publie ses tarifs : les règles de prix (paliers,
 * essai gratuit, palier gratuit) sont la moitié de ce que produit detect-gaps.ts. Face à
 * un site qui fonctionne sur devis — un prestataire de service, un artisan, un cabinet de
 * conseil, mais aussi un SaaS enterprise en « contact sales » — l'extraction ne ramène
 * aucun prix, aucune règle de prix ne se déclenche, et l'écran affiche « aucun écart
 * détecté ».
 *
 * C'est le pire résultat possible : littéralement vrai, et lu comme « tout va bien ». Le
 * produit doit dire ce qu'il n'a pas pu mesurer, exactement comme il refuse d'inventer une
 * donnée quand un fetch échoue (voir CLAUDE.md). Ce module produit ce constat ; il ne
 * bloque rien — le positionnement, les avis publics et la présence sociale restent
 * comparables sans le moindre prix.
 *
 * Module pur, sans I/O : /api/compare l'appelle à la fin d'une analyse et le dashboard le
 * rappelle sur les relevés stockés. Les deux passent donc par le même calcul, et le
 * message affiché après une analyse ne peut pas différer de celui qui persiste à l'écran.
 */

export interface PricingObservation {
  /** Une page dédiée aux tarifs a-t-elle été localisée (voir fetch-site.ts) ? */
  pageFound: boolean;
  /** Nombre de paliers de prix réellement extraits, page dédiée ou accueil confondus. */
  tierCount: number;
}

/**
 * Un côté alimente les règles de prix dès qu'au moins un palier a été relevé, quelle que
 * soit la page d'où il vient. C'est le palier extrait qui compte, pas l'existence d'une
 * page : une page « Tarifs » qui ne dit que « devis gratuit » ne fournit rien à comparer.
 */
export function publishesPricing(observation: PricingObservation): boolean {
  return observation.tierCount > 0;
}

export type CoverageScope = "own" | "competitor" | "both";

export interface CoverageNotice {
  scope: CoverageScope;
  title: string;
  /** Ce qui a été observé, un constat par côté concerné. */
  observations: string[];
  /** Ce que ça change concrètement pour la suite du comparatif. */
  consequence: string;
  /**
   * Uniquement quand le site de l'utilisateur est concerné : l'outil n'est peut-être pas
   * fait pour son activité. Se taire là-dessus reviendrait à lui laisser payer pour un
   * comparateur qui ne peut rien relever chez lui.
   */
  fitWarning: string | null;
}

function describe(observation: PricingObservation, subject: string): string {
  return observation.pageFound
    ? `Une page de tarifs a bien été trouvée sur ${subject}, mais elle n'affiche aucun prix.`
    : `Aucune page de tarifs n'a été trouvée sur ${subject}, et aucun prix n'a été relevé sur sa page d'accueil.`;
}

const OWN_FIT_WARNING =
  "Rivalys est construit pour des SaaS qui publient leurs tarifs. Si ton activité fonctionne sur devis — prestation de service, artisanat, conseil — le comparateur ne pourra pas relever grand-chose de ton côté en l'état.";

/**
 * Renvoie null quand les deux sites publient des prix : il n'y a alors rien à signaler, et
 * un bandeau permanent qui ne dit rien serait vite ignoré, y compris le jour où il compte.
 */
export function assessPricingCoverage(
  own: PricingObservation,
  competitor: PricingObservation,
  competitorLabel: string,
): CoverageNotice | null {
  const ownOk = publishesPricing(own);
  const competitorOk = publishesPricing(competitor);
  if (ownOk && competitorOk) return null;

  const scope: CoverageScope = !ownOk && !competitorOk ? "both" : ownOk ? "competitor" : "own";

  const observations: string[] = [];
  if (!ownOk) observations.push(describe(own, "ton site"));
  if (!competitorOk) observations.push(describe(competitor, competitorLabel));

  const stillCompared =
    "Le positionnement, les avis publics et la présence sociale restent comparés normalement.";

  if (scope === "competitor") {
    return {
      scope,
      title: "Aucun tarif public relevé chez ton concurrent",
      observations,
      // Cas courant et parfaitement normal chez un SaaS enterprise : le dire évite de
      // faire passer une stratégie commerciale délibérée pour une anomalie.
      consequence: `Les règles qui comparent les prix et les paliers ne peuvent donc rien relever. C'est fréquent chez les SaaS qui vendent en « contact commercial » plutôt qu'en libre-service. ${stillCompared}`,
      fitWarning: null,
    };
  }

  const title =
    scope === "both"
      ? "Aucun tarif public relevé, ni chez toi ni chez ton concurrent"
      : "Aucun tarif public relevé sur ton site";

  return {
    scope,
    title,
    observations,
    consequence: `Les règles qui comparent les prix et les paliers ne peuvent donc rien relever — c'est la moitié de ce que Rivalys sait détecter. ${stillCompared}`,
    fitWarning: OWN_FIT_WARNING,
  };
}
