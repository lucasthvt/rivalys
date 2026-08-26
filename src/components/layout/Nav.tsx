"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
 * Hidden on /login, /signup, and /onboarding: those routes are immersive
 * full-bleed screens with their own centered wordmark and minimal nav.
 * Rendering both stacks two "Rivalys" wordmarks and breaks the full-bleed
 * panel design.
 *
 * Styled with the "signal" palette (see globals.css) — permanently dark,
 * independent of the semantic --background/--foreground tokens the shared
 * ui/ components use, so it reads as one continuous brand chrome above
 * both the new landing and the dashboard/tasks screens beneath it.
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
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-void/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5 text-paper">
          <span
            aria-hidden="true"
            className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-signal-bright to-signal font-brand text-xs font-bold text-void shadow-signal-sm"
          >
            R
          </span>
          <span className="font-brand text-[1.05rem] font-semibold tracking-tight">Rivalys</span>
        </Link>

        <nav
          aria-label="Navigation principale"
          className="hidden items-center gap-8 font-mono text-[0.7rem] uppercase tracking-[0.12em] text-mist sm:flex"
        >
          <Link href="/#comment-ca-marche" className="transition-colors hover:text-paper">
            Comment ça marche
          </Link>
          <Link href="/dashboard" className="transition-colors hover:text-paper">
            Tableau de bord
          </Link>
          <Link href="/tasks" className="transition-colors hover:text-paper">
            Tâches
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden px-3 text-sm font-medium text-mist transition-colors hover:text-paper sm:inline-block"
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center justify-center rounded-full bg-signal px-4 text-sm font-semibold text-paper shadow-signal-sm transition-colors duration-150 hover:bg-signal-bright hover:text-void"
          >
            Commencer
          </Link>
        </div>
      </div>
    </header>
  );
}
