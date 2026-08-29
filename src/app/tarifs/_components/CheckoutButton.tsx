"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Bouton de souscription d'un palier payant.
 *
 * Ne parle jamais à Stripe directement : il appelle notre route serveur, qui crée la
 * session et renvoie son URL. Aucune clé, aucun identifiant de prix ne descend dans le
 * navigateur.
 *
 * `authenticated` vient du serveur. Un visiteur déconnecté est envoyé s'inscrire — il n'a
 * pas encore de compte auquel rattacher un abonnement.
 */
export function CheckoutButton({
  tier,
  period = "monthly",
  label,
  authenticated,
  className,
}: {
  tier: "pro" | "growth";
  period?: "monthly" | "yearly";
  label: string;
  authenticated: boolean;
  className: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!authenticated) {
      router.push(`/signup?palier=${tier}`);
      return;
    }

    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, period }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Impossible d'ouvrir le paiement.";
        setError(message);
        setPending(false);
        return;
      }

      const url =
        payload && typeof payload === "object" && "url" in payload
          ? String((payload as { url: unknown }).url)
          : null;

      if (!url) {
        setError("Impossible d'ouvrir le paiement.");
        setPending(false);
        return;
      }

      // Redirection pleine page vers Checkout : c'est là qu'Apple Pay et Google Pay
      // apparaissent, sur le domaine vérifié de Stripe.
      window.location.assign(url);
    } catch {
      setError("Impossible d'ouvrir le paiement. Vérifie ta connexion.");
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={pending} className={className}>
        {pending ? "Ouverture…" : label}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-xs leading-relaxed text-flare">
          {error}
        </p>
      )}
    </div>
  );
}
