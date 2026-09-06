import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
// Le pipeline lui-même vit dans analyze.ts, partagé avec /api/teardown. Ce fichier ne
// garde que ce qui touche la base : session, relevés, dédoublonnage, score.
import {
  buildGapCandidates,
  describeFailure,
  fetchAndExtract,
  safeHostname,
} from "@/lib/compare/analyze";
import { isStoredExtractedData, type StoredExtractedData } from "@/lib/compare/site-data";
import { assessPricingCoverage } from "@/lib/compare/comparability";
import { countByPriority, computeScore } from "@/lib/compare/score";
import { orderCompetitors } from "@/lib/competitors/selection";
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
 * comparator pipeline: fetch own SaaS once, then every tracked competitor in turn. For each
 * one: extract structured data via Claude, store a snapshot, apply the hardcoded
 * gap-detection rules, dedupe against that competitor's already-open gaps, insert what is
 * new, and record a score for that face-off.
 *
 * Le SaaS du client n'est relu qu'une fois par exécution, quel que soit le nombre de
 * concurrents : c'est le même site, et le relire trois fois multiplierait la dépense sans
 * produire une seule donnée de plus.
 *
 * Les concurrents sont traités en série et non en parallèle. Chaque passe enchaîne
 * plusieurs fetchs, deux appels Claude et une requête Perplexity ; les lancer tous
 * ensemble déclencherait les limites de débit de ces trois services, et un échec de limite
 * coûte autant qu'un succès.
 *
 * Rate-limited to one run per user per 24 h (see rate-limit.ts) — every run costs real
 * Firecrawl/Claude/Perplexity credits, and CLAUDE.md forbids a full fetch on every click.
 *
 * Response: { ok: true, gapsCount: number, results: [...] }
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

  const { data: trackedCompetitors, error: competitorError } = await supabase
    .from("competitors")
    .select("*")
    .eq("user_id", user.id);
  if (competitorError) {
    return NextResponse.json(
      { ok: false, error: "Erreur lors de la lecture des concurrents." },
      { status: 500 },
    );
  }

  const competitors = orderCompetitors(trackedCompetitors ?? []);
  if (competitors.length === 0) {
    return NextResponse.json({ ok: false, error: "no competitor configured" }, { status: 400 });
  }

  // Rate limit, before every paid step (site fetches, Claude extraction, Perplexity
  // enrichment) and after only the cheap indexed reads above, which the check itself needs.
  //
  // The cooldown exists to stop someone re-analysing THE SAME PAIRS repeatedly, not to block
  // work that has never been done. A freshly added or freshly replaced competitor is
  // therefore let through even if a run happened less than 24 h ago — otherwise the product
  // reads as broken right after adding a competitor.
  //
  // That exemption is keyed on WHEN A PAIR LAST CHANGED, not on "the competitor has no
  // snapshot yet", which is what it used to test. The old test had a hole wide enough to
  // void the whole limit: a competitor site that permanently blocks fetching never produces
  // a snapshot, so the exemption applied on every single run, forever — unbounded Firecrawl,
  // Claude and Perplexity spend on the one case where the runs also never succeed. Comparing
  // timestamps closes it: a pair can only be "new" once per change, and a change is itself
  // limited to once per 30 days (see billing/competitor-slots.ts).
  const now = new Date();

  // La limite ne s'applique qu'en production. En développement, elle rend le produit
  // intestable : on ne peut pas vérifier une modification du pipeline plus d'une fois par
  // jour. Le garde-fou existe pour borner une dépense subie par l'utilisateur final, pas
  // pour gêner celui qui construit l'outil.
  //
  // Chaque exécution coûte malgré tout de vrais crédits Firecrawl, Claude et Perplexity —
  // d'où l'avertissement en console plutôt qu'un contournement silencieux.
  const cooldownEnforced = process.env.NODE_ENV === "production";
  if (!cooldownEnforced) {
    console.warn(
      "[compare] Limite de 24 h levée (hors production). Cette analyse consomme des crédits réels.",
    );
  }

  if (cooldownEnforced) {
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

    const lastRunAt = parseLastRunAt(lastSnapshot?.fetched_at);
    // Le plus récent changement, tous concurrents confondus : ajouter un troisième
    // concurrent doit ouvrir une exécution même si les deux autres ont été analysés ce
    // matin — sinon la place qu'on vient de payer reste vide vingt-quatre heures.
    const pairChangedAt = competitors.reduce<Date | null>((latest, competitor) => {
      const changed =
        parseLastRunAt(competitor.url_changed_at) ?? parseLastRunAt(competitor.created_at);
      if (changed === null) return latest;
      return latest === null || changed.getTime() > latest.getTime() ? changed : latest;
    }, null);
    const isNewPair =
      lastRunAt === null || (pairChangedAt !== null && pairChangedAt.getTime() > lastRunAt.getTime());

    if (!isNewPair) {
      const rateLimit = checkAnalysisRateLimit(lastRunAt, now);
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
  }

  const failureNotes: string[] = [];

  // --- Notre côté, lu une seule fois pour toute l'exécution. ---
  const ownFetch = await fetchAndExtract(
    profile.saas_url,
    safeHostname(profile.saas_url) ?? profile.saas_url,
    false,
  ).then(
    (value) => ({ ok: true as const, value }),
    (reason: unknown) => ({ ok: false as const, reason }),
  );

  if (ownFetch.ok) {
    const { error: insertError } = await supabase.from("site_snapshots").insert({
      user_id: user.id,
      target_type: "own_saas",
      competitor_id: null,
      raw_homepage_html: ownFetch.value.raw.homepageHtml,
      raw_pricing_html: ownFetch.value.raw.pricingHtml,
      extracted_data: ownFetch.value.data as unknown as Json,
    });
    if (insertError) {
      failureNotes.push(`Ton SaaS : échec de l'enregistrement du relevé (${insertError.message}).`);
    }
  } else {
    failureNotes.push(describeFailure("Ton SaaS", ownFetch.reason));
  }

  // Re-read the latest own snapshot rather than trusting only what we just fetched: if this
  // cycle's fetch failed but an earlier successful snapshot exists, fall back to it instead
  // of failing every comparison outright.
  const { data: ownSnapshot } = await supabase
    .from("site_snapshots")
    .select("extracted_data")
    .eq("user_id", user.id)
    .eq("target_type", "own_saas")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Use isStoredExtractedData (not isExtractedSiteData) so pricing_page_found survives this
  // re-read — detectPricingGaps needs it below to avoid comparing unverified pricing data.
  const ownData =
    ownSnapshot && isStoredExtractedData(ownSnapshot.extracted_data)
      ? ownSnapshot.extracted_data
      : null;

  if (!ownData) {
    return NextResponse.json(
      {
        ok: false,
        error:
          failureNotes.length > 0
            ? `Comparaison impossible pour le moment. ${failureNotes.join(" ")}`
            : "Comparaison impossible : aucune donnée disponible pour ton SaaS.",
      },
      { status: 422 },
    );
  }

  // --- Un passage par concurrent suivi. ---
  const results: CompetitorRunResult[] = [];

  for (const competitor of competitors) {
    const outcome = await runForCompetitor({
      supabase,
      userId: user.id,
      ownData,
      competitor,
    });

    if (outcome.note) failureNotes.push(outcome.note);
    if (outcome.result) results.push(outcome.result);
  }

  // Aucun concurrent n'a produit de comparaison : c'est un échec, pas une analyse à zéro
  // écart. Les deux se ressemblent dans l'interface, et les confondre annoncerait « rien à
  // rattraper » à quelqu'un dont les sites n'ont pas pu être lus.
  if (results.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          failureNotes.length > 0
            ? `Comparaison impossible pour le moment. ${failureNotes.join(" ")}`
            : "Comparaison impossible : aucune donnée disponible pour tes concurrents.",
      },
      { status: 422 },
    );
  }

  const gapsCount = results.reduce((sum, result) => sum + result.gapsCount, 0);

  // `coverage` reste au singulier et décrit le concurrent principal : c'est ce que le
  // tableau de bord affiche, et il le recalcule de toute façon depuis les relevés stockés
  // via la même fonction pure. Le détail par concurrent est dans `results`.
  return NextResponse.json({
    ok: true,
    gapsCount,
    coverage: results[0].coverage,
    results,
  });
}

