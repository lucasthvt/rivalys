import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchSite, SiteFetchError, type FetchedSite } from "@/lib/compare/fetch-site";
import { stripHtml } from "@/lib/compare/html";
import { extractSiteData, classifyPositioning, ExtractionError } from "@/lib/compare/extract";
import { isStoredExtractedData, type StoredExtractedData } from "@/lib/compare/site-data";
import { detectPricingGaps, buildPositioningGap, type GapCandidate } from "@/lib/compare/detect-gaps";
import { countByPriority, computeScore } from "@/lib/compare/score";
import type { Json } from "@/lib/supabase/database.types";

/**
 * POST /api/compare
 *
 * No request body — operates on the authenticated user's session (cookies). Runs the full
 * comparator pipeline: fetch own SaaS + primary competitor, extract structured data via
 * Claude, store snapshots, apply hardcoded gap-detection rules, dedupe against already-open
 * gaps, insert new ones, and recompute the score.
 *
 * Response: { ok: true, gapsCount: number } | { ok: false, error: string }
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

  const competitorLabel = competitor.name?.trim() || safeHostname(competitor.url) || "ton concurrent";

  // Fetch + extract both sides independently — one failing (e.g. the competitor's site
  // blocking us) must never take down the other side's result.
  const [ownResult, competitorResult] = await Promise.allSettled([
    fetchAndExtract(profile.saas_url),
    fetchAndExtract(competitor.url),
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

async function fetchAndExtract(url: string): Promise<{ raw: FetchedSite; data: StoredExtractedData }> {
  const raw = await fetchSite(url);
  const data = await extractSiteData({
    homepageText: stripHtml(raw.homepageHtml),
    pricingText: raw.pricingHtml ? stripHtml(raw.pricingHtml) : null,
    pricingPageFound: raw.pricingUrl !== null,
  });
  return { raw, data };
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
