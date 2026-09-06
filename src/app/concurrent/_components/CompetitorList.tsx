"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPrimaryCompetitor } from "../actions";
import { CompetitorForm } from "./CompetitorForm";

export interface TrackedCompetitor {
  id: string;
  /** Nom enregistré, ou domaine à défaut — jamais deviné. */
  label: string;
  url: string;
  isPrimary: boolean;
  addedOn: string;
  /** Date du prochain remplacement possible, si le délai court encore. */
  lockedUntil: string | null;
}

/**
 * Les concurrents suivis, un rang par place occupée.
 *
 * Deux actions par rang, et une seule ouverte à la fois : désigner le concurrent principal
 * — celui que les écrans ouvrent par défaut — et remplacer son URL. Le formulaire de
 * remplacement est replié tant qu'on ne le demande pas : déplié sur chaque rang, l'écran
 * proposerait trois champs identiques et rien n'indiquerait lequel agit sur quoi.
 */
export function CompetitorList({ competitors }: { competitors: TrackedCompetitor[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function makePrimary(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await setPrimaryCompetitor(id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <>
      {error && (
        <p role="alert" className="border-b border-white/[0.08] px-6 py-4 text-sm text-flare">
          {error}
        </p>
      )}

      <ul className="flex flex-col divide-y divide-white/[0.08]">
        {competitors.map((competitor, index) => (
          <li key={competitor.id} className="px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-baseline gap-4">
                <span aria-hidden="true" className="font-mono text-[0.68rem] text-signal-bright">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-3">
                    <span className="font-brand text-lg font-bold tracking-[-0.02em] text-paper">
                      {competitor.label}
                    </span>
                    {competitor.isPrimary && (
                      <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-signal-bright">
                        Principal
                      </span>
                    )}
                  </p>
                  <a
                    href={competitor.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-block break-all font-mono text-sm text-mist transition-colors hover:text-paper"
                  >
                    {competitor.url}
                  </a>
                  <p className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist/50">
                    Ajouté le {competitor.addedOn}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {!competitor.isPrimary && (
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => makePrimary(competitor.id)}
                    className="rounded-full border border-white/[0.14] px-3.5 py-1.5 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-paper transition-colors hover:border-signal-bright/50 hover:text-signal-bright disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Rendre principal
                  </button>
                )}
                <button
                  type="button"
                  aria-expanded={editing === competitor.id}
                  onClick={() => setEditing(editing === competitor.id ? null : competitor.id)}
                  className="rounded-full px-3 py-1.5 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-mist/70 transition-colors hover:text-paper"
                >
                  {editing === competitor.id ? "Annuler" : "Changer l'URL"}
                </button>
              </div>
            </div>

            {editing === competitor.id &&
              (competitor.lockedUntil ? (
                <div className="mt-4 rounded-xl border border-white/[0.1] px-4 py-3.5">
                  <p className="text-sm font-medium text-paper">
                    Changement possible le {competitor.lockedUntil}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-mist">
                    Cette place a été remplacée récemment. Chaque remplacement efface les
                    relevés du site précédent et relance une analyse complète — le délai évite
                    qu&rsquo;une place serve à scanner le marché entier.
                  </p>
                </div>
              ) : (
                <div className="-mx-6 mt-2 border-t border-white/[0.08]">
                  <CompetitorForm competitorId={competitor.id} />
                </div>
              ))}
          </li>
        ))}
      </ul>
    </>
  );
}
