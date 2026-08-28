import { CATEGORY_LABEL } from "@/components/tasks/priority";
import { POINTS_PER_PRIORITY } from "@/lib/compare/score";
import type { GapCategory, GapPriority } from "@/lib/supabase/database.types";

const CATEGORY_ORDER: GapCategory[] = [
  "pricing",
  "auth",
  "payment",
  "positioning",
  "reviews",
  "social_presence",
];

/**
 * Où le score se perd, catégorie par catégorie.
 *
 * Volontairement PAS un sous-score sur 20 par catégorie : ça supposerait un
 * maximum par catégorie que rien ne définit, et la somme des sous-scores
 * divergerait du score global (qui est écrêté à 0 une seule fois, globalement).
 * Ce qui est montré est directement dérivé du calcul réel — les points retirés
 * par les écarts ouverts de chaque catégorie — donc les deux chiffres ne peuvent
 * pas se contredire.
 *
 * Les barres sont mises à l'échelle du plus gros poste, pas du total : sur un
 * profil où une catégorie coûte 30 points et une autre 2, une échelle absolue
 * rendrait la seconde invisible alors qu'elle est bien réelle.
 */
export function CategoryBars({
  gaps,
  analysed,
}: {
  gaps: { category: GapCategory; priority: GapPriority }[];
  /** Aucune analyse encore lancée pour ce concurrent : rien à répartir. */
  analysed: boolean;
}) {
  const rows = CATEGORY_ORDER.map((category) => {
    const inCategory = gaps.filter((gap) => gap.category === category);
    const pointsLost = inCategory.reduce(
      (sum, gap) => sum + POINTS_PER_PRIORITY[gap.priority],
      0,
    );
    return { category, count: inCategory.length, pointsLost };
  });

  const worst = Math.max(...rows.map((row) => row.pointsLost), 0);

  if (!analysed) {
    return (
      <p className="text-sm text-foreground-muted">
        Rien à répartir tant qu&rsquo;aucune analyse n&rsquo;a tourné sur ce concurrent.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <li key={row.category}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-foreground">{CATEGORY_LABEL[row.category]}</span>
            <span className="font-mono text-sm text-foreground-muted">
              {row.pointsLost === 0 ? "0" : `−${row.pointsLost}`} pt
              {row.pointsLost > 1 ? "s" : ""}
            </span>
          </div>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-void">
            {row.pointsLost > 0 && (
              <span
                className="meter-fill block h-full rounded-full bg-gradient-to-r from-signal to-signal-bright"
                style={{ width: `${worst === 0 ? 0 : (row.pointsLost / worst) * 100}%` }}
              />
            )}
          </div>

          <p className="mt-1.5 text-xs text-foreground-muted/70">
            {row.count === 0
              ? "Aucun écart ouvert"
              : `${row.count} écart${row.count > 1 ? "s" : ""} ouvert${row.count > 1 ? "s" : ""}`}
          </p>
        </li>
      ))}
    </ul>
  );
}
