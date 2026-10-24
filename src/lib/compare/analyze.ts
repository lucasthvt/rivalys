import {
  clickThroughToPayment,
  fetchSite,
  peekRedirect,
  SiteFetchError,
  type FetchedSite,
} from "@/lib/compare/fetch-site";
import { extractSiteData, classifyPositioning, ExtractionError } from "@/lib/compare/extract";
import {
  readAuthMethods,
  readPaymentMethods,
  readReviewPlatforms,
  readSocialPlatforms,
  readThirdPartyMentions,
  type StoredExtractedData,
} from "@/lib/compare/site-data";
import {
  detectPricingGaps,
  buildPositioningGap,
  detectAuthMethodsGap,
  detectPaymentMethodsGap,
  detectReviewPresenceGap,
  detectSocialPresenceGap,
  detectThirdPartyPresenceGap,
  type GapCandidate,
} from "@/lib/compare/detect-gaps";
import { detectSocialPlatforms, labelPlatforms, missingPlatforms } from "@/lib/compare/social";
import { detectAuthMethods } from "@/lib/compare/auth-methods";
import {
  detectPaymentMethods,
  detectPaymentProviders,
  followPurchaseLinks,
  providerFromLandingUrl,
} from "@/lib/compare/payment-methods";
import {
  lookupThirdPartyMentions,
  MENTION_PLATFORM_IDS,
  type ThirdPartyMention,
} from "@/lib/compare/social-mentions";
import {
  detectReviewPlatformsFromLinks,
  lookupReviewPresence,
  mergeReviewPlatforms,
} from "@/lib/compare/reviews";
import { askPerplexity, isPerplexityConfigured } from "@/lib/compare/perplexity";
import { UNBOUNDED, type Deadline } from "@/lib/compare/deadline";

/**
 * Parts du budget d'analyse (voir deadline.ts) réservées aux étages optionnels de ce module.
 * Chacun s'efface quand il ne reste plus de quoi l'exécuter : un relevé non effectué reste
 * « non observé » grâce au contrat null-vs-[] de site-data, jamais « observé et vide ».
 */
const PERPLEXITY_LOOKUP_MS = 8_000;
/** Deux sondes de redirection au plus, 5 s chacune (voir LOGIN_FETCH_TIMEOUT_MS). */
const PEEK_REDIRECT_MS = 10_000;

/**
 * Le pipeline d'analyse, sans base de données.
 *
 * Extrait de `/api/compare`, qui le mélangeait à sa persistance sur 647 lignes. Deux
 * appelants s'en servent maintenant, et c'est tout l'intérêt : `/api/compare` l'exécute puis
 * enregistre relevés, écarts et score pour un utilisateur ; `/api/teardown` l'exécute sur une
 * paire d'URL arbitraire et n'écrit rien. Une seule copie des règles, donc une démo qui ne
 * peut pas montrer autre chose que ce que le produit fait réellement.
 *
 * Rien ici ne connaît Supabase, ni de session, ni de `user_id`.
 */

/**
 * Relève un site : pages publiques, extraction structurée, puis les observations
 * déterministes (réseaux, connexion, paiement) et les deux relevés web-groundés.
 *
 * `observeMentions` n'est vrai que du côté concurrent — voir observeThirdPartyMentions pour
 * la raison de l'asymétrie.
 */
