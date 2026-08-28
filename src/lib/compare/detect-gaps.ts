// Hardcoded gap-detection rules — deliberately NOT LLM-generated. Per CLAUDE.md, every
// action shown to the user must derive from a factual, explicit comparison rule, never
// free-form generation. The only LLM involvement in this file's domain is the upstream
// `veryDifferent` boolean fed into buildPositioningGap, computed once by a separate
// classifier call (see extract.ts) — the gap text itself is still built here, from the
// real extracted data, by a plain template.

import type { ExtractedSiteData, GapCategory, GapPriority } from "@/lib/supabase/database.types";
import { labelPlatforms, missingPlatforms } from "./social";
import { labelReviewPlatforms, missingReviewPlatforms } from "./reviews";
import { groupMentionsByPlatform } from "./social-mentions";
import { labelAuthMethods, missingAuthMethods } from "./auth-methods";
import { labelPaymentMethods, missingPaymentMethods } from "./payment-methods";

export interface GapCandidate {
  category: GapCategory;
  title: string;
  description: string;
  priority: GapPriority;
}

function competitorLabelOrFallback(label: string): string {
  return label.trim() || "ton concurrent";
}

/** "A", "A et B", "A, B et C" — French enumeration for a gap description. */
function joinNames(names: readonly string[]): string {
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} et ${names.at(-1)}`;
}

/**
 * The three hardcoded pricing rules from CLAUDE.md § Comparateur:
 *   - competitor has a free trial and we don't -> high
 *   - competitor has a free tier and we don't -> high
 *   - competitor has more pricing tiers than us -> medium
 * Pure function: no network, no DB — takes two already-extracted snapshots and returns
 * candidate gaps. Deduplication against already-open gaps happens at the call site (it
 * needs a DB read).
 *
 * `ownPricingFound`/`competitorPricingFound` reflect whether a dedicated pricing page was
 * actually located for that side (see StoredExtractedData.pricing_page_found). When a
 * pricing page wasn't found, the extractor's `has_free_trial`/`has_free_tier: false` and
 * empty `pricing_tiers` mean "unknown", not "confirmed absent" — the extraction prompt
 * falls back to those defaults precisely because it found nothing to read. Comparing that
 * ambiguous `false` against a confirmed value on the other side would present a guess as a
 * fact (e.g. "you don't have a free trial" when we simply couldn't check). Per CLAUDE.md,
 * we never fabricate or infer competitive data from a failed fetch — so if either side's
 * pricing page is missing, we skip all three pricing rules entirely rather than emit a
 * gap built on an unverified default.
 */
export function detectPricingGaps(
  own: ExtractedSiteData,
  competitor: ExtractedSiteData,
  competitorLabel: string,
  ownPricingFound: boolean,
  competitorPricingFound: boolean,
): GapCandidate[] {
  if (!ownPricingFound || !competitorPricingFound) return [];

  const gaps: GapCandidate[] = [];
  const label = competitorLabelOrFallback(competitorLabel);

  if (competitor.has_free_trial && !own.has_free_trial) {
    gaps.push({
      category: "pricing",
      title: "Ton concurrent propose un essai gratuit, pas toi",
      description: `${label} propose un essai gratuit sur son pricing, alors que ton offre actuelle n'en propose pas.`,
      priority: "high",
    });
  }

  if (competitor.has_free_tier && !own.has_free_tier) {
    gaps.push({
      category: "pricing",
      title: "Ton concurrent a un palier gratuit, pas toi",
      description: `${label} propose un palier gratuit ("free tier"), alors que ton pricing n'en propose aucun.`,
      priority: "high",
    });
  }

  if (competitor.pricing_tiers.length > own.pricing_tiers.length) {
    gaps.push({
      category: "pricing",
      title: "Ton concurrent propose plus de paliers de pricing que toi",
      description: `${label} propose ${competitor.pricing_tiers.length} paliers de pricing contre ${own.pricing_tiers.length} pour toi, ce qui lui permet de mieux segmenter ses clients.`,
      priority: "medium",
    });
  }

  return gaps;
}