interface CompetitorRunResult {
  competitorId: string;
  label: string;
  gapsCount: number;
  score: number;
  coverage: ReturnType<typeof assessPricingCoverage>;
}

/**
 * Une comparaison, du fetch du concurrent au score enregistré.
 *
 * Renvoie `note` plutôt que de lever : un concurrent dont le site bloque la lecture ne doit
 * pas emporter les deux autres. L'échec est remonté dans la réponse, jamais transformé en
 * résultat vide — un tableau vide et un site illisible ne veulent pas dire la même chose.
 */
async function runForCompetitor({
  supabase,
  userId,
  ownData,
  competitor,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  ownData: StoredExtractedData;
  competitor: { id: string; url: string; name: string | null };
}): Promise<{ result: CompetitorRunResult | null; note: string | null }> {
  const label = competitor.name?.trim() || safeHostname(competitor.url) || "ton concurrent";

  let note: string | null = null;

  // Third-party content is looked up on the competitor side only — see
  // observeThirdPartyMentions for why there is no symmetric lookup on ours.
  const fetched = await fetchAndExtract(competitor.url, label, true).then(
    (value) => ({ ok: true as const, value }),
    (reason: unknown) => ({ ok: false as const, reason }),
  );

  if (fetched.ok) {
    const { error: insertError } = await supabase.from("site_snapshots").insert({
      user_id: userId,
      target_type: "competitor",
      competitor_id: competitor.id,
      raw_homepage_html: fetched.value.raw.homepageHtml,
      raw_pricing_html: fetched.value.raw.pricingHtml,
      extracted_data: fetched.value.data as unknown as Json,
    });
    if (insertError) {
      note = `${label} : échec de l'enregistrement du relevé (${insertError.message}).`;
    }
  } else {
    note = describeFailure(label, fetched.reason);
  }

  const { data: snapshot } = await supabase
    .from("site_snapshots")
    .select("extracted_data")
    .eq("user_id", userId)
    .eq("target_type", "competitor")
    .eq("competitor_id", competitor.id)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const competitorData =
    snapshot && isStoredExtractedData(snapshot.extracted_data) ? snapshot.extracted_data : null;

  if (!competitorData) {
    return { result: null, note: note ?? `${label} : aucune donnée exploitable.` };
  }

  // --- Gap detection: hardcoded rules only, no free-form LLM generation here. ---
  const candidates = await buildGapCandidates({
    ownData,
    competitorData,
    competitorLabel: label,
    competitorUrl: competitor.url,
  });

  const { data: existingOpenGaps, error: existingGapsError } = await supabase
    .from("detected_gaps")
    .select("category, title")
    .eq("user_id", userId)
    .eq("competitor_id", competitor.id)
    .eq("status", "open");
  if (existingGapsError) {
    return {
      result: null,
      note: `${label} : erreur lors de la lecture des écarts déjà détectés.`,
    };
  }

  // Dedup by category+title (each detection rule produces a static, deterministic title —
  // see detect-gaps.ts), not by category alone: category-only dedup would permanently block
  // any other rule in that category once one gap is open (e.g. a later free-tier gap would
  // never fire just because an earlier free-trial gap in "pricing" is still open).
  //
  // Le dédoublonnage est scopé au concurrent : deux concurrents peuvent légitimement
  // produire le même écart (« pas d'essai gratuit chez toi » vaut face aux deux), et ce sont
  // deux tâches distinctes puisqu'elles se ferment séparément.
  const existingGapKeys = new Set<string>(
    (existingOpenGaps ?? []).map((gap) => `${gap.category}::${gap.title}`),
  );
  const newGaps = candidates.filter((c) => !existingGapKeys.has(`${c.category}::${c.title}`));

  let gapsCount = 0;
  if (newGaps.length > 0) {
    const { data: inserted, error: insertGapsError } = await supabase
      .from("detected_gaps")
      .insert(
        newGaps.map((gap) => ({
          user_id: userId,
          competitor_id: competitor.id,
          category: gap.category,
          title: gap.title,
          description: gap.description,
          priority: gap.priority,
        })),
      )
      .select();
    if (insertGapsError) {
      return {
        result: null,
        note: `${label} : erreur lors de l'enregistrement des écarts détectés.`,
      };
    }
    gapsCount = inserted?.length ?? 0;
  }

  // --- Score de CE face-à-face. ---
  //
  // Un score par concurrent, et non un score global : la page /score promet « ce qu'il te
  // reste à rattraper face à X ». Additionner trois comparaisons dans un chiffre unique
  // donnerait une valeur que personne ne peut reconstituer, et qui baisserait en ajoutant
  // un concurrent — c'est-à-dire en achetant une place.
  const { data: openGaps, error: openGapsError } = await supabase
    .from("detected_gaps")
    .select("priority")
    .eq("user_id", userId)
    .eq("competitor_id", competitor.id)
    .eq("status", "open");
  if (openGapsError) {
    return { result: null, note: `${label} : erreur lors du calcul du score.` };
  }

  const score = computeScore(countByPriority(openGaps ?? []));

  const { error: scoreInsertError } = await supabase
    .from("score_history")
    .insert({ user_id: userId, competitor_id: competitor.id, score });
  if (scoreInsertError) {
    return { result: null, note: `${label} : erreur lors de l'enregistrement du score.` };
  }

  // Ce que le comparateur n'a pas pu mesurer. Renvoyé dans la réponse parce qu'un appelant
  // direct de l'endpoint (le brief prévoit un test au curl) verrait sinon un gapsCount bas
  // sans savoir qu'une moitié des règles n'avait aucune matière. Le tableau de bord
  // recalcule le même constat depuis les relevés stockés, via la même fonction pure : les
  // deux ne peuvent pas diverger.
  const coverage = assessPricingCoverage(
    { pageFound: ownData.pricing_page_found, tierCount: ownData.pricing_tiers.length },
    {
      pageFound: competitorData.pricing_page_found,
      tierCount: competitorData.pricing_tiers.length,
    },
    label,
  );

  return {
    result: { competitorId: competitor.id, label, gapsCount, score, coverage },
    note,
  };
}
