import { NextResponse } from "next/server";
import {
  buildGapCandidates,
  describeFailure,
  fetchAndExtract,
  safeHostname,
} from "@/lib/compare/analyze";
import { assessPricingCoverage } from "@/lib/compare/comparability";
import { countByPriority, computeScore } from "@/lib/compare/score";
import { assertPublicHttpUrl, coerceUserUrl, UnsafeUrlError } from "@/lib/compare/url-safety";
import { checkBotId } from "botid/server";
import {
  clientIp,
  dailyCeilingReached,
  hashIp,
  hasUsedFreeAnalysis,
  markFreeAnalysisUsed,
  normalizeUrl,
  pairKey,
  readCachedResult,
  toPublicResult,
  writeCachedResult,
  type FullResult,
} from "@/lib/compare/public-teardown";

/**
 * POST /api/public-teardown — l'analyse gratuite de la page d'accueil, sans compte.
 *
 * Mêmes règles que /api/compare : les deux passent par buildGapCandidates. Ce qui change
 * est ce qui SORT — voir toPublicResult. Le contenu masqué n'est pas flouté, il n'est pas
 * envoyé : un flou CSS reste lisible dans le HTML, et cette page est publique.
 *
 * L'ordre des contrôles n'est pas arbitraire. Tout ce qui est gratuit passe avant tout ce
 * qui coûte : validation, détection de robot, puis cache. Une paire déjà analysée est
 * servie sans toucher au quota — elle ne dépense rien, la refuser ne protégerait rien.
 *
 * Body : { ownUrl, competitorUrl }
 */

export const maxDuration = 300;

/** Cette route ne répond qu'en POST ; un GET ne doit pas renvoyer 405 pour autant. */
export async function GET() {
  return new NextResponse(null, { status: 404 });
}

function fail(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Requête illisible.", 400);
  }

  const { ownUrl, competitorUrl } = (body ?? {}) as {
    ownUrl?: unknown;
    competitorUrl?: unknown;
  };

  if (typeof ownUrl !== "string" || typeof competitorUrl !== "string") {
    return fail("Il faut deux adresses de site.", 400);
  }

  // « brevo.com » est ce qu'on tape ; « https://brevo.com » est ce dont le pipeline a
  // besoin. La complétion se fait ici, avant toute validation, pour que les deux formes
  // produisent la même clé de cache et donc une seule analyse payante.
  const own = coerceUserUrl(ownUrl);
  const rival = coerceUserUrl(competitorUrl);

  for (const [label, url] of [
    ["Ton site", own],
    ["Le site de ton concurrent", rival],
  ] as const) {
    try {
      assertPublicHttpUrl(url);
    } catch (error) {
      const detail = error instanceof UnsafeUrlError ? error.message : "adresse invalide.";
      return fail(`${label} : ${detail}`, 400);
    }
  }

  let key: string;
  try {
    key = pairKey(own, rival);
  } catch {
    return fail("Une des deux adresses n'est pas lisible.", 400);
  }

  if (normalizeUrl(own) === normalizeUrl(rival)) {
    return fail("Les deux adresses pointent vers le même site.", 400);
  }

  const ip = clientIp(request);

  // BotID plutôt qu'un captcha : la vérification est invisible, le visiteur n'a rien à
  // cocher. Sur une page d'accueil, le moindre obstacle avant la première valeur fait
  // partir des gens que le produit n'a pas encore convaincus.
  //
  // La route doit être déclarée à l'identique dans src/instrumentation-client.ts, sans quoi
  // le navigateur ne joint pas les en-têtes de classification et cet appel échoue à chaque
  // fois. En développement, la vérification renvoie toujours « pas un robot » — le quota
  // reste donc le seul garde-fou testable en local, et c'est voulu.
  const { isBot } = await checkBotId();
  if (isBot) {
    return fail("Requête refusée.", 403);
  }

  // Cache d'abord : gratuit, instantané, et hors quota.
  const cached = await readCachedResult(key);
  if (cached) {
    return NextResponse.json({ ok: true, result: toPublicResult(cached, true) });
  }

  // À partir d'ici, l'analyse coûte de l'argent.
  if (!ip) {
    return fail("Impossible d'identifier la provenance de la requête.", 400);
  }

  const ipHash = hashIp(ip);
  if (!ipHash) {
    // TEARDOWN_IP_SALT absent : sans quota vérifiable, l'offre est illimitée pour
    // qui la scripte. Fermer est le seul défaut acceptable.
    console.error("[public-teardown] TEARDOWN_IP_SALT absent — analyse refusée.");
    return fail("L'analyse gratuite est momentanément indisponible.", 503);
  }

  if (await hasUsedFreeAnalysis(ipHash)) {
    return fail(
      "Tu as déjà utilisé ton analyse gratuite. Crée un compte pour analyser ton SaaS et suivre l'écart dans le temps.",
      429,
      { quotaSpent: true },
    );
  }

  if (await dailyCeilingReached(new Date())) {
    return fail(
      "Beaucoup de monde en ce moment : les analyses gratuites reprennent d'ici quelques heures. Un compte te donne un accès immédiat.",
      503,
      { ceilingReached: true },
    );
  }

  const ownLabel = safeHostname(own) ?? own;
  const competitorLabel = safeHostname(rival) ?? rival;

  const [ownResult, competitorResult] = await Promise.allSettled([
    fetchAndExtract(own, ownLabel, false),
    fetchAndExtract(rival, competitorLabel, true),
  ]);

  // Un échec de récupération ne consomme pas l'essai : le visiteur n'a rien obtenu, et
  // beaucoup de sites bloquent au premier passage. Lui faire payer notre échec avec son
  // unique analyse serait la pire première impression possible.
  if (ownResult.status !== "fulfilled" || competitorResult.status !== "fulfilled") {
    const notes = [
      ownResult.status === "rejected" ? describeFailure(ownLabel, ownResult.reason) : null,
      competitorResult.status === "rejected"
        ? describeFailure(competitorLabel, competitorResult.reason)
        : null,
    ].filter(Boolean);

    return fail(
      `Analyse impossible. ${notes.join(" ")} Ton essai gratuit est intact.`.trim(),
      422,
    );
  }

  const ownData = ownResult.value.data;
  const competitorData = competitorResult.value.data;

  const gaps = await buildGapCandidates({
    ownData,
    competitorData,
    competitorLabel,
    competitorUrl: rival,
  });

  const full: FullResult = {
    ownLabel,
    competitorLabel,
    score: computeScore(countByPriority(gaps)),
    gaps,
    coverage: assessPricingCoverage(
      { pageFound: ownData.pricing_page_found, tierCount: ownData.pricing_tiers.length },
      {
        pageFound: competitorData.pricing_page_found,
        tierCount: competitorData.pricing_tiers.length,
      },
      competitorLabel,
    ),
  };

  // Le cache d'abord, le quota ensuite : si l'écriture du cache échoue, mieux vaut ne pas
  // avoir déjà brûlé l'essai du visiteur.
  await writeCachedResult(key, own, rival, full);
  await markFreeAnalysisUsed(ipHash);

  return NextResponse.json({ ok: true, result: toPublicResult(full, false) });
}