/**
 * Social-presence rule: the competitor's homepage links to social platforms ours doesn't.
 *
 * Both inputs come from detectSocialPlatforms() reading each site's own published links —
 * a public, verifiable fact. The claim is scoped tightly to what was actually observed
 * ("son site renvoie vers X"), never widened into "il est actif sur X" or any statement
 * about follower counts or engagement, which we have no honest way to know.
 *
 * `bothSitesObserved` guards the same failure mode as pricing_page_found does for the
 * pricing rules: an empty platform list is only meaningful if we actually read that site's
 * homepage. If either side was never observed (see readSocialPlatforms returning null), an
 * empty list means "unknown", not "confirmed none", so no gap is emitted at all.
 *
 * `note` is optional enrichment (see perplexity.ts). When it's null the gap is still created
 * with its factual description; the enrichment never gates detection.
 */
export function detectSocialPresenceGap(
  ownPlatforms: readonly string[],
  competitorPlatforms: readonly string[],
  competitorLabel: string,
  bothSitesObserved: boolean,
  note: string | null = null,
): GapCandidate | null {
  if (!bothSitesObserved) return null;

  const missing = missingPlatforms(ownPlatforms, competitorPlatforms);
  if (missing.length === 0) return null;

  const label = competitorLabelOrFallback(competitorLabel);
  const list = joinNames(labelPlatforms(missing));

  const description =
    `Le site de ${label} renvoie vers ${list}, alors que le tien ne renvoie vers aucun de ces réseaux. ` +
    `C'est un canal d'acquisition visible publiquement sur lequel tu n'apparais pas.` +
    (note ? `\n\n${note}` : "");

  return {
    // Static title (the platform list lives in the description): the dedup key at the call
    // site is category+title, so a title that embedded the platform names or their count
    // would spawn a near-duplicate open gap every time the competitor added one account.
    category: "social_presence",
    title: "Ton concurrent affiche des réseaux sociaux que tu n'affiches pas",
    description,
    priority: "medium",
  };
}

/**
 * Third-party-content rule: publicly visible content mentioning the competitor exists on a
 * platform our own site links to no account on.
 *
 * WHAT THIS CLAIM IS, EXACTLY. The input is a list of verified URLs of individual posts that
 * mention the competitor (see social-mentions.ts) — nothing more. So the description says
 * only that: such content exists, here are the links, and the authorship is unknown. It must
 * never say who published it, why, or on whose behalf: an official account, a paid partner,
 * a happy customer and a detractor all produce a page that looks the same from outside. Any
 * wording about the competitor's marketing strategy, budget or intent would be an invented
 * claim about a competitor, which CLAUDE.md rules out flatly. Likewise no follower count, no
 * view count, no engagement figure, no volume estimate — none of it is verifiable.
 *
 * Fires only for platforms where BOTH the content was verified AND `ownPlatforms` shows no
 * link of ours: if we already publish an account there, this is not a gap for us. The claim
 * "ton site ne renvoie vers aucun compte" is guaranteed by that same filter, so it holds on
 * the function's own arguments. (The caller additionally restricts the lookup to platforms
 * the competitor doesn't link to either — that's cost control and non-redundancy with
 * detectSocialPresenceGap, and nothing in the wording below depends on it.)
 *
 * `bothSitesObserved` guards the usual failure mode: an empty `ownPlatforms` only means "we
 * link to nothing" if we actually read our own homepage, and the mention list is only
 * comparable if the lookup actually ran (see readThirdPartyMentions' null-vs-[] contract).
 *
 * Priority is `low` on purpose: a link a competitor puts on its own site is a deliberate,
 * self-declared fact, while content someone else published is weaker evidence about anything
 * the user can act on. The priority must not overstate it.
 */
