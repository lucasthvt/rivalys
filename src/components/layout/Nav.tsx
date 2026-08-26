"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/Button";

/**
 * Common top navigation, mounted once in the root layout so it appears on
 * every route without other agents needing to import it.
 *
 * Deliberately auth-agnostic for now: it always shows both the signed-out
 * links (Connexion/Commencer) and the app links (Tableau de bord/Tâches),
 * rather than reading the Supabase session, so it has zero runtime
 * dependency on the auth work landing in parallel. A later integration
 * pass can swap in real session-aware state (hide Connexion/Commencer,
 * add a working Déconnexion action) once Agent A's auth helpers are in.
 *
 * Hidden on /login, /signup, and /onboarding: those routes were built (in
 * parallel, by the auth/onboarding agent) as immersive full-bleed screens —
 * dark "topographic map" background, their own centered wordmark, and their
 * own minimal nav — with no awareness of this global Nav mounting above
 * them in the root layout. Rendering both stacks two "Rivalys" wordmarks
 * and breaks the full-bleed panel design. This is a route-based client-side
 * check (not a route group) so the fix stays inside this component's own
 * file scope rather than requiring a restructure of `src/app`.
 */
const IMMERSIVE_ROUTE_PREFIXES = ["/login", "/signup", "/onboarding"];

export function Nav() {
  const pathname = usePathname();
  const isImmersiveRoute = IMMERSIVE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isImmersiveRoute) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-foreground"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-accent-strong font-mono text-[0.6rem] text-accent-strong"
          >
            R
          </span>
          Rivalys
        </Link>

        <nav
          aria-label="Navigation principale"
          className="hidden items-center gap-8 font-mono text-xs uppercase tracking-wide text-foreground-muted sm:flex"
        >
          <Link href="/#comment-ca-marche" className="transition-colors hover:text-foreground">
            Comment ça marche
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-foreground">
            Tableau de bord
          </Link>
          <Link href="/tasks" className="transition-colors hover:text-foreground">
            Tâches
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden px-2 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground sm:inline-block"
          >
            Connexion
          </Link>
          <Link href="/signup" className={buttonVariants({ variant: "primary", size: "sm" })}>
            Commencer
          </Link>
        </div>
      </div>
    </header>
  );
}
