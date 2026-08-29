// Single-page scraping through Firecrawl's /v2/scrape endpoint.
//
// Deliberately ONLY the single-page `scrape` operation — never Firecrawl's `crawl` or `map`
// operations, which walk a site autonomously. Per CLAUDE.md ("Pas de scraping massif ou
// automatisé à l'échelle"), Rivalys only ever fetches URLs the user explicitly gave us, one
// page at a time, in response to an explicit user action.
//
// Firecrawl is optional: when FIRECRAWL_API_KEY is unset, isFirecrawlConfigured() returns
// false and fetch-site.ts falls back to fetching the page directly. That keeps local dev and
// a Firecrawl outage working rather than hard-failing the comparator.

export class FirecrawlError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "FirecrawlError";
  }
}

const SCRAPE_ENDPOINT = "https://api.firecrawl.dev/v2/scrape";
const SCRAPE_TIMEOUT_MS = 30_000;

export interface ScrapedPage {
  /** Cleaned page content, ready to feed to the extractor. */
  markdown: string;
  /** Full page HTML, kept for the site_snapshots audit columns. */
  rawHtml: string | null;
  /** Absolute outbound links found on the page (used for pricing + social discovery). */
  links: string[];
  /**
   * URL réellement servie, après redirections. `notion.so` renvoie vers `notion.com` :
   * sans cette valeur, les liens de la page ne ressemblent plus au domaine demandé et
   * aucun n'est reconnu comme interne.
   */
  finalUrl: string | null;
}

export function isFirecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY?.trim());
}

interface FirecrawlScrapeResponse {
  success?: boolean;
  error?: string;
  data?: {
    markdown?: string;
    rawHtml?: string;
    links?: string[];
    metadata?: {
      url?: string;
      sourceURL?: string;
    };
  };
}

/**
 * Scrapes exactly one page. `includeNavAndFooter` keeps headers/navs/footers in the result —
 * needed on a homepage, where the pricing link and the social account links almost always
 * live in the footer. Pricing pages pass false for a cleaner extraction input.
 *
 * Never fabricates content: any transport, auth, quota, or empty-body failure throws
 * FirecrawlError so the caller can fall back or surface the failure honestly.
 */
/**
 * Actions exécutées dans le navigateur avant la capture. Sert à cliquer un bouton
 * d'abonnement qui n'est pas un lien : sur une application monopage, la destination du
 * paiement n'existe qu'après ce clic.
 */
export type ScrapeAction =
  | { type: "executeJavascript"; script: string }
  | { type: "wait"; milliseconds: number };

export async function scrapePage(
  url: string,
  {
    includeNavAndFooter = false,
    actions,
  }: { includeNavAndFooter?: boolean; actions?: ScrapeAction[] } = {},
): Promise<ScrapedPage> {
  const apiKey = process.env.FIRECRAWL_API_KEY?.trim();
  if (!apiKey) {
    throw new FirecrawlError("FIRECRAWL_API_KEY n'est pas configurée.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(SCRAPE_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown", "links", "rawHtml"],
        onlyMainContent: !includeNavAndFooter,
        ...(actions && actions.length > 0 ? { actions } : {}),
      }),
    });
  } catch (err) {
    throw new FirecrawlError(`Firecrawl injoignable pour ${url} (réseau ou délai dépassé).`, err);
  } finally {
    clearTimeout(timer);
  }

  let payload: FirecrawlScrapeResponse;
  try {
    payload = (await res.json()) as FirecrawlScrapeResponse;
  } catch (err) {
    throw new FirecrawlError(`Réponse Firecrawl illisible pour ${url}.`, err);
  }

  if (!res.ok || payload.success === false) {
    const detail = payload.error ? ` (${payload.error})` : "";
    throw new FirecrawlError(`Firecrawl a répondu ${res.status} pour ${url}${detail}.`);
  }

  const markdown = payload.data?.markdown?.trim() ?? "";
  if (!markdown) {
    throw new FirecrawlError(`Firecrawl n'a retourné aucun contenu pour ${url}.`);
  }

  return {
    markdown,
    rawHtml: payload.data?.rawHtml ?? null,
    links: Array.isArray(payload.data?.links)
      ? payload.data.links.filter((l): l is string => typeof l === "string")
      : [],
    // `url` est l'adresse finale, `sourceURL` celle demandée : la première est la bonne
    // quand elles diffèrent, la seconde sert de repli.
    finalUrl: payload.data?.metadata?.url ?? payload.data?.metadata?.sourceURL ?? null,
  };
}
