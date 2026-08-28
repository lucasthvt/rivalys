// On-demand fetch of a single site's homepage + pricing page, triggered explicitly by a
// user action (never an autonomous crawl — see CLAUDE.md "Contraintes de fond").
//
// Two paths, in order:
//   1. Firecrawl (when FIRECRAWL_API_KEY is set) — renders JS, returns clean markdown plus
//      the page's outbound links. Two scrapes per site: the homepage, then the pricing page
//      discovered from those links.
//   2. Direct fetch — the original path, kept as a fallback so a missing key or a Firecrawl
//      outage degrades quality rather than breaking the comparator.
// Both paths produce the same FetchedSite shape.

import { assertPublicHttpUrl, UnsafeUrlError } from "./url-safety";
import { extractLinks, stripHtml } from "./html";
import { FirecrawlError, isFirecrawlConfigured, scrapePage } from "./firecrawl";

export class SiteFetchError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SiteFetchError";
  }
}

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
const PRICING_PATHS = ["/pricing", "/plans", "/tarifs", "/prix"] as const;
const LOGIN_PATHS = ["/login", "/signin", "/sign-in", "/connexion"] as const;

// Matches the canonical pricing routes plus the common singular/English variants, so link
// discovery catches /price or /tarif without widening into unrelated pages.
const PRICING_PATH_RE = /^\/(pricing|plans?|tarifs?|prix|price)\/?$/i;

// Routes de connexion, pour relever les moyens d'authentification proposés (voir
// auth-methods.ts). /register et /signup en font partie : beaucoup de SaaS n'exposent les
// boutons « continuer avec … » que sur la page d'inscription.
const LOGIN_PATH_RE =
  /^\/(login|log-in|signin|sign-in|signup|sign-up|register|connexion|se-connecter|inscription|auth)\/?$/i;

// Identifies the request as an honest, user-triggered fetch rather than an anonymous bot —
// consistent with the product's "no autonomous crawling" constraint.
const USER_AGENT =
  "RivalysBot/1.0 (+comparateur SaaS ; requête ponctuelle déclenchée par un utilisateur)";

export interface FetchedSite {
  /** Cleaned, extraction-ready homepage text. */
  homepageText: string;
  /** Cleaned pricing-page text, or null when no pricing page was found. */
  pricingText: string | null;
  /** Raw homepage HTML for the site_snapshots audit column (null on the Firecrawl path if unavailable). */
  homepageHtml: string | null;
  /** Raw pricing-page HTML for the audit column. */
  pricingHtml: string | null;
  /** The URL that produced the pricing content, or null if no pricing route was found. */
  pricingUrl: string | null;
  /** Absolute outbound links found on the homepage — feeds social-presence detection. */
  homepageLinks: string[];
  /** Cleaned login-page text, or null when no login route was found. */
  loginText: string | null;
  /** The URL that produced the login content, or null if no login route was found. */
  loginUrl: string | null;
  /**
   * Links found on the login page. Séparés des liens d'accueil parce qu'un point d'entrée
   * OAuth (accounts.google.com, appleid.apple.com) n'apparaît que là.
   */
  loginLinks: string[];
}

function guardUrl(url: string): void {
  try {
    assertPublicHttpUrl(url);
  } catch (err) {
    throw new SiteFetchError(
      err instanceof UnsafeUrlError ? err.message : `URL non autorisée : ${url}`,
      err,
    );
  }
}

