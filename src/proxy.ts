import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { buildCsp } from "@/lib/security/csp";

const PROTECTED_PREFIXES = [
  "/onboarding",
  "/dashboard",
  "/tasks",
  "/concurrent",
  "/score",
  "/statistiques",
  "/compte",
];

/**
 * Jamais indexé, jamais mis en cache partagé.
 *
 * Surensemble des chemins protégés : il ajoute les écrans d'opérateur, qui ne peuvent PAS
 * rejoindre la liste ci-dessus. Celle-ci redirige vers /login, et une redirection confirme
 * qu'un chemin existe — or ces écrans répondent 404 précisément pour rester indiscernables
 * du néant. Ils ont malgré tout besoin du `no-store` : /admin/avis affiche les retours de
 * tout le monde, lus avec la clé de service.
 *
 * Volontairement absents de robots.txt : ce fichier est public, y écrire « /admin » revient
 * à publier la liste de ce qu'on cherche à cacher. L'en-tête ci-dessous est de toute façon
 * ce qui empêche réellement l'indexation.
 */
const NO_INDEX_PREFIXES = [...PROTECTED_PREFIXES, "/admin", "/teardown"];

function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isProtectedPath(pathname: string) {
  return matchesPrefix(pathname, PROTECTED_PREFIXES);
}

function isNoIndexPath(pathname: string) {
  return matchesPrefix(pathname, NO_INDEX_PREFIXES);
}

export async function proxy(request: NextRequest) {
  // Un nonce neuf par requête. `crypto` est l'API Web disponible dans le runtime des
  // proxies Next — pas besoin d'importer node:crypto.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({ nonce, dev: process.env.NODE_ENV === "development" });

  /**
   * Next lit le nonce dans l'en-tête `content-security-policy` de la REQUÊTE pour
   * l'appliquer à ses propres balises `<script>`. Il faut donc le poser sur les en-têtes
   * transmis en aval, pas seulement sur la réponse.
   *
   * Reconstruit à chaque appel plutôt que capturé une fois : Supabase peut rafraîchir les
   * cookies d'authentification en cours de route (`request.cookies.set`), et les en-têtes
   * doivent refléter cet état-là.
   */
  function forwardedHeaders(): Headers {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", csp);
    return headers;
  }

  // Response we'll eventually return. Supabase may need to overwrite this
  // (via setAll below) if it refreshes the auth token, so keep it mutable.
  let response = NextResponse.next({ request: { headers: forwardedHeaders() } });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mirror the refreshed cookies onto both the incoming request
          // (so any downstream server code sees them) and a fresh response
          // (so the browser receives them).
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: forwardedHeaders() } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // IMPORTANT: don't add logic between createServerClient and getUser().
  // A stray early return here can randomly drop sessions.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtectedPath(request.nextUrl.pathname) && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    redirectResponse.headers.set("Content-Security-Policy", csp);
    return redirectResponse;
  }

  response.headers.set("Content-Security-Policy", csp);

  // Les écrans authentifiés ne doivent jamais finir dans un index public : ils ne portent
  // que des données appartenant à une personne, et un cache partagé mal réglé suffit à
  // les faire fuir.
  if (isNoIndexPath(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except static assets and image optimization files,
    // so the auth cookie stays fresh on every navigable route.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