export async function fetchAndExtract(
  url: string,
  siteLabel: string,
  observeMentions: boolean,
  deadline: Deadline = UNBOUNDED,
): Promise<{ raw: FetchedSite; data: StoredExtractedData }> {
  const raw = await fetchSite(url, deadline);

  // Social platforms come from the site's own published links, not from the LLM — see
  // social.ts. Stored alongside the extraction so the gap rule can compare both sides.
  const socialPlatforms = detectSocialPlatforms(raw.homepageLinks);

  // Moyens de paiement : la page d'accueil est toujours lue, donc un tableau vide est ici
  // une vraie observation (« rien d'affiché »), pas une absence de mesure.
  const paymentMarkup = [raw.homepageHtml ?? "", raw.pricingHtml ?? ""].join("\n");
  const paymentLinks = [...raw.homepageLinks, ...raw.pricingLinks, ...raw.loginLinks];

  // Relevé séparé : qui encaisse, à défaut de savoir avec quoi on paie. En second
  // recours, on regarde où mène un bouton d'abonnement : beaucoup de sites pointent vers
  // une route interne qui redirige aussitôt vers le prestataire.
  const declaredProviders = detectPaymentProviders({
    links: paymentLinks,
    html: paymentMarkup,
  });

  /*
    Les quatre relevés qui suivent sont lancés ENSEMBLE, et c'est le gain de latence le plus
    important du pipeline.

    Ils l'étaient à moitié : l'extraction Claude tournait d'abord, puis le prestataire de
    paiement, puis seulement les deux relevés Perplexity. Or aucun des trois derniers ne lit
    le résultat de l'extraction — ils ne travaillent que sur `raw`, déjà en main. Mesuré sur
    notion.so/clickup.com, cela empilait 9,3 s d'extraction devant 4,3 s de relevés web qui
    auraient pu courir en même temps, sur chacun des deux sites.

    allSettled et non all : seule l'extraction est obligatoire. Les trois autres renvoient
    null en cas d'échec, mais un `all` qui rejette sur l'extraction laisserait les autres
    promesses se terminer dans le vide — et une rejection non récupérée fait tomber le
    processus. On attend donc tout le monde, puis on relaie l'échec de l'extraction seule.
  */
  const [extractedResult, providersResult, reviewsResult, mentionsResult] =
    await Promise.allSettled([
      extractSiteData(
        {
          homepageText: raw.homepageText,
          pricingText: raw.pricingText,
          pricingPageFound: raw.pricingUrl !== null,
        },
        deadline,
      ),
      resolvePaymentProviders(declaredProviders, raw, url, deadline),
      // Review platforms: presence on G2/Capterra/Trustpilot/Product Hunt, never a rating.
      // The field is left out entirely when the check couldn't complete, so
      // readReviewPlatforms returns null and no comparison is built on it.
      observeReviewPlatforms(siteLabel, url, raw.homepageLinks, deadline),
      observeMentions
        ? observeThirdPartyMentions(siteLabel, url, socialPlatforms, deadline)
        : Promise.resolve(null),
    ]);

  // L'extraction est la seule étape dont l'échec doit arrêter ce côté : sans elle il n'y a
  // ni tarifs, ni promesse, ni public visé — rien à comparer. L'appelant transforme ce rejet
  // en message honnête (voir describeFailure) plutôt qu'en relevé inventé.
  if (extractedResult.status === "rejected") throw extractedResult.reason;

  const data: StoredExtractedData = {
    ...extractedResult.value,
    social_platforms: socialPlatforms,
  };

  // Moyens de connexion : relevés sur la page de connexion publique quand elle a été
  // trouvée. Le champ est OMIS sinon — « on n'a pas lu de page de connexion » ne doit pas
  // être stocké comme « ce site ne propose aucune connexion tierce », ce qu'affirmerait un
  // tableau vide.
  if (raw.loginUrl) {
    data.login_methods = detectAuthMethods({
      loginPageText: raw.loginText,
      links: [...raw.loginLinks, ...raw.homepageLinks],
    });
  }

  data.payment_methods = detectPaymentMethods({
    pricingText: raw.pricingText,
    homepageText: raw.homepageText,
    links: paymentLinks,
    html: paymentMarkup,
  });

  // Un relevé de prestataire qui a échoué n'est pas un site sans prestataire : on retombe
  // sur ce que le balisage déclarait, qui est gratuit et déjà en main.
  data.payment_providers =
    providersResult.status === "fulfilled" ? providersResult.value : declaredProviders;

  const reviewPlatforms = reviewsResult.status === "fulfilled" ? reviewsResult.value : null;
  const mentions = mentionsResult.status === "fulfilled" ? mentionsResult.value : null;

  if (reviewPlatforms !== null) data.review_platforms = reviewPlatforms;
  if (mentions !== null) data.third_party_mentions = mentions;

  return { raw, data };
}

