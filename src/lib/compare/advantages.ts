// Les mêmes règles que detect-gaps.ts, appliquées dans l'autre sens : ce que TU as et que
// ton concurrent n'a pas.
//
// Pourquoi ce fichier existe : le score ne mesure que tes retards, donc l'app ne montrait
// jusqu'ici qu'une moitié de la comparaison. Les données pour l'autre moitié étaient déjà
// là, jamais lues. Afficher les deux colonnes rend la comparaison honnête sans avoir à
// noter le concurrent — ce qu'on ne peut pas faire à partir de ses seules pages publiques.
//
// Un avantage n'est PAS un écart : il n'entre pas dans detected_gaps, ne génère aucune
// tâche et ne compte pas dans le score. C'est un constat factuel, calculé à la volée.

import type { ExtractedSiteData, GapCategory } from "@/lib/supabase/database.types";
import { labelPlatforms, missingPlatforms } from "./social";
import { labelReviewPlatforms, missingReviewPlatforms } from "./reviews";

export interface Advantage {
  category: GapCategory;
  title: string;
  description: string;
}

function competitorLabelOrFallback(label: string): string {
  return label.trim() || "ton concurrent";
}

/** « A », « A et B », « A, B et C ». */
function joinNames(names: readonly string[]): string {
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} et ${names.at(-1)}`;
}

/**
 * Miroir de detectPricingGaps. Le garde-fou sur les pages de pricing est identique et pour
 * la même raison : quand une page de pricing n'a pas été trouvée, les `false` et les listes
 * vides de l'extraction signifient « inconnu », pas « confirmé absent ». Les comparer
 * reviendrait à t'annoncer un avantage qu'on n'a jamais vérifié.
 */
export function detectPricingAdvantages(
  own: ExtractedSiteData,
  competitor: ExtractedSiteData,
  competitorLabel: string,
  ownPricingFound: boolean,
  competitorPricingFound: boolean,
): Advantage[] {
  if (!ownPricingFound || !competitorPricingFound) return [];

  const advantages: Advantage[] = [];
  const label = competitorLabelOrFallback(competitorLabel);

  if (own.has_free_trial && !competitor.has_free_trial) {
    advantages.push({
      category: "pricing",
      title: "Tu proposes un essai gratuit, pas lui",
      description: `Ton pricing affiche un essai gratuit, alors que celui de ${label} n'en propose pas.`,
    });
  }

  if (own.has_free_tier && !competitor.has_free_tier) {
    advantages.push({
      category: "pricing",
      title: "Tu as un palier gratuit, pas lui",
      description: `Ton pricing propose un palier gratuit permanent, absent de celui de ${label}.`,
    });
  }

  if (own.pricing_tiers.length > competitor.pricing_tiers.length) {
    advantages.push({
      category: "pricing",
      title: "Tu proposes plus de paliers de pricing que lui",
      description: `Tu affiches ${own.pricing_tiers.length} paliers contre ${competitor.pricing_tiers.length} pour ${label}, ce qui te permet de segmenter plus finement.`,
    });
  }

  return advantages;
}

/**
 * Miroir de detectSocialPresenceGap. Comme lui, la revendication reste strictement limitée
 * à ce qu'on a observé — « ton site renvoie vers X » — jamais élargie en « tu es plus actif
 * que lui », qu'on n'a aucun moyen honnête de savoir.
 */
export function detectSocialAdvantage(
  ownPlatforms: readonly string[],
  competitorPlatforms: readonly string[],
  competitorLabel: string,
  bothSitesObserved: boolean,
): Advantage | null {
  if (!bothSitesObserved) return null;

  const extra = missingPlatforms(competitorPlatforms, ownPlatforms);
  if (extra.length === 0) return null;

  const label = competitorLabelOrFallback(competitorLabel);
  const list = joinNames(labelPlatforms(extra));

  return {
    category: "social_presence",
    title: "Tu affiches des réseaux sociaux qu'il n'affiche pas",
    description: `Ton site renvoie vers ${list}, alors que celui de ${label} n'y renvoie pas.`,
  };
}

// Pas de miroir de detectThirdPartyPresenceGap (contenus publics de tiers mentionnant un
// produit, voir social-mentions.ts) — volontairement.
//
// Deux raisons. D'abord, « des contenus parlent de toi » n'est pas un avantage qu'on puisse
// affirmer honnêtement : on ne sait pas qui les a publiés, ni s'ils te sont favorables. Un
// contenu qui te descend compterait alors comme un point en ta faveur, ce qui est faux.
// Ensuite, l'affirmer demanderait de lancer la même recherche sur TON site, ce que le
// pipeline ne fait pas (la recherche ne tourne que côté concurrent) : on ne dispose donc de
// rien à comparer. Tant que ces deux points tiennent, ce miroir n'a pas lieu d'exister.

/**
 * Miroir de detectReviewPresenceGap. Présence uniquement : aucune note, aucune étoile,
 * aucun nombre d'avis — ni ici ni ailleurs. La formulation reste limitée à l'observation
 * (« aucune fiche trouvée » et non « il n'est référencé nulle part »).
 */
export function detectReviewAdvantage(
  ownPlatforms: readonly string[],
  competitorPlatforms: readonly string[],
  competitorLabel: string,
  bothSitesObserved: boolean,
): Advantage | null {
  if (!bothSitesObserved) return null;

  const extra = missingReviewPlatforms(competitorPlatforms, ownPlatforms);
  if (extra.length === 0) return null;

  const label = competitorLabelOrFallback(competitorLabel);
  const list = joinNames(labelReviewPlatforms(extra));

  return {
    category: "reviews",
    title: "Tu es référencé sur des plateformes d'avis où il ne l'est pas",
    description: `Ton SaaS a une fiche publique sur ${list}, alors qu'aucune fiche de ${label} n'y a été trouvée.`,
  };
}

/** Rassemble toutes les règles d'avantage dans l'ordre où elles s'affichent. */
export function detectAllAdvantages(input: {
  own: ExtractedSiteData;
  competitor: ExtractedSiteData;
  competitorLabel: string;
  ownPricingFound: boolean;
  competitorPricingFound: boolean;
  ownPlatforms: readonly string[];
  competitorPlatforms: readonly string[];
  /** Les deux pages d'accueil ont bien été relevées (contrat null-vs-[] de readSocialPlatforms). */
  bothSitesObserved: boolean;
  ownReviewPlatforms: readonly string[];
  competitorReviewPlatforms: readonly string[];
  /** Les deux sites ont bien été vérifiés côté plateformes d'avis — indépendant du flag social. */
  bothSitesReviewsObserved: boolean;
}): Advantage[] {
  const advantages = detectPricingAdvantages(
    input.own,
    input.competitor,
    input.competitorLabel,
    input.ownPricingFound,
    input.competitorPricingFound,
  );

  const social = detectSocialAdvantage(
    input.ownPlatforms,
    input.competitorPlatforms,
    input.competitorLabel,
    input.bothSitesObserved,
  );
  if (social) advantages.push(social);

  const reviews = detectReviewAdvantage(
    input.ownReviewPlatforms,
    input.competitorReviewPlatforms,
    input.competitorLabel,
    input.bothSitesReviewsObserved,
  );
  if (reviews) advantages.push(reviews);

  return advantages;
}