export function detectThirdPartyPresenceGap(
  competitorMentions: readonly { platform: string; url: string }[],
  ownSocialPlatforms: readonly string[],
  competitorLabel: string,
  bothSitesObserved: boolean,
): GapCandidate | null {
  if (!bothSitesObserved) return null;

  const owned = new Set(ownSocialPlatforms);
  // groupMentionsByPlatform re-verifies every URL before it can reach the text below.
  const groups = groupMentionsByPlatform(competitorMentions).filter((g) => !owned.has(g.platform));
  if (groups.length === 0) return null;

  const label = competitorLabelOrFallback(competitorLabel);
  const list = joinNames(labelPlatforms(groups.map((g) => g.platform)));
  const links = groups
    .flatMap((g) => {
      const [platformLabel] = labelPlatforms([g.platform]);
      return g.urls.map((url) => `- ${platformLabel} : ${url}`);
    })
    .join("\n");

  return {
    // Static title, and deliberately worded so it can't be confused with
    // detectSocialPresenceGap's ("Ton concurrent affiche des réseaux sociaux que tu
    // n'affiches pas") — both gaps live in the social_presence category and the call site
    // dedupes on category+title, so two rules sharing a title would silently suppress one
    // another. The platform names and links live in the description for the same reason as
    // the other rules: a title that listed them would reopen a near-duplicate gap on every
    // new piece of content found.
    category: "social_presence",
    title: "Des contenus publics parlent de ton concurrent là où tu n'es pas",
    description:
      `Des contenus publics mentionnant ${label} ont été trouvés sur ${list}, où ton site ne ` +
      `renvoie vers aucun compte. Ils ont été trouvés par recherche publique, pas sur le site ` +
      `de ${label} : ils existent indépendamment des liens qu'il affiche lui-même.\n\n` +
      `On ne peut pas savoir qui les a publiés — un compte officiel, un client, un créateur ` +
      `indépendant ou un détracteur ne se distinguent pas de l'extérieur. Rivalys ne tranche ` +
      `donc pas à ta place : ouvre les liens et juge par toi-même.\n\n` +
      `Présence détectée, volume non mesurable : ces plateformes ne donnent accès à leurs ` +
      `statistiques qu'à des partenaires licenciés. Les liens ci-dessous sont des exemples, ` +
      `pas un inventaire — il en existe probablement d'autres, en particulier sur TikTok, très ` +
      `mal indexé par la recherche publique.\n\n` +
      `Contenus relevés :\n${links}`,
    priority: "low",
  };
}

/**
 * Review-platform rule: the competitor has a public listing on G2 / Capterra / Trustpilot /
 * Product Hunt where we have none.
 *
 * PRESENCE ONLY. No rating, no star count, no review count enters this gap — a rating read
 * once and shown weeks later is a false statement about the competitor, and ranking the user
 * against a score is exactly the anxiogenic comparison CLAUDE.md rules out. Being listed, by
 * contrast, is stable, checkable, and fixable: the resulting task is "crée ta fiche".
 *
 * The wording stays scoped to what was actually observed ("aucune fiche n'a été trouvée"),
 * never widened to "tu n'es référencé nulle part" — presence is easy to confirm, universal
 * absence is not, and we don't assert what we can't check.
 *
 * `bothSitesObserved` guards the same failure mode as elsewhere in this file: an empty list
 * only means "listed nowhere we could find" if that side was actually checked. When either
 * side is unobserved (readReviewPlatforms returning null), no gap is emitted.
 */
export function detectReviewPresenceGap(
  ownPlatforms: readonly string[],
  competitorPlatforms: readonly string[],
  competitorLabel: string,
  bothSitesObserved: boolean,
): GapCandidate | null {
  if (!bothSitesObserved) return null;

  const missing = missingReviewPlatforms(ownPlatforms, competitorPlatforms);
  if (missing.length === 0) return null;

  const label = competitorLabelOrFallback(competitorLabel);
  const list = joinNames(labelReviewPlatforms(missing));

  return {
    // Static title, platform names in the description — same reason as the social rule: the
    // call site dedupes on category+title, so a title listing the platforms would open a
    // near-duplicate gap each time one more listing appeared.
    category: "reviews",
    title: "Ton concurrent est référencé sur des plateformes d'avis, pas toi",
    description:
      `Une fiche publique de ${label} a été trouvée sur ${list}, alors qu'aucune fiche n'a été ` +
      `trouvée pour ton SaaS sur ces plateformes. C'est un canal de découverte et de ` +
      `réassurance sur lequel tu n'apparais pas — y créer ta fiche est gratuit et se fait en une fois.`,
    // Medium: être référencé est concret et actionnable, mais moins directement lié au
    // revenu qu'un écart de pricing.
    priority: "medium",
  };
}

/**
 * The fourth rule (positioning): builds a gap from the two real value propositions, but
 * only when `veryDifferent` (computed upstream by a single LLM classification call) says
 * so. Pure otherwise — no LLM call happens in this function.
 */
export function buildPositioningGap(
  own: ExtractedSiteData,
  competitor: ExtractedSiteData,
  veryDifferent: boolean,
  competitorLabel: string,
): GapCandidate | null {
  if (!veryDifferent) return null;
  const label = competitorLabelOrFallback(competitorLabel);

  return {
    category: "positioning",
    title: "Ton positionnement diffère nettement de celui de ton concurrent",
    description: `Ta proposition de valeur ("${own.value_proposition}") et celle de ${label} ("${competitor.value_proposition}") semblent viser des angles différents — vérifie que ton message reste le bon face à ce contraste.`,
    priority: "low",
  };
}

