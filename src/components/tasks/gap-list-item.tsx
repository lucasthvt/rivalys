import { CATEGORY_LABEL, type DetectedGap } from "./priority";
import { PriorityBadge } from "./priority-badge";
import { GapActions } from "./gap-actions";
import { GapDescription } from "./gap-description";

/**
 * Une ligne d'écart.
 *
 * Les boutons passent SOUS le texte plutôt qu'en face de lui : alignés à droite
 * d'un titre, ils captaient l'œil avant l'écart lui-même et laissaient un trou
 * au milieu de la ligne dès que la description faisait plus de deux lignes.
 * Ici l'ordre de lecture suit l'ordre de décision — priorité, fait constaté,
 * puis quoi en faire.
 *
 * `focal` sort la ligne du flux et lui donne la lueur du produit. Réservé au
 * premier écart de la liste, celui par lequel commencer : une liste où chaque
 * ligne a le même poids ne dit pas par où attaquer, alors que le tri, lui, le
 * sait déjà.
 *
 * `index` affiche le rang dans la file, comme les rangs numérotés de la landing
 * (les quatre familles, les neuf questions). Ce n'est pas un ornement : la file
 * est triée par priorité, et un numéro rend cet ordre visible au lieu de le
 * laisser deviner à la couleur des pastilles.
 */
export function GapListItem({
  gap,
  focal = false,
  index,
  onDone,
  busy = false,
}: {
  gap: DetectedGap;
  focal?: boolean;
  /** Rang dans la file, 0-indexé. Absent : aucun numéro n'est affiché. */
  index?: number;
  /**
   * Fermeture pilotée par le parent, qui gère alors le retrait optimiste et
   * l'annulation. Absent, la ligne retombe sur GapActions, qui agit seule et
   * attend le serveur — c'est le comportement d'origine, conservé pour tout
   * appelant qui n'a pas de file à tenir.
   */
  onDone?: (gap: DetectedGap, action: "done" | "dismiss") => void;
  busy?: boolean;
}) {
  return (
    <li
      className={
        focal
          ? "panel-focal mb-6 list-none p-6 sm:p-7"
          : "border-t border-white/[0.1] py-6 transition-colors hover:bg-white/[0.022]"
      }
    >
      <div className="flex items-baseline gap-4">
        {index === undefined ? null : (
          <span aria-hidden="true" className="font-mono text-[0.68rem] text-signal-bright">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <PriorityBadge priority={gap.priority} />
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-mist/60">
              {CATEGORY_LABEL[gap.category]}
            </span>
          </div>

          <h3 className="mt-3 font-brand text-[1.05rem] font-medium leading-snug tracking-[-0.01em] text-paper">
            {gap.title}
          </h3>
          <GapDescription text={gap.description} />

          <div className="mt-5">
            {onDone ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDone(gap, "done")}
                  className="rounded-full border border-white/[0.14] px-4 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-paper transition-colors hover:border-signal-bright/50 hover:bg-signal/15 hover:text-signal-bright disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Fait
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDone(gap, "dismiss")}
                  className="rounded-full px-4 py-1.5 font-mono text-[0.66rem] uppercase tracking-[0.1em] text-mist/70 transition-colors hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Ignorer
                </button>
              </div>
            ) : (
              <GapActions gapId={gap.id} />
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
