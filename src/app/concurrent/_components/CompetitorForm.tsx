"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { isLikelyUrl } from "@/lib/url";
import { setCompetitor } from "../actions";

/**
 * Adds or replaces the primary competitor.
 *
 * Replacing is destructive on purpose (see setCompetitor): the previous
 * competitor's open écarts are closed and its relevés deleted, because they
 * describe another site. So a replacement asks for a confirmation first —
 * a single mistyped domain would otherwise wipe the user's task list.
 */
export function CompetitorForm({ hasCompetitor }: { hasCompetitor: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isValid = isLikelyUrl(url);

  function handleChange(value: string) {
    setUrl(value);
    // A confirmation applies to the URL that was on screen when it was asked.
    setConfirming(false);
    setError(null);
    setSaved(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValid || isPending) return;

    setError(null);
    setSaved(false);

    if (hasCompetitor && !confirming) {
      setConfirming(true);
      return;
    }

    startTransition(async () => {
      const result = await setCompetitor(url);

      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }

      setConfirming(false);
      setUrl("");
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="px-5 py-5">
      <label htmlFor="competitorUrl" className="block">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
          URL du concurrent
        </span>
        <input
          id="competitorUrl"
          name="competitorUrl"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={url}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="concurrent.com"
          aria-describedby="competitorUrlHint"
          className="mt-3 w-full border border-surface-border bg-background px-4 py-3 text-[15px] text-foreground outline-none transition-colors placeholder:text-foreground-muted/50 focus:border-accent"
        />
      </label>

      <p id="competitorUrlHint" className="mt-3 text-sm leading-relaxed text-foreground-muted">
        On ne lit que ce qui est déjà public sur son site : pricing affiché, positionnement,
        liens vers ses réseaux. Rien de privé, et uniquement l&rsquo;adresse que tu renseignes
        ici.
      </p>

      {confirming && (
        <div className="mt-5 border-l-2 border-flare bg-flare/10 px-4 py-3">
          <p className="text-sm font-medium text-foreground">Remplacer ton concurrent actuel ?</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-sm leading-relaxed text-foreground-muted">
            <li>
              Les écarts encore ouverts pour l&rsquo;ancien concurrent passent en{" "}
              <span className="text-foreground">ignoré</span> : ils décrivaient son site, pas
              celui-ci. Ils restent comptés dans tes statistiques.
            </li>
            <li>
              Ses relevés sont supprimés — sinon le comparatif afficherait ses anciennes données
              sous le nom du nouveau.
            </li>
            <li>
              Aucune donnée n&rsquo;est récupérée tout de suite : il faudra lancer une analyse.
            </li>
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!isValid || isPending}
          className="font-mono border border-accent bg-accent px-5 py-2.5 text-[11px] uppercase tracking-[0.14em] text-accent-foreground transition-colors hover:border-accent-strong hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending
            ? "Enregistrement…"
            : confirming
              ? "Confirmer le remplacement"
              : hasCompetitor
                ? "Remplacer le concurrent"
                : "Ajouter ce concurrent"}
        </button>

        {confirming && !isPending && (
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="font-mono border border-surface-border px-5 py-2.5 text-[11px] uppercase tracking-[0.14em] text-foreground-muted transition-colors hover:border-foreground hover:text-foreground"
          >
            Annuler
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 border-l-2 border-flare bg-flare/10 px-4 py-3 text-sm text-flare">
          {error}
        </p>
      )}

      {saved && (
        <p className="mt-4 border-l-2 border-mint bg-mint/10 px-4 py-3 text-sm leading-relaxed text-foreground">
          Concurrent enregistré. Rien n&rsquo;a encore été relevé sur son site —{" "}
          <Link href="/dashboard" className="text-accent-strong underline underline-offset-2">
            lance une analyse depuis le tableau de bord
          </Link>{" "}
          pour comparer les deux.
        </p>
      )}
    </form>
  );
}
