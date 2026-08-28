"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";

// Routes qui portent leur propre chrome (AppShell + Sidebar, ou panneau plein écran) :
// y superposer la nav marketing dupliquerait le wordmark et la navigation.
// Toute nouvelle route applicative doit être ajoutée ici en même temps qu'à
// NAV_ITEMS dans Sidebar.tsx.
const HIDE_NAV_PREFIXES = [
  "/login",
  "/signup",
  "/onboarding",
  "/dashboard",
  "/tasks",
  "/score",
  "/statistiques",
  "/concurrent",
];

export function NavBar({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();
  const hideNav = HIDE_NAV_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (hideNav) {
    return null;
  }

  return (
    // Barre flottante : détachée du bord haut, elle se déplace avec le défilement sans
    // jamais coller au sommet. Le conteneur externe reste transparent et sans pointeur —
    // seule la barre elle-même intercepte les clics, pour que la bande vide de part et
    // d'autre ne bloque pas le contenu qui défile dessous.
    <header className="pointer-events-none sticky top-0 z-40 px-4 pt-4 sm:px-6">
      <div className="floating-bar pointer-events-auto mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 pl-5 pr-2">
        <Logo />

        <nav
          aria-label="Navigation principale"
          className="hidden items-center gap-7 text-[0.875rem] text-mist sm:flex"
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
