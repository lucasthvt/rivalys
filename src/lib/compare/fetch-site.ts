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
import { canonicalHostname } from "@/lib/url";
import { capText, extractLinks, stripHtml } from "./html";
import { FirecrawlError, isFirecrawlConfigured, scrapePage } from "./firecrawl";
import { PURCHASE_LABEL_RE } from "./payment-methods";
import { UNBOUNDED, type Deadline } from "./deadline";

export class SiteFetchError extends Error {
  /**
   * `cause` est déclaré et assigné ici plutôt que par une « parameter property » : c'est la
   * seule construction purement TypeScript que le mode strip-only de Node refuse, et ce
   * module doit rester importable par `node --test` et par les scripts de mesure du
   * pipeline. Même contournement que PerplexityError. Comportement inchangé.
   */
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "SiteFetchError";
    this.cause = cause;
  }
}

const FETCH_TIMEOUT_MS = 10_000;
// Page de connexion uniquement : c'est un bonus, son absence est un résultat acceptable
// et on n'attend pas 10 s par route sondée pour l'apprendre. Les tarifs, eux, gardent le
// délai complet — leur absence fausserait tout le comparatif.
const LOGIN_FETCH_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 5;
const PRICING_PATHS = ["/pricing", "/plans", "/tarifs", "/prix"] as const;
const LOGIN_PATHS = ["/login", "/signin", "/sign-in", "/connexion"] as const;

/**
 * Part du budget d'analyse (voir deadline.ts) allouée à chaque page.
 *
 * La page d'accueil et celle des tarifs sont OBLIGATOIRES — tout le comparatif en dépend —
 * et gardent le délai le plus long. La page de connexion est un bonus : elle n'alimente que
 * le relevé des moyens d'authentification, et son absence est déjà un résultat acceptable
 * (readAuthMethods renvoie null, aucune comparaison n'est bâtie dessus). Elle est donc la
 * première à être sautée quand le budget se resserre.
 */
const HOMEPAGE_SCRAPE_MS = 12_000;
const PRICING_SCRAPE_MS = 10_000;
const LOGIN_SCRAPE_MS = 6_000;
/** Le clic dans le navigateur attend 9 s à lui seul — il lui faut plus que les autres. */
const CLICK_THROUGH_MS = 20_000;

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
  /**
   * Liens de la page de tarifs. C'est là que mène un bouton d'abonnement quand il s'agit
   * d'un vrai lien — un lien de paiement Whop ou Stripe y est directement visible.
   */
  pricingLinks: string[];
}

