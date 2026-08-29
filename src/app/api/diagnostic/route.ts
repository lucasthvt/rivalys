import { NextResponse, type NextRequest } from "next/server";
import { fetchSite, SiteFetchError } from "@/lib/compare/fetch-site";
import { detectAuthMethods, labelAuthMethods } from "@/lib/compare/auth-methods";
import {
  detectPaymentMethods,
  detectPaymentProviders,
  labelPaymentMethods,
  labelPaymentProviders,
} from "@/lib/compare/payment-methods";
import { detectSocialPlatforms, labelPlatforms } from "@/lib/compare/social";

/**
 * GET /api/diagnostic?url=…  — outil de développement, jamais servi en production.
 *
 * Montre ce que les détecteurs déterministes relèvent RÉELLEMENT sur un site donné :
 * quelles pages ont été trouvées, ce qui a été lu, et l'extrait de texte sur lequel la
 * décision s'est prise. Sans lui, la seule façon de vérifier un site était de lancer une
 * analyse complète et de deviner à partir du résultat affiché.
 *
 * L'existence de cet endpoint est un aveu utile : les motifs de détection sont calibrés
 * sur les quelques sites qu'on a regardés. Chaque site réel qui les prend en défaut est
 * une correction à écrire, et il faut pouvoir le constater en deux secondes.
 *
 * Fermé en production : il déclenche des récupérations de pages payantes (Firecrawl) sans
 * limite de débit ni authentification.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Indisponible." }, { status: 404 });
  }

  const target = request.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json(
      { error: "Paramètre `url` manquant. Exemple : /api/diagnostic?url=https://notion.so" },
      { status: 400 },
    );
  }

  const startedAt = Date.now();

  let raw;
  try {
    raw = await fetchSite(target);
  } catch (error) {
    return NextResponse.json(
      {
        erreur:
          error instanceof SiteFetchError
            ? error.message
            : "Échec inattendu lors de la récupération du site.",
        secondes: Math.round((Date.now() - startedAt) / 1000),
      },
      { status: 502 },
    );
  }

  const links = [...raw.homepageLinks, ...raw.loginLinks];
  const markup = [raw.homepageHtml ?? "", raw.pricingHtml ?? ""].join("\n");

  const auth = detectAuthMethods({ loginPageText: raw.loginText, links });
  const paymentMethods = detectPaymentMethods({
    pricingText: raw.pricingText,
    homepageText: raw.homepageText,
    links,
    html: markup,
  });
  const paymentProviders = detectPaymentProviders({ links, html: markup });
  const social = detectSocialPlatforms(raw.homepageLinks);

  return NextResponse.json({
    site: target,
    secondes: Math.round((Date.now() - startedAt) / 1000),
    firecrawl: Boolean(process.env.FIRECRAWL_API_KEY),

    pages: {
      tarifs: raw.pricingUrl ?? "introuvable",
      connexion: raw.loginUrl ?? "introuvable",
      texteConnexion: raw.loginText ? `${raw.loginText.length} caractères` : "aucun",
    },

    releve: {
      connexion: auth.length > 0 ? labelAuthMethods(auth) : "rien relevé",
      moyensPaiement:
        paymentMethods.length > 0 ? labelPaymentMethods(paymentMethods) : "rien relevé",
      prestatairePaiement:
        paymentProviders.length > 0 ? labelPaymentProviders(paymentProviders) : "rien relevé",
      reseaux: social.length > 0 ? labelPlatforms(social) : "rien relevé",
    },

    // La matière brute sur laquelle la décision s'est prise : c'est elle qui dit si un
    // relevé vide vient d'un motif trop strict ou d'une page qui ne contient rien.
    // Liens de la page de tarifs : c'est là qu'un bouton d'abonnement mène, quand il
    // s'agit d'un vrai lien et non d'un gestionnaire JavaScript.
    liensTarifs: raw.pricingLinks.slice(0, 25),

    extraits: {
      connexion: raw.loginText?.slice(0, 600).replace(/\s+/g, " ") ?? null,
      tarifs: raw.pricingText?.slice(0, 400).replace(/\s+/g, " ") ?? null,
    },
  });
}
