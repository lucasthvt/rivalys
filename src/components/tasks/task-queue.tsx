"use client";

import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { dismissGap, markGapDone, reopenGap } from "@/app/tasks/actions";
import { GapListItem } from "./gap-list-item";
import {
  CATEGORY_LABEL,
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  sortGapsByPriority,
  type DetectedGap,
} from "./priority";
import type { GapCategory, GapPriority } from "@/lib/supabase/database.types";

/**
 * La file de tâches, manipulable sur place.
 *
 * Trois choses que la liste précédente ne faisait pas :
 *
 *   — l'écart part au clic, sans attendre le serveur ;
 *   — il reste annulable quelques secondes après coup ;
 *   — on peut réduire la file à une priorité ou une famille.
 *
 * L'annulation est le point important. Fermer un écart était irréversible depuis
 * l'interface : il fallait le rouvrir en base. Un geste qu'on répète des dizaines
 * de fois et qu'on ne peut pas défaire pousse à hésiter avant chaque clic, et une
 * file qu'on hésite à traiter ne se vide jamais.
 */

const UNDO_WINDOW_MS = 8000;

type Closure = { gap: DetectedGap; action: "done" | "dismiss" };

export function TaskQueue({ gaps }: { gaps: DetectedGap[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [priority, setPriority] = useState<GapPriority | null>(null);
  const [category, setCategory] = useState<GapCategory | null>(null);

  /** La dernière fermeture, tant qu'elle reste annulable. */
  const [closure, setClosure] = useState<Closure | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [optimistic, applyOptimistic] = useOptimistic(
    gaps,
    (current: DetectedGap[], id: string) => current.filter((gap) => gap.id !== id),
  );

  // La fenêtre d'annulation se referme d'elle-même. Le nettoyage au démontage évite
  // qu'un compte à rebours survive à la navigation et écrase un état plus récent.
  useEffect(() => {
    if (!closure) return;
    const handle = setTimeout(() => setClosure(null), UNDO_WINDOW_MS);
    timer.current = handle;
    return () => clearTimeout(handle);
  }, [closure]);

  const close = useCallback(
    (gap: DetectedGap, action: "done" | "dismiss") => {
      setError(null);
      if (timer.current) clearTimeout(timer.current);

      startTransition(async () => {
        applyOptimistic(gap.id);
        const result = action === "done" ? await markGapDone(gap.id) : await dismissGap(gap.id);
        if (result.ok) {
          setClosure({ gap, action });
        } else {
          setError(result.error);
        }
      });
    },
    [applyOptimistic],
  );

  const undo = useCallback(() => {
    if (!closure) return;
    const { gap } = closure;
    setClosure(null);
    setError(null);
    startTransition(async () => {
      const result = await reopenGap(gap.id);
      if (!result.ok) setError(result.error);
    });
  }, [closure]);

  const visible = sortGapsByPriority(
    optimistic.filter(
      (gap) =>
        (priority === null || gap.priority === priority) &&
        (category === null || gap.category === category),
    ),
  );

  // Les familles proposées sont celles réellement présentes dans la file : offrir un
  // filtre qui ne peut rien trouver n'est pas une option, c'est une impasse.
  const categories = [...new Set(optimistic.map((gap) => gap.category))];
  const filtered = priority !== null || category !== null;

  return (
    <div>
      <Filters
        gaps={optimistic}
        categories={categories}
        priority={priority}
        category={category}
        onPriority={setPriority}
        onCategory={setCategory}
        onClear={() => {
          setPriority(null);
          setCategory(null);
        }}
      />

      {error && (
        <p role="status" className="panel mt-6 px-6 py-4 text-sm text-flare">
          {error}
        </p>
      )}

      {closure && (
        <div
          role="status"
          className="panel mt-6 flex flex-wrap items-center justify-between gap-3 px-6 py-4"
        >
          <p className="text-sm text-mist">
            <span className="text-paper">
              {closure.action === "done" ? "Marqué comme fait" : "Ignoré"}
            </span>{" "}
            — « {closure.gap.title} »
          </p>
          <button
            type="button"
            onClick={undo}
            disabled={isPending}
            className="rounded-full border border-white/[0.14] px-4 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-paper transition-colors hover:border-signal-bright/50 hover:text-signal-bright disabled:opacity-40"
          >
            Annuler
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="panel mt-6 px-6 py-12 text-center text-sm text-mist">
          {filtered
            ? "Aucun écart ne correspond à ce filtre."
            : "Plus rien dans la file. Tout ce qui était ouvert a été traité."}
        </p>
      ) : (
        <div className="mt-6">
          <GapListItem gap={visible[0]} focal index={0} onDone={close} busy={isPending} />

          {/*
            Le reste de la file n'est plus enfermé dans un panneau : des rangs
            séparés par un filet, comme les listes de la landing. Un panneau
            autour d'une liste déjà bordée ajoutait un cadre sans rien distinguer,
            et il mettait le premier écart — celui qui a sa propre lueur — au même
            niveau visuel que le bloc qui le suit.
          */}
          {visible.length > 1 && (
            <ul className="border-b border-white/[0.1]">
              {visible.slice(1).map((gap, position) => (
                <GapListItem
                  key={gap.id}
                  gap={gap}
                  index={position + 1}
                  onDone={close}
                  busy={isPending}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Les filtres.
 *
 * Chaque bouton porte son propre compte : un filtre qui ne dit pas combien il va
 * laisser oblige à cliquer pour le savoir, puis à revenir en arrière.
 */
function Filters({
  gaps,
  categories,
  priority,
  category,
  onPriority,
  onCategory,
  onClear,
}: {
  gaps: DetectedGap[];
  categories: GapCategory[];
  priority: GapPriority | null;
  category: GapCategory | null;
  onPriority: (next: GapPriority | null) => void;
  onCategory: (next: GapCategory | null) => void;
  onClear: () => void;
}) {
  const priorities: GapPriority[] = ["high", "medium", "low"];
  const countByPriority = (value: GapPriority) => gaps.filter((g) => g.priority === value).length;
  const countByCategory = (value: GapCategory) => gaps.filter((g) => g.category === value).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {priorities.map((value) => {
          const count = countByPriority(value);
          return (
            <Chip
              key={value}
              selected={priority === value}
              disabled={count === 0}
              onClick={() => onPriority(priority === value ? null : value)}
              dot={PRIORITY_COLOR[value]}
              label={PRIORITY_LABEL[value]}
              count={count}
            />
          );
        })}

        {(priority !== null || category !== null) && (
          <button
            type="button"
            onClick={onClear}
            className="ml-1 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-signal-bright transition-colors hover:text-paper"
          >
            Tout voir
          </button>
        )}
      </div>

      {categories.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((value) => (
            <Chip
              key={value}
              selected={category === value}
              onClick={() => onCategory(category === value ? null : value)}
              label={CATEGORY_LABEL[value]}
              count={countByCategory(value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  selected,
  disabled = false,
  onClick,
  label,
  count,
  dot,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  count: number;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.1em] transition-colors disabled:cursor-default disabled:opacity-30 ${
        selected
          ? "border-signal-bright/45 bg-signal/15 text-paper"
          : "border-white/[0.14] text-mist hover:border-signal-bright/40 hover:text-paper"
      }`}
    >
      {dot && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: dot }}
        />
      )}
      {label}
      <span className="tabular-nums text-mist/60">{count}</span>
    </button>
  );
}
