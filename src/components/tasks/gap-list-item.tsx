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
 */
export function GapListItem({ gap }: { gap: DetectedGap }) {
  return (
    <li className="border-b border-surface-border py-5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={gap.priority} />
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-foreground-muted/70">
          {CATEGORY_LABEL[gap.category]}
        </span>
      </div>

      <h3 className="mt-3 text-[15px] font-medium leading-snug text-foreground">{gap.title}</h3>
      <GapDescription text={gap.description} />

      <div className="mt-4">
        <GapActions gapId={gap.id} />
      </div>
    </li>
  );
}
