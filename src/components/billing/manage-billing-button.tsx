"use client";

import { useState } from "react";

/**
 * Ouvre le portail client Stripe (carte, passage mensuel/annuel, factures, résiliation).
 *
 * Rien de tout cela n'est réimplémenté dans le produit : le portail gère les prorata, les
 * relances et la conformité, et une résiliation faite là-bas revient par le même webhook
 * que le reste. Un écran de gestion maison serait du travail en plus pour un résultat
 * moins fiable.
 */
export function ManageBillingButton({ className }: { className: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload: unknown = await response.json().catch(() => null);

      const url =
        response.ok && payload && typeof payload === "object" && "url" in payload
          ? String((payload as { url: unknown }).url)
          : null;

      if (!url) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Impossible d'ouvrir la gestion de l'abonnement.";
        setError(message);
        setPending(false);
        return;
      }

      window.location.assign(url);
    } catch {
      setError("Impossible d'ouvrir la gestion de l'abonnement.");
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={openPortal} disabled={pending} className={className}>
        <CardIcon />
        {pending ? "Ouverture…" : "Gérer mon abonnement"}
      </button>
      {error && (
        <p role="alert" className="mt-1 px-3 text-xs leading-relaxed text-flare">
          {error}
        </p>
      )}
    </div>
  );
}

function CardIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-[18px] w-[18px] shrink-0"
      aria-hidden="true"
    >
      <rect x="2.5" y="4.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 8.5h15" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
