"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const HIDE_NAV_PREFIXES = ["/login", "/signup", "/onboarding", "/dashboard", "/tasks"];

export function NavBar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();
  const hideNav = HIDE_NAV_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (hideNav) {
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
          <Link href="/tarifs" className="transition-colors hover:text-paper">
            Tarifs
          </Link>
          <Link href="/#faq" className="transition-colors hover:text-paper">
            FAQ
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-full bg-signal px-4 text-sm font-semibold text-paper shadow-signal-sm transition-colors duration-150 hover:bg-signal-bright hover:text-void"
            >
              Tableau de bord
            </Link>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </header>
  );
}
