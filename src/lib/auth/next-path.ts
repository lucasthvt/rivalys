// Garde du paramètre `next` après connexion (anti open-redirect).
//
// Un préfixe « / » ne suffit pas : le parseur d'URL traite « \ » comme « / » pour http(s),
// donc « /\evil.example » devient « //evil.example » et renvoie vers un autre site. On refuse
// donc tout antislash et tout caractère de contrôle, puis on vérifie que la cible résolue
// reste sur la même origine.

const PLACEHOLDER_ORIGIN = "https://app.invalid";
const FORBIDDEN_RE = /[\\\u0000-\u001f\u007f]/;

export function sanitizeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  if (FORBIDDEN_RE.test(raw)) return null;

  let resolved: URL;
  try {
    resolved = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (resolved.origin !== PLACEHOLDER_ORIGIN) return null;
  return raw;
}
