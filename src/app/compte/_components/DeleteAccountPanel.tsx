"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteMyAccount } from "../actions";
import { DELETE_CONFIRMATION } from "../constants";

/**
 * Suppression définitive du compte (RGPD, article 17).
 *
 * Le mot à taper n'est pas un ornement : c'est la seule chose qui distingue une intention
 * d'un clic de trop sur une action strictement irréversible. Ce qui va disparaître est
 * énuméré au-dessus, avant la case, pas dans une phrase après le bouton.
 */
export function DeleteAccountPanel({ hasSubscription }: { hasSubscription: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setPending(true);

    const result = await deleteMyAccount(confirmation);

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    // Le compte n'existe plus côté serveur, mais le cookie de session traîne encore dans
    // ce navigateur. On le fait sauter explicitement avant de partir, sinon la personne
    // navigue quelques secondes avec une session qui ne correspond plus à rien.
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mt-5 rounded-2xl border border-flare/30 bg-flare/[0.04] p-6">
      <h2 className="font-brand text-base font-semibold text-foreground">Supprimer mon compte</h2>
      <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
        Article 17 du RGPD. La suppression est immédiate et définitive : profil, concurrent
        suivi, relevés, écarts détectés et historique du score sont effacés, sans copie
        conservée de notre côté.
      </p>
      {hasSubscription ? (
        <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
          Ton abonnement Stripe est résilié avant la suppression. Si la résiliation échoue,
          rien n&rsquo;est supprimé — tu ne peux pas te retrouver débité pour un compte qui
          n&rsquo;existe plus.
        </p>
      ) : null}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-5 inline-flex h-10 items-center justify-center rounded-full border border-flare/40 px-5 text-sm font-semibold text-flare transition-colors hover:bg-flare/10"
        >
          Supprimer mon compte
        </button>
      ) : (
        <div className="mt-5">
          <label
            htmlFor="delete-confirmation"
            className="block text-sm font-medium text-foreground"
          >
            Tape <span className="font-mono">{DELETE_CONFIRMATION}</span> pour confirmer
          </label>
          <input
            id="delete-confirmation"
            type="text"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            className="mt-2 h-10 w-full max-w-xs rounded-lg border border-surface-border bg-surface px-3 font-mono text-sm text-foreground outline-none focus:border-flare/60"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending || confirmation.trim() !== DELETE_CONFIRMATION}
              className="inline-flex h-10 items-center justify-center rounded-full bg-flare px-5 text-sm font-semibold text-void transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmation("");
                setError(null);
              }}
              disabled={pending}
              className="inline-flex h-10 items-center justify-center rounded-full border border-surface-border px-5 text-sm font-semibold text-foreground transition-colors hover:border-signal-bright/40"
            >
              Annuler
            </button>
          </div>

          {error ? (
            <p role="alert" className="mt-3 text-xs leading-relaxed text-flare">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
