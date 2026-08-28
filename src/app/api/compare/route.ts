import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchSite, SiteFetchError, type FetchedSite } from "@/lib/compare/fetch-site";
import { extractSiteData, classifyPositioning, ExtractionError } from "@/lib/compare/extract";
import {
  isStoredExtractedData,
  readReviewPlatforms,
  readSocialPlatforms,
  readThirdPartyMentions,
  type StoredExtractedData,
} from "@/lib/compare/site-data";
import {
  detectPricingGaps,
  buildPositioningGap,
  detectReviewPresenceGap,
  detectSocialPresenceGap,
  detectThirdPartyPresenceGap,
  type GapCandidate,
} from "@/lib/compare/detect-gaps";
import { detectSocialPlatforms, labelPlatforms, missingPlatforms } from "@/lib/compare/social";
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
import { countByPriority, computeScore } from "@/lib/compare/score";
import {
  checkAnalysisRateLimit,
  parseLastRunAt,
  rateLimitMessage,
  retryAfterSeconds,
} from "@/lib/compare/rate-limit";
import type { Json } from "@/lib/supabase/database.types";

/**
 * POST /api/compare
 *
 * No request body — operates on the authenticated user's session (cookies). Runs the full
 * comparator pipeline: fetch own SaaS + primary competitor, extract structured data via
 * Claude, store snapshots, apply hardcoded gap-detection rules, dedupe against already-open
 * gaps, insert new ones, and recompute the score.
 *
 * Rate-limited to one run per user per 24 h (see rate-limit.ts) — every run costs real
 * Firecrawl/Claude/Perplexity credits, and CLAUDE.md forbids a full fetch on every click.
 *
 * Response: { ok: true, gapsCount: number }
 *         | { ok: false, error: string }
 *         | { ok: false, error: string, retryAfterIso: string }   (429, + Retry-After header)
 */
