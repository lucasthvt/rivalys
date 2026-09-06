import { PRIORITY_COLOR, PRIORITY_LABEL, type GapPriority } from "./priority";

/**
 * L'étiquette de priorité — une pastille pleine suivie du mot, sans cadre.
 *
 * Le cadre est parti avec la refonte : la landing pose ses priorités comme un
 * point et un mot, et un badge encadré au milieu d'une ligne déjà bordée fait
 * une boîte dans une boîte. La graduation est portée par la pastille seule (voir
 * PRIORITY_COLOR), ce qui laisse le texte à la même valeur pour les trois
 * niveaux : c'est l'intensité qui hiérarchise, pas le contraste du libellé.
 */
export function PriorityBadge({ priority }: { priority: GapPriority }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[0.64rem] uppercase tracking-[0.1em] text-mist">
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: PRIORITY_COLOR[priority] }}
      />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
