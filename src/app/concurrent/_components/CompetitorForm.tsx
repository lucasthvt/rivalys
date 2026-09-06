"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { isLikelyUrl, normalizeUrl } from "@/lib/url";
import { addCompetitor, replaceCompetitorUrl } from "../actions";

/**
 * Ajoute un concurrent, ou remplace l'URL d'un concurrent existant.
 *
 * Le remplacement est destructeur à dessein (voir replaceCompetitorUrl) : les écarts
 * encore ouverts de l'ancien site sont fermés et ses relevés supprimés, parce qu'ils
 * décrivent un autre site. D'où la confirmation — un domaine mal tapé viderait sinon la
 * file de tâches d'un seul geste.
 *
 * `competitorId` absent = ajout sur une place libre. Un ajout ne détruit rien, il ne
 * demande donc pas de confirmation : la seule question est de savoir s'il reste une place,
 * et l'action serveur y répond.
 */
export function CompetitorForm({ competitorId }: { competitorId?: string }) {
  const hasCompetitor = competitorId !== undefined;
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isValid = isLikelyUrl(url);

  /**
   * L'adresse réellement lue, affichée pendant la frappe.
   *
   * Taper « concurrent.com » déclenche une analyse de « https://concurrent.com » : la
   * complétion se faisait en silence, côté serveur, et le champ ne montrait jamais la
   * cible. Une virgule à la place du point ne se voyait donc qu'après avoir écrasé le
   * concurrent précédent — un geste destructeur (voir setCompetitor).
   *
   * `normalizeUrl` est le même helper que celui de la validation, pour que ce qui est
   * annoncé ici soit exactement ce qui sera enregistré.
   */
  const target = url.trim() === "" ? null : normalizeUrl(url);
  const host = (() => {
    if (!target || !isValid) return null;
    try {
      return new URL(target).hostname;
    } catch {
      return null;
    }
  })();

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
      const result = competitorId
        ? await replaceCompetitorUrl(competitorId, url)
        : await addCompetitor(url);

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
    <form onSubmit={handleSubmit} noValidate className="px-6 py-6">
      <label htmlFor="competitorUrl" className="block">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-mist/70">
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
          className="mt-2.5 w-full rounded-xl border border-white/[0.14] bg-void/60 px-4 py-3.5 font-mono text-[0.95rem] text-paper outline-none transition-colors placeholder:text-mist/40 focus:border-signal-bright"
        />
      </label>

      {/*
        Retour pendant la frappe : ce qui sera lu, ou ce qui cloche. Occupe une hauteur
        fixe pour que le formulaire ne saute pas d'une ligne à chaque caractère.
      */}
      <p
        aria-live="polite"
        className="font-mono mt-2.5 min-h-[1.25rem] text-[0.7rem] tracking-[0.02em]"
      >
        {url.trim() === "" ? (
          <span className="text-mist/40">—</span>
        ) : isValid ? (
          <span className="text-signal-bright">On lira {host}</span>
        ) : (
          <span className="text-flare">
            Adresse incomplète — il faut un nom de domaine, par exemple concurrent.com
          </span>
        )}
      </p>

      <p id="competitorUrlHint" className="mt-3 text-sm leading-relaxed text-mist">
        On ne lit que ce qui est déjà public sur son site : pricing affiché, positionnement,
        liens vers ses réseaux. Rien de privé, et uniquement l&rsquo;adresse que tu renseignes
        ici.
      </p>

      {confirming && (
        <div className="mt-6 rounded-xl border-l-2 border-flare bg-flare/10 px-4 py-3.5">
          <p className="text-sm font-medium text-paper">Remplacer ton concurrent actuel ?</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-sm leading-relaxed text-mist">
            <li>
              Les écarts encore ouverts pour l&rsquo;ancien concurrent passent en{" "}
              <span className="text-paper">ignoré</span> : ils décrivaient son site, pas
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
          className="inline-flex h-11 items-center justify-center rounded-full bg-signal px-6 text-sm font-semibold text-paper shadow-signal-sm transition-colors hover:bg-signal-bright hover:text-void disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending
            ? "Enregistrement…"
            : confirming
              ? "Confirmer le remplacement"
              : hasCompetitor
                ? "Remplacer ce concurrent"
                : "Ajouter ce concurrent"}
        </button>

        {confirming && !isPending && (
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/[0.14] px-6 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-mist transition-colors hover:border-paper/40 hover:text-paper"
          >
            Annuler
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-5 rounded-xl border-l-2 border-flare bg-flare/10 px-4 py-3.5 text-sm text-flare">
          {error}
        </p>
      )}

      {saved && (
        <p className="mt-5 rounded-xl border-l-2 border-mint bg-mint/10 px-4 py-3.5 text-sm leading-relaxed text-paper">
          Concurrent enregistré. Rien n&rsquo;a encore été relevé sur son site —{" "}
          <Link href="/dashboard" className="text-signal-bright underline underline-offset-2">
            lance une analyse depuis le tableau de bord
          </Link>{" "}
          pour comparer les deux.
        </p>
      )}
    </form>
  );
}