/** Hôtes considérés comme « le site » : celui demandé, et celui réellement servi. */
function acceptedHosts(origin: string, finalUrl: string | null): string[] {
  const hosts = [canonicalHostname(origin), finalUrl ? canonicalHostname(finalUrl) : null];
  return [...new Set(hosts.filter((h): h is string => h !== null))];
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

/**
 * Premier lien du même site dont le chemin correspond à `pattern`.
 *
 * `hosts` contient l'hôte demandé ET celui réellement servi : `notion.so` redirige vers
 * `notion.com`, et une comparaison au seul domaine saisi ne reconnaissait plus aucun lien
 * de la page comme interne — on concluait « pas de page de connexion » sur un site qui
 * l'affiche en haut de sa page d'accueil. La comparaison porte sur le nom d'hôte
 * canonique, `www` retiré.
 */
function findSameOriginLink(
  links: readonly string[],
  hosts: readonly string[],
  pattern: RegExp,
): string | null {
  // Sans hôte de référence lisible, on ne compare à rien : deux `null` seraient
  // considérés égaux et n'importe quel lien externe passerait pour interne.
  if (hosts.length === 0) return null;

  for (const link of links) {
    try {
      const parsed = new URL(link);
      const linkHost = canonicalHostname(parsed.href);
      if (linkHost === null || !hosts.includes(linkHost)) continue;
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

/** Une page récupérée : statut, adresse finale et corps, le corps déjà lu sous le délai. */
interface FetchedPage {
  ok: boolean;
  status: number;
  /** Adresse réellement servie, après redirections. */
  url: string;
  body: string;
}

/**
 * Fetches `url`, following redirects manually (never `redirect: "follow"`): each hop's
 * target is re-validated with assertPublicHttpUrl before being followed, so a public URL
 * that redirects to a private/internal address (e.g. a metadata-endpoint bounce) is rejected
 * instead of silently visited. Caps at MAX_REDIRECTS hops.
 *
 * Rend le CORPS, pas la `Response` : le délai doit couvrir la lecture du corps, pas
 * seulement l'arrivée des en-têtes. En rendant la Response, le chronomètre était arrêté dès
 * les en-têtes reçus et un serveur qui envoyait son corps au goutte-à-goutte n'était plus
 * borné par rien — le budget de l'analyse ne tenait plus. Lire ici, sous le même signal,
 * ferme ce trou.
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<FetchedPage> {
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    guardUrl(currentUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
      });

      const isRedirect = res.status >= 300 && res.status < 400;
      const location = res.headers.get("location");
      if (!isRedirect || !location) {
        // Un corps non lu laisse la connexion ouverte ; on le consomme dans tous les cas,
        // y compris sur une réponse d'erreur dont l'appelant ne fera rien.
        const body = await res.text();
        return { ok: res.ok, status: res.status, url: res.url || currentUrl, body };
      }

      currentUrl = new URL(location, currentUrl).toString();
    } finally {
      clearTimeout(timer);
    }
  }

  throw new SiteFetchError(`Trop de redirections (plus de ${MAX_REDIRECTS}) en suivant ${url}.`);
}

/** Firecrawl path: 1 scrape for the homepage, then at most 1 more for the pricing page. */
async function fetchViaFirecrawl(origin: string, deadline: Deadline): Promise<FetchedSite> {
  // includeNavAndFooter: the pricing link and the social account links we need almost always
  // live in the footer, which Firecrawl's default main-content filter would strip.
  const homepage = await scrapePage(origin, {
    includeNavAndFooter: true,
    timeoutMs: deadline.capTimeout(HOMEPAGE_SCRAPE_MS),
  });

  // Adresse réellement servie : c'est elle qui dit à quoi ressemblent les liens internes
  // de la page, pas celle saisie par l'utilisateur.
  const hosts = acceptedHosts(origin, homepage.finalUrl);

  const pricingUrl =
    findSameOriginLink(homepage.links, hosts, PRICING_PATH_RE) ??
    // No pricing link advertised on the homepage — try the single most likely canonical
    // route rather than burning a credit on each of the four.
    `${origin}${PRICING_PATHS[0]}`;

  // Page de connexion : contrairement au pricing, on ne tente PAS de route canonique en
  // aveugle. Un crédit Firecrawl brûlé sur un /login inexistant coûte à chaque analyse,
  // alors que l'absence de lien de connexion sur la page d'accueil est déjà une réponse :
  // on n'a rien observé, et readAuthMethods renverra null plutôt qu'un tableau vide.
  const loginUrl = findSameOriginLink(homepage.links, hosts, LOGIN_PATH_RE);

  // Les deux pages secondaires sont récupérées EN PARALLÈLE. Enchaînées, elles ajoutaient
  // deux délais de 30 s l'un après l'autre au pire cas, sur chacun des deux sites — de
  // quoi faire durer une analyse plusieurs minutes pour rien : ni l'une ni l'autre ne
  // dépend du résultat de sa voisine.
  const [pricingResult, loginResult] = await Promise.allSettled([
    (async () => {
      guardUrl(pricingUrl);
      return {
        url: pricingUrl,
        page: await scrapePage(pricingUrl, {
          timeoutMs: deadline.capTimeout(PRICING_SCRAPE_MS),
        }),
      };
    })(),
    (async () => {
      if (!loginUrl) return null;
      // Bonus sauté quand le budget ne le couvre plus : mieux vaut ne pas avoir observé les
      // moyens de connexion que faire attendre l'utilisateur pour eux.
      if (!deadline.hasRoomFor(LOGIN_SCRAPE_MS)) return null;
      guardUrl(loginUrl);
      return {
        url: loginUrl,
        page: await scrapePage(loginUrl, { timeoutMs: deadline.capTimeout(LOGIN_SCRAPE_MS) }),
      };
    })(),
  ]);

  // Page injoignable des deux côtés : on repart sur ce qu'on a, sans rien inventer
  // (extract.ts est prévenu explicitement quand le pricing manque).
  const pricing = pricingResult.status === "fulfilled" ? pricingResult.value : null;
  const login = loginResult.status === "fulfilled" ? loginResult.value : null;

  // capText ici et pas plus loin : ces trois textes partent tels quels dans le prompt
  // d'extraction, et le markdown de Firecrawl ne passe pas par stripHtml.
  const pricingText = pricing?.page.markdown ? capText(pricing.page.markdown) : null;
  const pricingHtml = pricing?.page.rawHtml ?? null;
  const resolvedPricingUrl = pricing?.url ?? null;

  const pricingLinks = pricing?.page.links ?? [];
  const loginText = login?.page.markdown ? capText(login.page.markdown) : null;
  const resolvedLoginUrl = login?.url ?? null;
  const loginLinks = login?.page.links ?? [];

  return {
    homepageText: capText(homepage.markdown),
    pricingText,
    homepageHtml: homepage.rawHtml,
    pricingHtml,
    pricingUrl: resolvedPricingUrl,
    homepageLinks: homepage.links,
    loginText,
    loginUrl: resolvedLoginUrl,
    loginLinks,
    pricingLinks,
  };
}

/** Direct-fetch path: original behaviour — homepage, then probe the four canonical routes. */
async function fetchDirectly(origin: string, deadline: Deadline): Promise<FetchedSite> {
  let homepageHtml: string;
  let homepageFinalUrl: string | null = null;
  try {
    const res = await fetchWithTimeout(origin, deadline.capTimeout(FETCH_TIMEOUT_MS));
    // `res.url` porte la dernière adresse suivie : même raison que sur le chemin
    // Firecrawl, les liens de la page ressemblent à celle-là, pas à l'origine demandée.
    homepageFinalUrl = res.url || null;
    if (!res.ok) {
      throw new SiteFetchError(
        `La page d'accueil de ${origin} a répondu avec le statut ${res.status}.`,
      );
    }
    homepageHtml = res.body;
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
    /*
      Les tarifs sont OBLIGATOIRES : la sonde se raccourcit avec le budget, elle ne se saute
      jamais.

      Une version précédente s'arrêtait net quand il restait moins de 10 s. C'était un
      mensonge coûteux : une sonde non effectuée donne `pricing_page_found: false`, et le
      tableau de bord l'affiche à l'utilisateur comme « aucune page de tarifs n'a été
      trouvée sur ton site » — sur SON site, qu'il connaît. Le relevé perdait aussi le
      balisage des tarifs, de quoi déclencher une règle de paiement contre un côté jamais
      lu.

      capTimeout fait le travail sans mentir : chaque sonde reçoit ce qui reste, et le
      plancher garantit qu'elle part. Les quatre routes ensemble ne peuvent donc plus
      dépasser le budget, là où elles valaient 40 s à elles seules.
    */
    try {
      // Délai complet, volontairement : une page de tarifs pèse souvent plusieurs
      // centaines de kilo-octets (515 Ko chez Notion), et l'écourter revient à conclure
      // « aucun tarif public » sur une page qui n'a simplement pas fini d'arriver — la
      // pire erreur possible ici, puisque tout le comparatif en dépend.
      const res = await fetchWithTimeout(candidateUrl, deadline.capTimeout(FETCH_TIMEOUT_MS));
      if (!res.ok) continue;
      if (res.body.trim()) {
        pricingHtml = res.body;
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

  // Au plus DEUX candidats, et un délai court.
  //
  // La version précédente sondait le lien annoncé puis les quatre routes canoniques, à
  // 10 s chacune : jusqu'à 50 s par site passées à attendre des 404, sur une page qui
  // n'est qu'un bonus. Un site qui n'annonce pas sa page de connexion et n'expose pas
  // /login est simplement un site dont on n'a pas observé les moyens de connexion —
  // readAuthMethods renvoie null et aucune comparaison n'est bâtie dessus.
  const advertisedLogin = findSameOriginLink(
    homepageLinks,
    acceptedHosts(origin, homepageFinalUrl),
    LOGIN_PATH_RE,
  );
  const loginCandidates = advertisedLogin
    ? [advertisedLogin, origin + LOGIN_PATHS[0]]
    : [origin + LOGIN_PATHS[0]];

  for (const candidateUrl of loginCandidates) {
    // Bonus, sauté le premier : voir LOGIN_SCRAPE_MS.
    if (!deadline.hasRoomFor(LOGIN_FETCH_TIMEOUT_MS)) break;
    try {
      const res = await fetchWithTimeout(
        candidateUrl,
        deadline.capTimeout(LOGIN_FETCH_TIMEOUT_MS),
      );
      if (!res.ok) continue;
      if (res.body.trim()) {
        loginHtml = res.body;
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
    pricingLinks: pricingHtml ? extractLinks(pricingHtml, origin) : [],
  };
}

/**
 * Crawl borné via la fonction Python (api/crawl.py), activé seulement si RIVALYS_CRAWLER_URL
 * et CRAWLER_SECRET sont définis. Renvoie null quand le crawl ne donne pas de page de tarifs :
 * le chemin existant prend alors le relais. Lève SiteFetchError quand le site refuse la lecture,
 * et dans ce cas on n'essaie aucun autre chemin : un repli vers Firecrawl ou le fetch direct
 * reviendrait à frapper le même site une seconde fois.
 */
const CRAWL_TIMEOUT_MS = 15_000;
/** Le site a refusé la lecture (401/403/429/503 ou captcha) : aucun repli. */
export class SiteRefusedError extends SiteFetchError {}
const CRAWL_MAX_PAGES = 8;

interface CrawledPage {
  url: string;
  status: number;
  html: string;
}

async function fetchViaCrawler(origin: string, deadline: Deadline): Promise<FetchedSite | null> {
  const endpoint = process.env.RIVALYS_CRAWLER_URL;
  const secret = process.env.CRAWLER_SECRET;
  if (!endpoint || !secret) return null;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-crawler-secret": secret },
    body: JSON.stringify({ url: origin, maxPages: CRAWL_MAX_PAGES }),
    signal: AbortSignal.timeout(deadline.capTimeout(CRAWL_TIMEOUT_MS)),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    pages?: CrawledPage[];
    haltedReason?: string | null;
  };
  const pages = data.pages ?? [];

  const pathOf = (url: string) => {
    try {
      return new URL(url).pathname;
    } catch {
      return "";
    }
  };
  const homepage = pages.find((page) => pathOf(page.url) === "/") ?? pages[0];
  const pricing = pages.find((page) => PRICING_PATH_RE.test(pathOf(page.url)));
  const login = pages.find((page) => LOGIN_PATH_RE.test(pathOf(page.url)));

  if (!pricing) {
    if (data.haltedReason?.startsWith("refus du site")) {
      throw new SiteRefusedError(`Le site ${origin} refuse la lecture automatique (${data.haltedReason}).`);
    }
    return null;
  }
  if (!homepage) return null;

  return {
    homepageText: stripHtml(homepage.html),
    pricingText: stripHtml(pricing.html),
    homepageHtml: homepage.html,
    pricingHtml: pricing.html,
    pricingUrl: pricing.url,
    homepageLinks: extractLinks(homepage.html, origin),
    loginText: login ? stripHtml(login.html) : null,
    loginUrl: login?.url ?? null,
    loginLinks: login ? extractLinks(login.html, origin) : [],
    pricingLinks: extractLinks(pricing.html, origin),
  };
}

/**
 * Fetches a site's homepage and pricing page. Never fabricates data: if the homepage is
 * unreachable on every available path, throws SiteFetchError for the caller to surface
 * honestly. If no pricing route is found, returns pricingText: null rather than guessing.
 */
export async function fetchSite(
  rawUrl: string,
  deadline: Deadline = UNBOUNDED,
): Promise<FetchedSite> {
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

  try {
    const crawled = await fetchViaCrawler(origin, deadline);
    if (crawled) return crawled;
  } catch (err) {
    if (err instanceof SiteRefusedError) {
      throw err;
    }
    console.warn(`fetchSite: crawl Python indisponible pour ${origin}, repli.`, err);
  }

  if (isFirecrawlConfigured()) {
    try {
      return await fetchViaFirecrawl(origin, deadline);
    } catch (err) {
      // Firecrawl down, out of credits, or blocked on this site — degrade to the direct
      // fetch rather than failing the comparison outright.
      console.warn(
        `fetchSite: Firecrawl a échoué pour ${origin}, bascule sur le fetch direct.`,
        err instanceof FirecrawlError ? err.message : err,
      );
    }
  }

  return fetchDirectly(origin, deadline);
}

/**
 * Première redirection renvoyée par une URL, sans la suivre.
 *
 * Sert au relevé du prestataire de paiement : un bouton d'abonnement qui pointe vers
 * `/checkout` répond souvent par un 302 vers Stripe ou Whop, et cette réponse est
 * publique. On lit l'en-tête `Location` et on s'arrête là — on ne déroule pas le tunnel.
 */
export async function peekRedirect(
  url: string,
  deadline: Deadline = UNBOUNDED,
): Promise<{ location: string | null }> {
  guardUrl(url);

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    deadline.capTimeout(LOGIN_FETCH_TIMEOUT_MS),
  );
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    });
    const location = res.headers.get("location");
    return { location: location ? new URL(location, url).toString() : null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Clique le bouton d'abonnement de la page de tarifs et renvoie l'URL d'atterrissage.
 *
 * Sur une application monopage, ce bouton n'est pas un lien : sa destination n'existe
 * qu'une fois le gestionnaire JavaScript exécuté. Firecrawl pilote un navigateur, donc le
 * clic est possible — c'est le seul moyen de voir un tunnel de paiement qui ne laisse
 * aucune trace dans le balisage.
 *
 * Coûte un scrape supplémentaire : réservé au dernier recours, quand aucun prestataire
 * n'est visible autrement. Renvoie null si Firecrawl n'est pas configuré ou si le clic
 * échoue — on ne conclut alors rien.
 */
export async function clickThroughToPayment(
  pricingUrl: string,
  deadline: Deadline = UNBOUNDED,
): Promise<string | null> {
  // Désactivé par défaut. Ce niveau coûte un scrape par site, et l'observation dit qu'il
  // ne rend rien dans le cas le plus fréquent : un produit qui exige un compte avant de
  // payer renvoie sa page d'inscription. À activer quand la dépense se justifie, avec
  // RIVALYS_CLICK_THROUGH=1.
  if (process.env.RIVALYS_CLICK_THROUGH !== "1") return null;
  if (!isFirecrawlConfigured()) return null;
  // Un scrape plus une attente de 9 s dans le navigateur : le niveau le plus cher du relevé
  // de paiement, et le plus facile à sacrifier. Le repli est un prestataire non identifié.
  if (!deadline.hasRoomFor(CLICK_THROUGH_MS)) return null;

  const script = `
    const motif = ${PURCHASE_LABEL_RE.toString()};
    const cible = [...document.querySelectorAll('button, a, [role=button]')]
      .find((el) => motif.test(el.textContent || ''));
    if (cible) cible.click();
  `;

  try {
    guardUrl(pricingUrl);
    const page = await scrapePage(pricingUrl, {
      actions: [
        { type: "executeJavascript", script },
        // Laisse le temps à la navigation de se produire — une redirection vers un
        // prestataire passe par le réseau.
        { type: "wait", milliseconds: 9000 },
      ],
      timeoutMs: deadline.capTimeout(CLICK_THROUGH_MS),
    });
    return page.finalUrl;
  } catch {
    return null;
  }
}
