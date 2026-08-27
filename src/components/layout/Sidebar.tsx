"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Toute entrée ajoutée ici doit l'être aussi dans HIDE_NAV_PREFIXES (NavBar.tsx),
// sinon la nav marketing se superpose à cette sidebar sur la route concernée.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", icon: GridIcon },
  { href: "/tasks", label: "Tâches", icon: ChecklistIcon },
  { href: "/score", label: "Score", icon: GaugeIcon },
  { href: "/statistiques", label: "Statistiques", icon: ChartIcon },
] as const;

/**
 * Navigation rail for the authenticated screens (/dashboard, /tasks) — replaces the
 * marketing Nav there (see Nav.tsx's HIDE_NAV_PREFIXES), same "signal" palette so the
 * whole product reads as one continuous dark surface from landing through to the app.
 *
 * Static beside the content from `md` up; below that it slides in as an off-canvas
 * drawer whose open state is owned by AppShell (which also renders the backdrop and
 * the mobile top bar).
 *
 * Closed-on-mobile uses `invisible` rather than the `inert` attribute: both keep the
 * off-screen links out of the tab order, but `inert` is a DOM attribute with no
 * breakpoint awareness, so it would also disable the permanently-visible desktop
 * sidebar. `invisible md:visible` is the same guarantee, scoped to the breakpoint
 * where it applies.
 */
export function Sidebar({
  userLabel,
  drawerOpen,
  onClose,
}: {
  userLabel: string;
  drawerOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    onClose();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-surface-border bg-surface transition-transform duration-200 ease-out motion-reduce:transition-none md:static md:z-auto md:visible md:translate-x-0 ${
        drawerOpen ? "visible translate-x-0" : "invisible -translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/" onClick={onClose} className="flex items-center gap-2.5 text-paper">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-signal-bright to-signal font-brand text-xs font-bold text-void shadow-signal-sm"
          >
            R
          </span>
          <span className="font-brand text-[1.05rem] font-semibold tracking-tight">Rivalys</span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu"
          className="-mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-mist transition-colors hover:bg-surface-hover hover:text-paper md:hidden"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <nav aria-label="Navigation de l'application" className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-surface-hover text-paper"
                  : "text-mist hover:bg-surface-hover hover:text-paper"
              }`}
            >
              <Icon className={isActive ? "text-signal-bright" : "text-mist"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-surface-border px-3 py-4">
        <p className="truncate px-3 text-sm text-paper" title={userLabel}>
          {userLabel}
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-mist transition-colors hover:bg-surface-hover hover:text-paper disabled:opacity-50"
        >
          <LogoutIcon className="text-mist" />
          {signingOut ? "Déconnexion..." : "Se déconnecter"}
        </button>
      </div>
    </aside>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-[18px] w-[18px] shrink-0 ${className ?? ""}`}
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-[18px] w-[18px] shrink-0 ${className ?? ""}`}
      aria-hidden="true"
    >
      <path d="M3 5.5l1.4 1.4L7 4.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12.5l1.4 1.4L7 11.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9.5 12h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function GaugeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-[18px] w-[18px] shrink-0 ${className ?? ""}`}
      aria-hidden="true"
    >
      <path
        d="M3.5 14.5a7.5 7.5 0 1113 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M10 14.5L13.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-[18px] w-[18px] shrink-0 ${className ?? ""}`}
      aria-hidden="true"
    >
      <path d="M3 17h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="4" y="10" width="3" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.4" />
      <rect x="8.5" y="6" width="3" height="8" rx="0.6" stroke="currentColor" strokeWidth="1.4" />
      <rect x="13" y="3" width="3" height="11" rx="0.6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-[18px] w-[18px] shrink-0 ${className ?? ""}`}
      aria-hidden="true"
    >
      <path
        d="M7.5 17H4.5a1 1 0 01-1-1V4a1 1 0 011-1h3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13 13.5L17 10l-4-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 10H7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