export async function POST() {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return NextResponse.json({ ok: false, error: "Non authentifié." }, { status: 401 });
  }
  const user = userData.user;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la lecture du profil." },
      { status: 500 },
    );
  }
  if (!profile || !profile.saas_url) {
    return NextResponse.json(
      { ok: false, error: "Profil incomplet : aucune URL de SaaS renseignée." },
      { status: 400 },
    );
  }

  const { data: competitor, error: competitorError } = await supabase
    .from("competitors")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_primary", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (competitorError) {
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la lecture du concurrent." },
      { status: 500 },
    );
  }
  if (!competitor) {
    return NextResponse.json({ ok: false, error: "no competitor configured" }, { status: 400 });
  }

  // Rate limit, before every paid step (site fetches, Claude extraction, Perplexity
  // enrichment) and after only the two cheap indexed reads above, which the check itself
  // needs.
  //
  // The cooldown exists to stop someone re-analysing THE SAME PAIR repeatedly, not to block
  // work that has never been done. So a competitor with no snapshot of its own is always
  // allowed through: that is either a first analysis, or one that follows a competitor
  // change (setCompetitor deletes the previous competitor's snapshots precisely because
  // they describe a site the user no longer tracks — see app/concurrent/actions.ts).
  // Without this exemption, adding a competitor within 24 h of a previous run would be
  // refused, which reads as the product being broken.
  const { data: competitorSnapshot, error: competitorSnapshotError } = await supabase
    .from("site_snapshots")
    .select("id")
    .eq("user_id", user.id)
    .eq("target_type", "competitor")
    .eq("competitor_id", competitor.id)
    .limit(1)
    .maybeSingle();
  if (competitorSnapshotError) {
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la vérification de la dernière analyse." },
      { status: 500 },
    );
  }

  const now = new Date();
  if (competitorSnapshot) {
    const { data: lastSnapshot, error: lastSnapshotError } = await supabase
      .from("site_snapshots")
      .select("fetched_at")
      .eq("user_id", user.id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastSnapshotError) {
      // Fail closed, like the other read failures: if we cannot tell when the last run
      // happened, spending money is the wrong default.
      return NextResponse.json(
        { ok: false, error: "Erreur lors de la vérification de la dernière analyse." },
        { status: 500 },
      );
    }

    const rateLimit = checkAnalysisRateLimit(parseLastRunAt(lastSnapshot?.fetched_at), now);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: rateLimitMessage(rateLimit.retryAt, now),
          retryAfterIso: rateLimit.retryAt.toISOString(),
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds(rateLimit.retryAt, now)) },
        },
      );
    }
  }

  const competitorLabel = competitor.name?.trim() || safeHostname(competitor.url) || "ton concurrent";

  // Fetch + extract both sides independently — one failing (e.g. the competitor's site
  // blocking us) must never take down the other side's result.
  const [ownResult, competitorResult] = await Promise.allSettled([
    fetchAndExtract(profile.saas_url, safeHostname(profile.saas_url) ?? profile.saas_url, false),
    // Third-party content is looked up on the competitor side only — see
    // observeThirdPartyMentions for why there is no symmetric lookup on ours.
    fetchAndExtract(competitor.url, competitorLabel, true),
  ]);

  const failureNotes: string[] = [];

  if (ownResult.status === "fulfilled") {
    const { error: insertError } = await supabase.from("site_snapshots").insert({
      user_id: user.id,
      target_type: "own_saas",
      competitor_id: null,
      raw_homepage_html: ownResult.value.raw.homepageHtml,
      raw_pricing_html: ownResult.value.raw.pricingHtml,
      extracted_data: ownResult.value.data as unknown as Json,
    });
    if (insertError) {
      failureNotes.push(`Ton SaaS : échec de l'enregistrement du relevé (${insertError.message}).`);
    }
  } else {
    failureNotes.push(describeFailure("Ton SaaS", ownResult.reason));
  }

  if (competitorResult.status === "fulfilled") {
    const { error: insertError } = await supabase.from("site_snapshots").insert({
      user_id: user.id,
      target_type: "competitor",
      competitor_id: competitor.id,
      raw_homepage_html: competitorResult.value.raw.homepageHtml,
      raw_pricing_html: competitorResult.value.raw.pricingHtml,
      extracted_data: competitorResult.value.data as unknown as Json,
    });
    if (insertError) {
      failureNotes.push(`${competitorLabel} : échec de l'enregistrement du relevé (${insertError.message}).`);
    }
  } else {
    failureNotes.push(describeFailure(competitorLabel, competitorResult.reason));
  }

  // Re-read the latest snapshot for each side rather than trusting only what we just
  // fetched: if this cycle's fetch failed for one side but an earlier successful snapshot
  // exists (cached), fall back to it instead of failing the whole comparison outright.
  const [ownSnapshotRes, competitorSnapshotRes] = await Promise.all([
    supabase
      .from("site_snapshots")
      .select("extracted_data")
      .eq("user_id", user.id)
      .eq("target_type", "own_saas")
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("site_snapshots")
      .select("extracted_data")
      .eq("user_id", user.id)
      .eq("target_type", "competitor")
      .eq("competitor_id", competitor.id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Use isStoredExtractedData (not isExtractedSiteData) so pricing_page_found survives this
  // re-read — detectPricingGaps needs it below to avoid comparing unverified pricing data.
  const ownData = ownSnapshotRes.data && isStoredExtractedData(ownSnapshotRes.data.extracted_data)
    ? ownSnapshotRes.data.extracted_data
    : null;
  const competitorData =
    competitorSnapshotRes.data && isStoredExtractedData(competitorSnapshotRes.data.extracted_data)
      ? competitorSnapshotRes.data.extracted_data
      : null;

  if (!ownData || !competitorData) {
    return NextResponse.json(
      {
        ok: false,
        error:
          failureNotes.length > 0
            ? `Comparaison impossible pour le moment. ${failureNotes.join(" ")}`
            : "Comparaison impossible : aucune donnée disponible pour ton SaaS et/ou ton concurrent.",
      },
      { status: 422 },
    );
  }

  // --- Gap detection: hardcoded rules only, no free-form LLM generation here. ---
  const candidates: GapCandidate[] = [
    ...detectPricingGaps(
      ownData,
      competitorData,
      competitorLabel,
      ownData.pricing_page_found,
      competitorData.pricing_page_found,
    ),
  ];

  const veryDifferent = await classifyPositioning(ownData.value_proposition, competitorData.value_proposition);
  const positioningGap = buildPositioningGap(ownData, competitorData, veryDifferent, competitorLabel);
  if (positioningGap) candidates.push(positioningGap);

  // Social presence: detected from each site's own published links (deterministic), then
  // optionally enriched with one web-grounded Perplexity call. Both sides must actually have
  // been observed — see readSocialPlatforms' null-vs-[] contract.
  const ownSocial = readSocialPlatforms(ownData);
  const competitorSocial = readSocialPlatforms(competitorData);

  if (ownSocial !== null && competitorSocial !== null) {
    const missing = missingPlatforms(ownSocial, competitorSocial);
    const socialNote = missing.length > 0
      ? await describeCompetitorSocial(competitorLabel, competitor.url, missing)
      : null;
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

  const { data: existingOpenGaps, error: existingGapsError } = await supabase
    .from("detected_gaps")
    .select("category, title")
    .eq("user_id", user.id)
    .eq("competitor_id", competitor.id)
    .eq("status", "open");
  if (existingGapsError) {
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la lecture des écarts déjà détectés." },
      { status: 500 },
    );
  }
  // Dedup by category+title (each detection rule produces a static, deterministic title —
  // see detect-gaps.ts), not by category alone: category-only dedup would permanently block
  // any other rule in that category once one gap is open (e.g. a later free-tier gap would
  // never fire just because an earlier free-trial gap in "pricing" is still open).
  const existingGapKeys = new Set<string>(
    (existingOpenGaps ?? []).map((g) => `${g.category}::${g.title}`),
  );
  const newGaps = candidates.filter((c) => !existingGapKeys.has(`${c.category}::${c.title}`));

  let insertedCount = 0;
  if (newGaps.length > 0) {
    const { data: inserted, error: insertGapsError } = await supabase
      .from("detected_gaps")
      .insert(
        newGaps.map((g) => ({
          user_id: user.id,
          competitor_id: competitor.id,
          category: g.category,
          title: g.title,
          description: g.description,
          priority: g.priority,
        })),
      )
      .select();
    if (insertGapsError) {
      return NextResponse.json(
        { ok: false, error: "Erreur lors de l'enregistrement des écarts détectés." },
        { status: 500 },
      );
    }
    insertedCount = inserted?.length ?? 0;
  }

  // --- Score recompute over ALL of this user's open gaps (all competitors), per spec. ---
  const { data: openGapsForScore, error: openGapsError } = await supabase
    .from("detected_gaps")
    .select("priority")
    .eq("user_id", user.id)
    .eq("status", "open");
  if (openGapsError) {
    return NextResponse.json(
      { ok: false, error: "Erreur lors du calcul du score." },
      { status: 500 },
    );
  }
  const score = computeScore(countByPriority(openGapsForScore ?? []));

  const { error: scoreInsertError } = await supabase
    .from("score_history")
    .insert({ user_id: user.id, score });
  if (scoreInsertError) {
    return NextResponse.json(
      { ok: false, error: "Erreur lors de l'enregistrement du score." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, gapsCount: insertedCount });
}

async function fetchAndExtract(
  url: string,
  siteLabel: string,
  observeMentions: boolean,
): Promise<{ raw: FetchedSite; data: StoredExtractedData }> {
  const raw = await fetchSite(url);
  const extracted = await extractSiteData({
    homepageText: raw.homepageText,
    pricingText: raw.pricingText,
    pricingPageFound: raw.pricingUrl !== null,
  });
  // Social platforms come from the site's own published links, not from the LLM — see
  // social.ts. Stored alongside the extraction so the gap rule can compare both sides.
  const socialPlatforms = detectSocialPlatforms(raw.homepageLinks);
  const data: StoredExtractedData = {
    ...extracted,
    social_platforms: socialPlatforms,
  };

  // Review platforms: presence on G2/Capterra/Trustpilot/Product Hunt, never a rating.
  // The field is left out entirely when the check couldn't complete, so readReviewPlatforms
  // returns null and no comparison is built on it.
  const reviewPlatforms = await observeReviewPlatforms(siteLabel, url, raw.homepageLinks);
  if (reviewPlatforms !== null) data.review_platforms = reviewPlatforms;

  if (observeMentions) {
    const mentions = await observeThirdPartyMentions(siteLabel, url, socialPlatforms);
    if (mentions !== null) data.third_party_mentions = mentions;
  }

  return { raw, data };
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
): Promise<ThirdPartyMention[] | null> {
  if (!isPerplexityConfigured()) return null;

  const linked = new Set(linkedPlatforms);
  const toCheck = MENTION_PLATFORM_IDS.filter((id) => !linked.has(id));
  if (toCheck.length === 0) return null;

  return lookupThirdPartyMentions(siteLabel, siteUrl, toCheck);
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
): Promise<string[] | null> {
  const fromLinks = detectReviewPlatformsFromLinks(homepageLinks);
  if (fromLinks.length > 0) return fromLinks;
  // No key configured: the link scan is the whole observation, and the gap wording stays
  // scoped to it ("aucune fiche n'a été trouvée").
  if (!isPerplexityConfigured()) return fromLinks;

  const looked = await lookupReviewPresence(siteLabel, siteUrl);
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
): Promise<string | null> {
  if (!isPerplexityConfigured() || missing.length === 0) return null;

  const platforms = labelPlatforms(missing).join(", ");
  const answer = await askPerplexity(
    `À propos de l'entreprise SaaS "${competitorLabel}" (site : ${competitorUrl}), ` +
      `décris en UNE phrase factuelle et neutre le type de contenu qu'elle publie publiquement sur ${platforms}. ` +
      `Base-toi uniquement sur des sources publiques que tu peux vérifier. ` +
      `Si tu ne trouves pas d'information fiable, réponds exactement : INCONNU. ` +
      `Ne donne aucun chiffre d'audience, aucun nombre d'abonnés, aucune estimation.`,
  );

  if (!answer) return null;
  const trimmed = answer.trim();
  // The model was told to say INCONNU rather than guess — honour that instead of pasting a
  // hedged non-answer into the user's task list.
  if (/^inconnu\b/i.test(trimmed)) return null;
  return `Ce qu'on observe publiquement : ${trimmed}`;
}

function describeFailure(label: string, reason: unknown): string {
  if (reason instanceof SiteFetchError || reason instanceof ExtractionError) {
    return `${label} : ${reason.message}`;
  }
  return `${label} : échec inattendu lors de la récupération ou de l'analyse du site.`;
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
