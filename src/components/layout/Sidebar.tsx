"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { createClient } from "@/lib/supabase/client";
import type { SubscriptionTier } from "@/lib/supabase/database.types";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";

// Toute entrée ajoutée ici doit l'être aussi dans HIDE_NAV_PREFIXES (NavBar.tsx),
// sinon la nav marketing se superpose à cette sidebar sur la route concernée.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", icon: GridIcon },
  { href: "/tasks", label: "Tâches", icon: ChecklistIcon },
  { href: "/score", label: "Score", icon: GaugeIcon },
  { href: "/statistiques", label: "Statistiques", icon: ChartIcon },
  { href: "/concurrent", label: "Concurrent", icon: TargetIcon },
  { href: "/compte", label: "Mon compte", icon: UserIcon },
] as const;

/**
 * Navigation rail for the authenticated screens (/dashboard, /tasks) — replaces the
 * marketing Nav there (see Nav.tsx's HIDE_NAV_PREFIXES), same "signal" palette so the
 * whole product reads as one continuous dark surface from landing through to the app.
 *
 * De `md` vers le haut : collée (`sticky`) sur toute la hauteur de la fenêtre, pour que
 * la navigation et le bouton de déconnexion restent atteignables quel que soit le
 * défilement de la page. En statique, la sidebar s'étirait sur toute la hauteur du
 * document : sur une page longue, « Se déconnecter » se retrouvait tout en bas.
 * En dessous de `md`, elle redevient un tiroir hors-écran dont l'état d'ouverture est
 * détenu par AppShell (qui rend aussi le fond et la barre supérieure mobile).
 *
 * Closed-on-mobile uses `invisible` rather than the `inert` attribute: both keep the
 * off-screen links out of the tab order, but `inert` is a DOM attribute with no
 * breakpoint awareness, so it would also disable the permanently-visible desktop
 * sidebar. `invisible md:visible` is the same guarantee, scoped to the breakpoint
 * where it applies.
 */
const TIER_LABEL: Record<SubscriptionTier, string> = {
  starter: "Gratuit",
  pro: "Pro",
  growth: "Growth",
};

export function Sidebar({
  userLabel,
  tier,
  drawerOpen,
  onClose,
}: {
  userLabel: string;
  tier?: SubscriptionTier | null;
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
      className={`fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col overflow-y-auto border-r border-white/[0.08] bg-void-raised/70 backdrop-blur-xl transition-transform duration-200 ease-out motion-reduce:transition-none md:sticky md:top-0 md:bottom-auto md:z-auto md:h-screen md:visible md:translate-x-0 ${
        drawerOpen ? "visible translate-x-0" : "invisible -translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between px-5 py-5">
        <Logo onClick={onClose} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le menu"
          className="-mr-1 flex h-8 w-8 items-center justify-center rounded-xl text-mist transition-colors hover:bg-white/[0.04] hover:text-paper md:hidden"
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
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/[0.055] text-paper"
                  : "text-mist hover:bg-white/[0.03] hover:text-paper"
              }`}
            >
              <Icon className={isActive ? "text-signal-bright" : "text-mist"} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.08] px-3 py-4">
        <div className="flex items-center justify-between gap-2 px-3">
          <p className="truncate text-sm text-paper" title={userLabel}>
            {userLabel}
          </p>
          {/*
            Le palier est une information factuelle sur le compte, pas une
            récompense : même pastille discrète pour « Gratuit » que pour
            « Pro », seule la teinte change.
          */}
          {tier ? (
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                tier === "starter"
                  ? "border-white/[0.14] text-mist"
                  : "border-signal-bright/40 text-signal-bright"
              }`}
            >
              {TIER_LABEL[tier]}
            </span>
          ) : null}
        </div>
        {/*
          Visible seulement pour un abonné : le portail Stripe n'a rien à montrer à un
          compte gratuit, et le bouton renverrait une erreur.
        */}
        {tier && tier !== "starter" ? (
          <div className="mt-2">
            <ManageBillingButton className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-mist transition-colors hover:bg-white/[0.03] hover:text-paper disabled:opacity-50" />
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-mist transition-colors hover:bg-white/[0.03] hover:text-paper disabled:opacity-50"
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

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-[18px] w-[18px] shrink-0 ${className ?? ""}`}
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
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

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-[18px] w-[18px] shrink-0 ${className ?? ""}`}
      aria-hidden="true"
    >
      <circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.8 17c0-2.9 2.8-4.7 6.2-4.7s6.2 1.8 6.2 4.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
