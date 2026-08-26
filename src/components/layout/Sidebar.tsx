"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", icon: GridIcon },
  { href: "/tasks", label: "Tâches", icon: ChecklistIcon },
] as const;

/**
 * App-shell sidebar for the authenticated screens (/dashboard, /tasks) —
 * replaces the marketing Nav there (see Nav.tsx's HIDE_NAV_PREFIXES), same
 * "signal" palette so the whole product reads as one continuous dark
 * surface from landing through to the app itself.
 */
export function Sidebar({ userLabel }: { userLabel: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-surface-border bg-surface">
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5 text-paper">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-signal-bright to-signal font-brand text-xs font-bold text-void shadow-signal-sm"
        >
          R
        </span>
        <span className="font-brand text-[1.05rem] font-semibold tracking-tight">Rivalys</span>
      </Link>

      <nav aria-label="Navigation de l'application" className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
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
