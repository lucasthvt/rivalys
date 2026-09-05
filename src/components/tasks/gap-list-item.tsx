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
 */
export function GapListItem({
  gap,
  focal = false,
  onDone,
  busy = false,
}: {
  gap: DetectedGap;
  focal?: boolean;
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
          ? "panel-focal mb-5 list-none px-5 py-6"
          : "border-b border-surface-border py-5 last:border-b-0"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={gap.priority} />
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground-muted/70">
          {CATEGORY_LABEL[gap.category]}
        </span>
      </div>

      <h3 className="mt-3 text-[15px] font-medium leading-snug text-foreground">{gap.title}</h3>
      <GapDescription text={gap.description} />

      <div className="mt-4">
        {onDone ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDone(gap, "done")}
              className="rounded-full border border-surface-border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-foreground transition-colors hover:border-accent-strong hover:bg-accent/10 hover:text-signal-bright disabled:cursor-not-allowed disabled:opacity-40"
            >
              Fait
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDone(gap, "dismiss")}
              className="rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-foreground-muted/70 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ignorer
            </button>
          </div>
        ) : (
          <GapActions gapId={gap.id} />
        )}
      </div>
    </li>
  );
}