/** Picks the first same-origin link whose path matches `pattern`. */
function findSameOriginLink(
  links: readonly string[],
  origin: string,
  pattern: RegExp,
): string | null {
  for (const link of links) {
    try {
      const parsed = new URL(link);
      if (parsed.origin !== origin) continue;
      if (pattern.test(parsed.pathname)) {
        parsed.hash = "";
        return parsed.toString();
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Fetches `url`, following redirects manually (never `redirect: "follow"`): each hop's
 * target is re-validated with assertPublicHttpUrl before being followed, so a public URL
 * that redirects to a private/internal address (e.g. a metadata-endpoint bounce) is rejected
 * instead of silently visited. Caps at MAX_REDIRECTS hops.
 */
async function fetchWithTimeout(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    guardUrl(currentUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    const isRedirect = res.status >= 300 && res.status < 400;
    const location = res.headers.get("location");
    if (!isRedirect || !location) {
      return res;
    }

    currentUrl = new URL(location, currentUrl).toString();
  }

  throw new SiteFetchError(`Trop de redirections (plus de ${MAX_REDIRECTS}) en suivant ${url}.`);
}

/** Firecrawl path: 1 scrape for the homepage, then at most 1 more for the pricing page. */
async function fetchViaFirecrawl(origin: string): Promise<FetchedSite> {
  // includeNavAndFooter: the pricing link and the social account links we need almost always
  // live in the footer, which Firecrawl's default main-content filter would strip.
  const homepage = await scrapePage(origin, { includeNavAndFooter: true });

  const pricingUrl =
    findSameOriginLink(homepage.links, origin, PRICING_PATH_RE) ??
    // No pricing link advertised on the homepage — try the single most likely canonical
    // route rather than burning a credit on each of the four.
    `${origin}${PRICING_PATHS[0]}`;

  let pricingText: string | null = null;
  let pricingHtml: string | null = null;
  let resolvedPricingUrl: string | null = null;
  try {
    guardUrl(pricingUrl);
    const pricing = await scrapePage(pricingUrl);
    pricingText = pricing.markdown;
    pricingHtml = pricing.rawHtml;
    resolvedPricingUrl = pricingUrl;
  } catch {
    // No pricing page reachable — fall back to homepage-only extraction rather than
    // inventing pricing data (extract.ts is told explicitly when this happens).
  }

  // Page de connexion : contrairement au pricing, on ne tente PAS de route canonique en
  // aveugle. Un crédit Firecrawl brûlé sur un /login inexistant coûte à chaque analyse,
  // alors que l'absence de lien de connexion sur la page d'accueil est déjà une réponse :
  // on n'a rien observé, et readAuthMethods renverra null plutôt qu'un tableau vide.
  const loginUrl = findSameOriginLink(homepage.links, origin, LOGIN_PATH_RE);
  let loginText: string | null = null;
  let resolvedLoginUrl: string | null = null;
  let loginLinks: string[] = [];

  if (loginUrl) {
    try {
      guardUrl(loginUrl);
      const login = await scrapePage(loginUrl);
      loginText = login.markdown;
      loginLinks = login.links;
      resolvedLoginUrl = loginUrl;
    } catch {
      // Page de connexion injoignable — on ne conclut rien sur les moyens de connexion.
    }
  }

  return {
    homepageText: homepage.markdown,
    pricingText,
    homepageHtml: homepage.rawHtml,
    pricingHtml,
    pricingUrl: resolvedPricingUrl,
    homepageLinks: homepage.links,
    loginText,
    loginUrl: resolvedLoginUrl,
    loginLinks,
  };
}

/** Direct-fetch path: original behaviour — homepage, then probe the four canonical routes. */
async function fetchDirectly(origin: string): Promise<FetchedSite> {
  let homepageHtml: string;
  try {
    const res = await fetchWithTimeout(origin);
    if (!res.ok) {
      throw new SiteFetchError(
        `La page d'accueil de ${origin} a répondu avec le statut ${res.status}.`,
      );
    }
    homepageHtml = await res.text();
    if (!homepageHtml.trim()) {
      throw new SiteFetchError(`La page d'accueil de ${origin} est vide.`);
    }
  } catch (err) {
    if (err instanceof SiteFetchError) throw err;
    throw new SiteFetchError(
      `Impossible de récupérer ${origin} (site injoignable, bloqué, ou délai dépassé).`,
      err,
    );
  }

  let pricingHtml: string | null = null;
  let pricingUrl: string | null = null;
  for (const path of PRICING_PATHS) {
    const candidateUrl = origin + path;
    try {
      const res = await fetchWithTimeout(candidateUrl);
      if (!res.ok) continue;
      const text = await res.text();
      if (text.trim()) {
        pricingHtml = text;
        pricingUrl = candidateUrl;
        break;
      }
    } catch {
      // This candidate route failed/timed out — try the next one. If all fail, we fall back
      // to homepage-only extraction rather than inventing pricing data.
      continue;
    }
  }

  const homepageLinks = extractLinks(homepageHtml, origin);

  let loginHtml: string | null = null;
  let loginUrl: string | null = null;
  const advertisedLogin = findSameOriginLink(homepageLinks, origin, LOGIN_PATH_RE);
  const loginCandidates = advertisedLogin
    ? [advertisedLogin, ...LOGIN_PATHS.map((path) => origin + path)]
    : LOGIN_PATHS.map((path) => origin + path);

  for (const candidateUrl of loginCandidates) {
    try {
      const res = await fetchWithTimeout(candidateUrl);
      if (!res.ok) continue;
      const text = await res.text();
      if (text.trim()) {
        loginHtml = text;
        loginUrl = candidateUrl;
        break;
      }
    } catch {
      continue;
    }
  }

  return {
    homepageText: stripHtml(homepageHtml),
    pricingText: pricingHtml ? stripHtml(pricingHtml) : null,
    homepageHtml,
    pricingHtml,
    pricingUrl,
    homepageLinks,
    loginText: loginHtml ? stripHtml(loginHtml) : null,
    loginUrl,
    loginLinks: loginHtml ? extractLinks(loginHtml, origin) : [],
  };
}

/**
 * Fetches a site's homepage and pricing page. Never fabricates data: if the homepage is
 * unreachable on every available path, throws SiteFetchError for the caller to surface
 * honestly. If no pricing route is found, returns pricingText: null rather than guessing.
 */
export async function fetchSite(rawUrl: string): Promise<FetchedSite> {
  let origin: string;
  try {
    origin = new URL(rawUrl).origin;
  } catch {
    throw new SiteFetchError(`URL invalide : ${rawUrl}`);
  }

  // Explicit guard on the initial origin, ahead of any fetch — fetchWithTimeout re-checks
  // every hop on its own, and the Firecrawl path has no hops of ours to check, so this is
  // the one place both paths are covered.
  guardUrl(origin);

  if (isFirecrawlConfigured()) {
    try {
      return await fetchViaFirecrawl(origin);
    } catch (err) {
      // Firecrawl down, out of credits, or blocked on this site — degrade to the direct
      // fetch rather than failing the comparison outright.
      console.warn(
        `fetchSite: Firecrawl a échoué pour ${origin}, bascule sur le fetch direct.`,
        err instanceof FirecrawlError ? err.message : err,
      );
    }
  }

  return fetchDirectly(origin);
}
