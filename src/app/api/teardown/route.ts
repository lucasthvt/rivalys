import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildGapCandidates,
  describeFailure,
  fetchAndExtract,
  safeHostname,
} from "@/lib/compare/analyze";
import { assessPricingCoverage } from "@/lib/compare/comparability";
import { countByPriority, computeScore } from "@/lib/compare/score";
import { assertPublicHttpUrl, coerceUserUrl, UnsafeUrlError } from "@/lib/compare/url-safety";

/**
 * POST /api/teardown — analyse une paire d'URL arbitraire, sans rien enregistrer.
 *
 * Sert à filmer des démos : deux sites qu'on ne possède ni l'un ni l'autre, le vrai
 * pipeline, le vrai résultat. Exactement les mêmes règles que /api/compare, parce que les
 * deux appellent buildGapCandidates — une démo ne peut donc pas montrer autre chose que ce
 * que le produit fait pour un client.
 *
 * Trois différences avec /api/compare, toutes voulues :
 *   - aucune écriture : ni relevé, ni écart, ni point de score. Les tournages ne polluent
 *     pas les données réelles, et le score_history reste l'historique du produit ;
 *   - pas de limite 24 h : elle protège la dépense d'un client, or ici c'est la nôtre, et
 *     refaire une prise ne doit pas attendre le lendemain ;
 *   - réservé à un seul compte (voir plus bas), justement parce que les deux points
 *     ci-dessus retirent les garde-fous de dépense.
 *
 * Body : { ownUrl: string, competitorUrl: string }
 */

export const maxDuration = 300;

/**
 * Sans ce handler, Next répond 405 à un GET — et un 405 est un aveu : il dit qu'une route
 * existe ici, là où une adresse inexistante répondrait 404. La route doit rester
 * indiscernable du néant pour qui n'a rien à y faire, donc GET renvoie 404 comme le reste.
 */
export async function GET() {
  return new NextResponse(null, { status: 404 });
}

/**
 * Réservé au compte nommé par TEARDOWN_ADMIN_EMAIL.
 *
 * Chaque exécution dépense de vrais crédits Firecrawl, Claude et Perplexity, sans la limite
 * de 24 h qui borne /api/compare. Laissée ouverte, cette route viderait le budget en une
 * nuit — c'est un outil interne, pas une surface produit.
 *
 * Réponse 404 et non 403 : un 403 confirmerait que la route existe. Sans la variable
 * d'environnement, personne ne passe, y compris nous — un secret absent doit fermer la
 * porte, jamais l'ouvrir.
 */
async function isOperator(): Promise<boolean> {
  const allowed = process.env.TEARDOWN_ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowed) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.email) return false;

  return data.user.email.trim().toLowerCase() === allowed;
}

export async function POST(request: Request) {
  if (!(await isOperator())) {
    return new NextResponse(null, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Corps de requête illisible." }, { status: 400 });
  }

  const { ownUrl, competitorUrl } = (body ?? {}) as {
    ownUrl?: unknown;
    competitorUrl?: unknown;
  };
  if (typeof ownUrl !== "string" || typeof competitorUrl !== "string") {
    return NextResponse.json(
      { ok: false, error: "Deux URL sont attendues : ownUrl et competitorUrl." },
      { status: 400 },
    );
  }

  // Saisies humaines : « linear.app » vaut « https://linear.app ». La complétion précède
  // le contrôle, qui reste le même que côté produit — pas de schéma exotique, pas
  // d'adresse interne. Les URL venant d'un champ libre, c'est la seule barrière avant un
  // fetch sortant.
  const own = coerceUserUrl(ownUrl);
  const rival = coerceUserUrl(competitorUrl);

  for (const [label, url] of [
    ["Premier site", own],
    ["Second site", rival],
  ] as const) {
    try {
      assertPublicHttpUrl(url);
    } catch (error) {
      const detail = error instanceof UnsafeUrlError ? error.message : "URL invalide.";
      return NextResponse.json({ ok: false, error: `${label} : ${detail}` }, { status: 400 });
    }
  }

  const ownLabel = safeHostname(own) ?? own;
  const competitorLabel = safeHostname(rival) ?? rival;

  // Les deux côtés sont indépendants : un site qui bloque le fetch ne doit pas emporter
  // l'autre. Même choix que /api/compare.
  const [ownResult, competitorResult] = await Promise.allSettled([
    fetchAndExtract(own, ownLabel, false),
    // Le relevé de contenus tiers ne tourne que sur le second site, comme côté produit où
    // il est réservé au concurrent.
    fetchAndExtract(rival, competitorLabel, true),
  ]);

  const failureNotes: string[] = [];
  if (ownResult.status === "rejected") {
    failureNotes.push(describeFailure(ownLabel, ownResult.reason));
  }
  if (competitorResult.status === "rejected") {
    failureNotes.push(describeFailure(competitorLabel, competitorResult.reason));
  }

  // Pas de repli sur un relevé antérieur, contrairement à /api/compare : il n'y a pas de
  // base ici. Un côté qui échoue arrête la comparaison, plutôt que de la construire sur du
  // vide — c'est ce que demande CLAUDE.md, dire que la donnée manque au lieu de l'inventer.
  if (ownResult.status !== "fulfilled" || competitorResult.status !== "fulfilled") {
    return NextResponse.json(
      {
        ok: false,
        error: `Comparaison impossible. ${failureNotes.join(" ")}`.trim(),
      },
      { status: 422 },
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

  // Le score d'une paire isolée : calculé sur les seuls écarts de cette analyse. Côté
  // produit il porte sur tous les écarts ouverts du compte — ici il n'y a pas de compte,
  // donc pas d'historique et rien à cumuler.
  const score = computeScore(countByPriority(gaps));

  const coverage = assessPricingCoverage(
    { pageFound: ownData.pricing_page_found, tierCount: ownData.pricing_tiers.length },
    {
      pageFound: competitorData.pricing_page_found,
      tierCount: competitorData.pricing_tiers.length,
    },
    competitorLabel,
  );

  return NextResponse.json({
    ok: true,
    own: { label: ownLabel, url: own, data: ownData },
    competitor: { label: competitorLabel, url: rival, data: competitorData },
    gaps,
    score,
    coverage,
  });
}