/**
 * Toutes les règles de détection, appliquées à deux relevés.
 *
 * Règles codées en dur uniquement : aucune génération libre par le LLM ici. Le seul appel
 * modèle est `classifyPositioning`, un classificateur binaire, et l'unique enrichissement
 * Perplexity ne s'ajoute qu'à un écart déjà constitué par ailleurs.
 *
 * Chaque règle reçoit un drapeau « les deux côtés ont-ils vraiment été observés ? ». C'est
 * le contrat null-vs-[] de site-data : un côté qu'on n'a pas pu mesurer n'est pas un côté
 * où l'on n'a rien trouvé, et seul le second cas justifie un écart.
 */
export async function buildGapCandidates(
  input: {
    ownData: StoredExtractedData;
    competitorData: StoredExtractedData;
    competitorLabel: string;
    competitorUrl: string;
  },
  deadline: Deadline = UNBOUNDED,
): Promise<GapCandidate[]> {
  const { ownData, competitorData, competitorLabel, competitorUrl } = input;

  const candidates: GapCandidate[] = [
    ...detectPricingGaps(
      ownData,
      competitorData,
      competitorLabel,
      ownData.pricing_page_found,
      competitorData.pricing_page_found,
    ),
  ];

  // Social presence: detected from each site's own published links (deterministic), then
  // optionally enriched with one web-grounded Perplexity call. Both sides must actually have
  // been observed — see readSocialPlatforms' null-vs-[] contract.
  const ownSocial = readSocialPlatforms(ownData);
  const competitorSocial = readSocialPlatforms(competitorData);
  const bothSocialObserved = ownSocial !== null && competitorSocial !== null;
  const missingSocial = bothSocialObserved
    ? missingPlatforms(ownSocial, competitorSocial)
    : [];

  // Les deux seuls appels modèle de cette fonction, lancés ensemble : le classificateur de
  // positionnement ne lit pas la note sociale, et réciproquement. Enchaînés, ils ajoutaient
  // 3,3 s mesurées à la fin de chaque analyse, après que tout le reste était déjà connu.
  const [veryDifferent, socialNote] = await Promise.all([
    classifyPositioning(ownData.value_proposition, competitorData.value_proposition, deadline),
    missingSocial.length > 0
      ? describeCompetitorSocial(competitorLabel, competitorUrl, missingSocial, deadline)
      : Promise.resolve(null),
  ]);

  const positioningGap = buildPositioningGap(ownData, competitorData, veryDifferent, competitorLabel);
  if (positioningGap) candidates.push(positioningGap);

  if (bothSocialObserved) {
    const socialGap = detectSocialPresenceGap(
      ownSocial,
      competitorSocial,
      competitorLabel,
      true,
      socialNote,
    );
    if (socialGap) candidates.push(socialGap);
  }

  // Third-party content ABOUT the competitor, on platforms our own site links to no account
  // on. Weaker evidence than a link the competitor puts on its own site — the rule says only
  // that such content exists and hands over the URLs, never who made it or why. Same
  // null-vs-[] guard: a lookup that never ran is not a lookup that found nothing.
  const competitorMentions = readThirdPartyMentions(competitorData);
  const mentionGap = detectThirdPartyPresenceGap(
    competitorMentions ?? [],
    ownSocial ?? [],
    competitorLabel,
    ownSocial !== null && competitorMentions !== null,
  );
  if (mentionGap) candidates.push(mentionGap);

  // Review platforms: presence only (never a rating or a review count — see reviews.ts).
  // Same null-vs-[] guard as social: a side we couldn't check is not a side with no listing.
  const ownReviews = readReviewPlatforms(ownData);
  const competitorReviews = readReviewPlatforms(competitorData);
  const reviewGap = detectReviewPresenceGap(
    ownReviews ?? [],
    competitorReviews ?? [],
    competitorLabel,
    ownReviews !== null && competitorReviews !== null,
  );
  if (reviewGap) candidates.push(reviewGap);

  // Connexion : ce que la page de connexion publique de chaque côté propose. Même garde
  // null-vs-[] que les réseaux — un côté non observé n'est pas un côté sans méthode.
  const ownAuth = readAuthMethods(ownData);
  const competitorAuth = readAuthMethods(competitorData);
  const authGap = detectAuthMethodsGap(
    ownAuth ?? [],
    competitorAuth ?? [],
    competitorLabel,
    ownAuth !== null && competitorAuth !== null,
  );
  if (authGap) candidates.push(authGap);

  // Paiement : uniquement ce qui est AFFICHÉ publiquement. Le tunnel réel est derrière un
  // compte des deux côtés, donc hors de portée — la règle le dit explicitement.
  const ownPayment = readPaymentMethods(ownData);
  const competitorPayment = readPaymentMethods(competitorData);
  const paymentGap = detectPaymentMethodsGap(
    ownPayment ?? [],
    competitorPayment ?? [],
    competitorLabel,
    ownPayment !== null && competitorPayment !== null,
  );
  if (paymentGap) candidates.push(paymentGap);

  return candidates;
}

