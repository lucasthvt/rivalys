// Best-effort SSRF guard for user-supplied SaaS/competitor URLs.
//
// Why this exists: a signed-in user fully controls `saas_url` and `competitor_url` (typed in
// at onboarding). fetchSite() fetches those URLs server-side, and the (cleaned) result is
// persisted to site_snapshots — readable back by that same user via RLS. Without a guard, a
// user could point either URL at an internal service or the cloud metadata endpoint
// (169.254.169.254) and have its response fetched, summarized by Claude, and stored for them
// to read — a real exfiltration path even though it's scoped to the requesting user.
//
// What this is NOT: a full anti-DNS-rebinding defense. This only rejects literal IP
// addresses/hostnames known to be private, loopback, or reserved at the moment we look at the
// URL string. A public hostname that resolves to a private IP (at fetch time, or after this
// check but before the TCP connection — classic DNS rebinding) would not be caught here;
// doing that properly requires pinning the connection to the specific IP we validated (a
// custom DNS resolver + fetch agent). That's out of scope for this MVP — this guard is a
// floor against the obvious literal cases, not a hard security boundary.

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isPrivateOrReservedIPv4(host: string): boolean {
  const match = IPV4_RE.exec(host);
  if (!match) return false;
  const parts = match.slice(1, 5).map(Number);
  if (parts.some((p) => p > 255)) return false;
  const [a, b] = parts;

  if (a === 127) return true; // 127.0.0.0/8 — loopback
  if (a === 10) return true; // 10.0.0.0/8 — private
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 — private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 — private
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 — link-local, includes the
  // cloud metadata endpoint 169.254.169.254
  return false;
}

function stripIPv6Brackets(hostname: string): string {
  // URL#hostname keeps the brackets for IPv6 literals (e.g. "[::1]"), unlike IPv4/hostnames.
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

function isLocalhostHostname(host: string): boolean {
  return host === "localhost" || host.endsWith(".localhost");
}

/**
 * Complète une adresse saisie à la main.
 *
 * Personne ne tape « https:// » : on écrit « brevo.com ». Refuser cette forme reviendrait à
 * faire échouer le premier geste du visiteur sur une question de syntaxe, alors que
 * l'intention est parfaitement claire. On préfixe donc en https quand aucun schéma n'est
 * présent.
 *
 * À n'appliquer qu'aux saisies humaines. Les URL rencontrées en cours de route — une
 * redirection, un lien extrait d'une page — passent directement par assertPublicHttpUrl :
 * là, un schéma absent ou exotique est un signal, pas une maladresse de frappe, et le
 * compléter d'office masquerait ce que le contrôle doit justement voir.
 */
export function coerceUserUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return trimmed;
  // Un schéma déjà écrit est laissé tel quel, y compris s'il n'est pas http(s) :
  // assertPublicHttpUrl doit pouvoir le rejeter en le nommant.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Throws UnsafeUrlError unless `url` is a plain, public http(s) URL. Intended to be called on
 * every URL the comparator is about to fetch — the initial origin, and again on every
 * redirect Location before it's followed (see fetch-site.ts).
 */
export function assertPublicHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsafeUrlError(`URL invalide : ${url}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeUrlError(`Protocole non autorisé (http/https uniquement) : ${parsed.protocol}`);
  }

  const hostname = stripIPv6Brackets(parsed.hostname.toLowerCase());

  if (isLocalhostHostname(hostname)) {
    throw new UnsafeUrlError(`Hôte non autorisé : ${hostname}`);
  }
  if (hostname === "0.0.0.0") {
    throw new UnsafeUrlError(`Hôte non autorisé : ${hostname}`);
  }
  // Littéraux IPv6 : refusés en bloc. Les formes mappées IPv4 (::ffff:a9fe:a9fe), les plages
  // privées (fc00::/7, fe80::/10) et les formes compatibles se contournent une à une ; aucun
  // site public légitime d'un concurrent n'est désigné par une adresse IPv6 littérale.
  if (hostname.includes(":")) {
    throw new UnsafeUrlError(`Hôte non autorisé (adresse IPv6 littérale) : ${hostname}`);
  }
  if (isPrivateOrReservedIPv4(hostname)) {
    throw new UnsafeUrlError(`Hôte non autorisé (plage IP privée/réservée) : ${hostname}`);
  }
}