/**
 * Règle « moyens de connexion » : le concurrent propose sur sa page de connexion publique
 * des méthodes que la nôtre ne propose pas.
 *
 * CE QUE L'AFFIRMATION COUVRE, EXACTEMENT. L'entrée est ce qui a été lu sur une page de
 * connexion publique : un bouton « continuer avec X », ou un lien vers le point d'entrée
 * OAuth de X. Rien d'autre. La description dit donc « sa page de connexion propose », et
 * jamais « son produit gère » : un SSO d'entreprise réservé aux comptes payants n'apparaît
 * pas sur cette page, et l'absence d'un bouton n'est pas l'absence d'une capacité.
 *
 * `bothSitesObserved` reprend le garde-fou des autres règles : une liste vide n'a de sens
 * que si la page de connexion a réellement été lue (voir le contrat null-vs-[] de
 * readAuthMethods). Sans les deux côtés observés, aucun écart n'est émis.
 *
 * Priorité moyenne : une friction d'inscription est réelle et mesurable côté conversion,
 * mais elle se corrige par une intégration technique, pas par une décision immédiate comme
 * un essai gratuit absent.
 */
export function detectAuthMethodsGap(
  ownMethods: readonly string[],
  competitorMethods: readonly string[],
  competitorLabel: string,
  bothSitesObserved: boolean,
): GapCandidate | null {
  if (!bothSitesObserved) return null;

  const missing = missingAuthMethods(ownMethods, competitorMethods);
  if (missing.length === 0) return null;

  const label = competitorLabelOrFallback(competitorLabel);
  const list = joinNames(labelAuthMethods(missing));

  return {
    category: "auth",
    // Titre statique : la liste vit dans la description, sinon l'ajout d'un fournisseur
    // chez le concurrent créerait un quasi-doublon à chaque analyse (dédup par catégorie+titre).
    title: "Ton concurrent propose des connexions que tu ne proposes pas",
    description:
      `La page de connexion de ${label} propose ${list}, alors que la tienne ne le propose pas. ` +
      `C'est une étape de moins entre un visiteur et un compte créé. ` +
      `Relevé sur sa page de connexion publique uniquement : une méthode réservée à ses ` +
      `comptes entreprise n'y apparaîtrait pas.`,
    priority: "medium",
  };
}

/**
 * Règle « moyens de paiement » : le concurrent affiche publiquement des moyens de paiement
 * que nous n'affichons pas.
 *
 * CE QUE L'AFFIRMATION COUVRE, EXACTEMENT. Un tunnel de paiement vit derrière un compte :
 * on ne le voit pas, et on ne prétend pas le voir. Ce qui est relevé, ce sont les moyens
 * annoncés sur des pages publiques — badges, mentions « nous acceptons », widget de
 * paiement chargé sur la page de tarifs. La description parle donc d'affichage, et invite
 * explicitement à vérifier : un site peut très bien accepter PayPal sans l'écrire nulle part.
 *
 * Priorité basse pour cette raison : la preuve est plus faible que pour un essai gratuit
 * affiché noir sur blanc sur une page de tarifs, et la priorité ne doit pas la surestimer.
 */
export function detectPaymentMethodsGap(
  ownMethods: readonly string[],
  competitorMethods: readonly string[],
  competitorLabel: string,
  bothSitesObserved: boolean,
): GapCandidate | null {
  if (!bothSitesObserved) return null;

  const missing = missingPaymentMethods(ownMethods, competitorMethods);
  if (missing.length === 0) return null;

  const label = competitorLabelOrFallback(competitorLabel);
  const list = joinNames(labelPaymentMethods(missing));

  return {
    category: "payment",
    title: "Ton concurrent affiche des moyens de paiement que tu n'affiches pas",
    description:
      `${label} annonce publiquement ${list}, ce qu'on ne retrouve pas sur tes pages publiques. ` +
      `Moins de friction au moment de payer, c'est moins d'abandons au dernier écran. ` +
      `Attention à la portée de ce constat : il ne porte que sur ce qui est AFFICHÉ. ` +
      `Le tunnel de paiement lui-même est derrière un compte, donc invisible des deux côtés — ` +
      `si tu acceptes déjà ces moyens sans le dire, l'action est de l'écrire.`,
    priority: "low",
  };
}