/**
 * Public content mentioning this site's product on platforms it links to no account on.
 *
 * Run for the COMPETITOR only, and only when Perplexity is configured. Two filters keep the
 * spend honest:
 *   - platforms the site already links to from its own homepage are skipped: that presence
 *     is already a deterministic, free observation handled by detectSocialPresenceGap, so a
 *     lookup there could only re-confirm what we can already see;
 *   - if nothing is left to check, no call is made at all.
 *
 * Returns null when no lookup ran or one ran and failed: "we didn't check" must not be
 * stored as "no content mentions this product", which is what an empty array would assert.
 */
async function observeThirdPartyMentions(
  siteLabel: string,
  siteUrl: string,
  linkedPlatforms: readonly string[],
  deadline: Deadline,
): Promise<ThirdPartyMention[] | null> {
  if (!isPerplexityConfigured()) return null;
  if (!deadline.hasRoomFor(PERPLEXITY_LOOKUP_MS)) return null;

  const linked = new Set(linkedPlatforms);
  const toCheck = MENTION_PLATFORM_IDS.filter((id) => !linked.has(id));
  if (toCheck.length === 0) return null;

  return lookupThirdPartyMentions(siteLabel, siteUrl, toCheck, {
    timeoutMs: deadline.capTimeout(PERPLEXITY_LOOKUP_MS),
  });
}

/**
 * Review-platform presence for one side, cheapest evidence first.
 *
 * 1. The site's own links: a G2/Capterra/Product Hunt badge in the footer is proof of a
 *    listing at zero cost and zero hallucination risk. When that already names a platform we
 *    stop there — a Perplexity call could only re-confirm what we can see, and this pipeline
 *    runs at most once per user per 24 h precisely because each run costs real credits.
 * 2. Otherwise, one web-grounded lookup whose every claim is re-verified against the
 *    platform's URL shape before it counts (see parseReviewLookupResponse).
 *
 * Returns null when a lookup was attempted and failed: "the check broke" must not be stored
 * as "this site is listed nowhere", which is what an empty array would assert.
 */
async function observeReviewPlatforms(
  siteLabel: string,
  siteUrl: string,
  homepageLinks: readonly string[],
  deadline: Deadline,
): Promise<string[] | null> {
  const fromLinks = detectReviewPlatformsFromLinks(homepageLinks);
  if (fromLinks.length > 0) return fromLinks;
  // No key configured: the link scan is the whole observation, and the gap wording stays
  // scoped to it ("aucune fiche n'a été trouvée").
  if (!isPerplexityConfigured()) return fromLinks;
  /*
    Budget épuisé : null, et surtout pas `fromLinks`.

    `fromLinks` vaut [] à ce point, et [] AFFIRME « ce site n'est listé nulle part » — ce qui
    suffit à créer un écart « tu n'as aucune fiche d'avis ». Or on n'a pas regardé : un site
    peut très bien avoir une fiche G2 sans y faire de lien depuis son pied de page, et c'est
    précisément ce que la recherche web sert à trouver.

    La branche « pas de clé Perplexity » juste au-dessus rend bien [], et c'est voulu : là,
    le balayage de liens EST tout le relevé, toujours, et le libellé de l'écart s'y tient.
    Ici le relevé existe et on choisit de ne pas le faire — c'est une mesure manquante, pas
    une mesure vide.
  */
  if (!deadline.hasRoomFor(PERPLEXITY_LOOKUP_MS)) return null;

  const looked = await lookupReviewPresence(siteLabel, siteUrl, {
    timeoutMs: deadline.capTimeout(PERPLEXITY_LOOKUP_MS),
  });
  if (looked === null) return null;
  return mergeReviewPlatforms(fromLinks, looked);
}

