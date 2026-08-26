"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Sidebar } from "./Sidebar";

/**
 * App-shell layout for the authenticated screens (/dashboard, /tasks).
 *
 * Desktop: a static sidebar beside the content. Mobile: the sidebar becomes an
 * off-canvas drawer behind a compact top bar, because a fixed 240px rail on a 375px
 * screen leaves the content unusable.
 *
 * Client component so it can own the drawer's open state. `children` are still
 * server-rendered — they arrive as a prop, already resolved, and are never
 * re-rendered on the client.
 */
export function AppShell({ userLabel, children }: { userLabel: string; children: ReactNode }) {
  // Navigating from inside the drawer closes it from the link's own click handler
  // (Sidebar calls onClose), rather than from an effect watching the pathname: it's a
  // user event, not state that needs syncing to an external system.
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  // min-h-screen, pas min-h-full : `min-height: 100%` ne se résout pas dans cette chaîne
  // de conteneurs flex (le parent n'a pas de hauteur définie), il retombe sur `auto` et le
  // conteneur ne fait alors que la hauteur de son contenu — la sidebar, étirée sur ce
  // conteneur trop court, s'arrêtait en plein milieu de la page.
  //
  // 100vh est exact ici parce que Nav est masquée sur /dashboard et /tasks (voir
  // HIDE_NAV_PREFIXES dans Nav.tsx) : rien au-dessus de cet élément, donc rien à
  // soustraire. Si Nav devait réapparaître sur ces routes, il faudrait un calc() qui
  // déduit sa hauteur.
  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-surface-border bg-surface px-4 md:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={drawerOpen}
          className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-mist transition-colors hover:bg-surface-hover hover:text-paper"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
            <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <Link href="/" className="flex items-center gap-2 text-paper">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-signal-bright to-signal font-brand text-[0.65rem] font-bold text-void"
          >
            R
          </span>
          <span className="font-brand text-[0.95rem] font-semibold tracking-tight">Rivalys</span>
        </Link>
      </div>

      {drawerOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-void/70 backdrop-blur-sm md:hidden"
        />
      )}

      <Sidebar userLabel={userLabel} drawerOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
