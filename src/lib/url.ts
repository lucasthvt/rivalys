/**
 * URL helpers shared by the onboarding wizard (client), the onboarding server
 * action and the competitor server action.
 *
 * They live here rather than in each caller so the client-side "can I enable
 * the button" check and the server-side validation can never drift apart —
 * a field the browser accepted must never be rejected by the action for a
 * different reason than the one shown to the user.
 */

/** Prefixes a bare domain with https:// so `new URL()` (and Postgres) accept it. */
export function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Loose plausibility check: parses as a URL and carries a dotted hostname.
 *
 * Deliberately not a strict validator — the only way to know a site actually
 * exists is to fetch it, which the comparator does later and reports honestly
 * when it fails.
 */
export function isLikelyUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(normalizeUrl(trimmed));
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

/**
 * Lowercased hostname with a leading `www.` dropped, or null when `rawUrl`
 * cannot be parsed. Used to tell two sites apart: `acme.com` and
 * `https://www.acme.com/pricing` are the same host.
 */
export function canonicalHostname(rawUrl: string): string | null {
  try {
    const host = new URL(normalizeUrl(rawUrl)).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

/**
 * Canonical form used to decide whether two stored URLs point at the same
 * page: the scheme is ignored, `www.` and any trailing slash are dropped, and
 * the fragment is discarded. `acme.com`, `https://www.acme.com/` and
 * `acme.com/#top` all canonicalize to `acme.com`.
 *
 * Falls back to the trimmed lowercase input when the URL cannot be parsed, so
 * callers never have to handle a null: two unparseable strings then compare
 * equal only when they are literally the same string.
 */
export function canonicalUrl(rawUrl: string): string {
  try {
    const url = new URL(normalizeUrl(rawUrl));
    const host = canonicalHostname(rawUrl);
    if (host === null) return rawUrl.trim().toLowerCase();
    return `${host}${url.pathname.replace(/\/+$/, "")}${url.search}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}
