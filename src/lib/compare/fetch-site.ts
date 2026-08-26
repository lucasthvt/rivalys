// On-demand fetch of a single site's homepage + pricing page, triggered explicitly by a
// user action (never an autonomous crawl — see CLAUDE.md "Contraintes de fond").

import { assertPublicHttpUrl, UnsafeUrlError } from "./url-safety";

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

// Identifies the request as an honest, user-triggered fetch rather than an anonymous bot —
// consistent with the product's "no autonomous crawling" constraint.
const USER_AGENT =
  "RivalysBot/1.0 (+comparateur SaaS ; requête ponctuelle déclenchée par un utilisateur)";

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

export interface FetchedSite {
  homepageHtml: string;
  /** Raw HTML of the first pricing-like route that responded 200 with non-empty content, or null. */
  pricingHtml: string | null;
  /** The URL that produced pricingHtml, or null if no pricing route was found. */
  pricingUrl: string | null;
}

/**
 * Fetches a site's homepage, then probes /pricing, /plans, /tarifs, /prix in order for the
 * first valid (200, non-empty) response. Never fabricates data: if the homepage itself is
 * unreachable, throws SiteFetchError for the caller to handle without crashing the whole
 * comparison pipeline. If no pricing route is found, returns pricingHtml: null rather than
 * guessing.
 */
export async function fetchSite(rawUrl: string): Promise<FetchedSite> {
  let origin: string;
  try {
    origin = new URL(rawUrl).origin;
  } catch {
    throw new SiteFetchError(`URL invalide : ${rawUrl}`);
  }

  // Explicit guard on the initial origin, ahead of any fetch — fetchWithTimeout re-checks
  // every hop (including this one) on its own, but failing fast here keeps the intent
  // visible at the call site and avoids ever constructing a request to a blocked host.
  guardUrl(origin);

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

  return { homepageHtml, pricingHtml, pricingUrl };
}