/**
 * Optional one-line enrichment for a social-presence gap, via Perplexity's web-grounded
 * Agent API. Called only when the gap already exists (so it costs nothing on the common
 * path) and returns null on any failure — the gap stands on its own factual description.
 */
async function describeCompetitorSocial(
  competitorLabel: string,
  competitorUrl: string,
  missing: readonly string[],
  deadline: Deadline,
): Promise<string | null> {
  if (!isPerplexityConfigured() || missing.length === 0) return null;
  // Une ligne de contexte sur un écart déjà constitué : le premier étage à sacrifier.
  if (!deadline.hasRoomFor(PERPLEXITY_LOOKUP_MS)) return null;

  const platforms = labelPlatforms(missing).join(", ");
  const answer = await askPerplexity(
    `À propos de l'entreprise SaaS "${competitorLabel}" (site : ${competitorUrl}), ` +
      `décris en UNE phrase factuelle et neutre le type de contenu qu'elle publie publiquement sur ${platforms}. ` +
      `Base-toi uniquement sur des sources publiques que tu peux vérifier. ` +
      `Si tu ne trouves pas d'information fiable, réponds exactement : INCONNU. ` +
      `Ne donne aucun chiffre d'audience, aucun nombre d'abonnés, aucune estimation.`,
    { timeoutMs: deadline.capTimeout(PERPLEXITY_LOOKUP_MS) },
  );

  if (!answer) return null;
  const trimmed = answer.trim();
  // The model was told to say INCONNU rather than guess — honour that instead of pasting a
  // hedged non-answer into the user's task list.
  if (/^inconnu\b/i.test(trimmed)) return null;
  return `Ce qu'on observe publiquement : ${trimmed}`;
}

export function describeFailure(label: string, reason: unknown): string {
  if (reason instanceof SiteFetchError || reason instanceof ExtractionError) {
    return `${label} : ${reason.message}`;
  }
  return `${label} : échec inattendu lors de la récupération ou de l'analyse du site.`;
}

export function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Qui encaisse, du signal le moins cher au plus cher.
 *
 * 1. le prestataire déclaré dans le balisage ou les liens — gratuit, déjà récupéré ;
 * 2. la redirection d'un lien d'achat — une requête HTTP ;
 * 3. le clic sur le bouton d'abonnement dans un navigateur — un scrape Firecrawl de plus.
 *
 * Le troisième niveau n'existe que parce que beaucoup de tunnels ne laissent aucune trace
 * ailleurs : le bouton est un gestionnaire JavaScript, et sa destination n'apparaît qu'au
 * clic. Il ne se déclenche que si les deux premiers n'ont rien donné.
 */
async function resolvePaymentProviders(
  declared: string[],
  raw: FetchedSite,
  siteUrl: string,
  deadline: Deadline,
): Promise<string[]> {
  if (declared.length > 0) return declared;

  // Jusqu'à deux redirections sondées l'une après l'autre : bonus, sauté quand le budget
  // ne les couvre plus. Sans cette garde, le plancher de capTimeout les laissait partir
  // après l'épuisement du budget et l'analyse débordait de quelques secondes.
  if (!deadline.hasRoomFor(PEEK_REDIRECT_MS)) return declared;

  const followed = await followPurchaseLinks(raw.pricingLinks, (url) =>
    peekRedirect(url, deadline),
  );
  if (followed.length > 0) return followed;

  if (!raw.pricingUrl) return [];

  const landing = await clickThroughToPayment(raw.pricingUrl, deadline);
  return providerFromLandingUrl(landing, safeHostname(siteUrl)?.replace(/^www\./, "") ?? null);
}
