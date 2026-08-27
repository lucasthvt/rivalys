import Link from "next/link";
import { PRIORITY_LABEL } from "@/components/tasks/priority";
import { explainScore, MAX_SCORE, type GapPriorityCounts } from "@/lib/compare/score";

/**
 * L'élément principal du tableau de bord : le score lu comme un relevé, pas comme une note.
 *
 * Le calcul étant déterministe (100 moins une pénalité par écart ouvert), la barre montre
 * toute l'échelle : la part tenue en plein, et chaque tranche de points perdue en hachures,
 * étiquetée par la priorité qui l'a coûtée. Le chiffre, sa justification et l'action à mener
 * tiennent ainsi dans un seul objet, au lieu d'un nombre opaque suivi d'un lien « en savoir
 * plus ».
 *
 * Les segments perdus utilisent une seule teinte à intensité décroissante, jamais trois
 * couleurs distinctes : les priorités sont une force de signal, pas un feu tricolore.
 */
export function ScoreMeter({
  counts,
  analysed,
  scoreFromHistory,
}: {
  counts: GapPriorityCounts;
  /**
   * Le concurrent actuellement suivi a-t-il déjà été analysé au moins une fois ?
   *
   * C'est la seule condition d'existence d'un score, et elle ne se déduit PAS du nombre
   * d'écarts : zéro écart ouvert veut dire « rien à rattraper » après une analyse, mais
   * « rien n'a été mesuré » avant. Afficher 100 dans le second cas annoncerait un sans-faute
   * qui n'a jamais été constaté — c'est la même distinction que null vs [] pour les
   * plateformes observées (voir site-data.ts).
   *
   * Se déduit de l'existence d'un relevé pour CE concurrent, jamais de score_history, dont
   * les points peuvent décrire un concurrent précédent.
   */
  analysed: boolean;
  /**
   * Dernier score enregistré. Sert uniquement à signaler une divergence avec le calcul en
   * direct — voir plus bas. Null tant qu'aucune analyse n'a tourné.
   */
  scoreFromHistory: number | null;
}) {
  const breakdown = explainScore(counts);
  const hasRun = analysed;

  // Part réellement occupée par les pénalités, une fois ramenée à l'échelle. Sans cet
  // écrêtage, un total de pénalités supérieur à 100 produirait des segments dont la somme
  // dépasse la largeur de la barre.
  const scale = breakdown.totalLost > MAX_SCORE ? MAX_SCORE / breakdown.totalLost : 1;

  const lostSegments = breakdown.lines
    .filter((line) => line.pointsLost > 0)
    .map((line) => ({
      ...line,
      widthPercent: line.pointsLost * scale,
    }));

  // Une seule teinte à trois intensités, jamais trois couleurs : la priorité est une force
  // de signal, pas un feu tricolore (contrainte CLAUDE.md). Les paliers sont écartés
  // franchement — 80/45/22 plutôt que 70/40/20 — pour rester distinguables sur les segments
  // étroits d'une pénalité faible.
  const intensityByPriority = {
    high: "bg-signal-bright/80",
    medium: "bg-signal-bright/45",
    low: "bg-signal-bright/22",
  } as const;

  return (
    <section
      aria-labelledby="score-meter-title"
      className="border border-surface-border bg-surface px-5 py-7 sm:px-8 sm:py-9"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            id="score-meter-title"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground-muted/70"
          >
            Terrain tenu
          </h2>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-[68px] leading-none tracking-tight text-foreground sm:text-[80px]">
              {hasRun ? breakdown.score : "—"}
            </span>
            <span className="font-mono text-sm text-foreground-muted">/ {MAX_SCORE}</span>
          </p>
        </div>

        <Link
          href="/score"
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent-strong transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Le calcul détaillé →
        </Link>
      </div>

      <div
        className="mt-7 flex h-5 w-full overflow-hidden rounded-full bg-void"
        role="img"
        aria-label={
          hasRun
            ? `Score de ${breakdown.score} sur ${MAX_SCORE}. ${breakdown.totalLost} points retirés par les écarts ouverts.`
            : "Score pas encore calculé."
        }
      >
        {hasRun && (
          <>
            <span
              className="meter-fill h-full bg-gradient-to-r from-signal to-signal-bright shadow-signal-sm"
              style={{ width: `${breakdown.score}%` }}
            />
            {lostSegments.map((segment) => (
              <span
                key={segment.priority}
                // min-width : une pénalité basse vaut 2 points, soit 2 % de la barre — une
                // dizaine de pixels où ni les hachures ni l'intensité ne se lisent. Le plancher
                // garde le segment identifiable ; la valeur exacte est dans la légende juste
                // en dessous, donc rien n'est faussé par cet arrondi visuel.
                className={`meter-hatch h-full min-w-[14px] border-l-2 border-void ${intensityByPriority[segment.priority]}`}
                style={{ width: `${segment.widthPercent}%` }}
              />
            ))}
          </>
        )}
      </div>

      {!hasRun ? (
        <p className="mt-4 text-sm text-foreground-muted">
          Ce concurrent n&rsquo;a pas encore été analysé. Lance une analyse pour obtenir un
          score.
        </p>
      ) : lostSegments.length === 0 ? (
        <p className="mt-4 text-sm text-foreground-muted">
          Aucun écart ouvert. Le score baissera si une prochaine analyse en détecte un.
        </p>
      ) : (
        <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {lostSegments.map((segment) => (
            <li key={segment.priority} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden="true"
                className={`meter-hatch h-3 w-3 shrink-0 rounded-sm ${intensityByPriority[segment.priority]}`}
              />
              <span className="text-foreground-muted">
                {segment.count} écart{segment.count > 1 ? "s" : ""} en priorité{" "}
                {PRIORITY_LABEL[segment.priority].toLowerCase()}
              </span>
              <span className="font-mono text-foreground">−{segment.pointsLost}</span>
            </li>
          ))}
        </ul>
      )}

      {breakdown.clamped && (
        <p className="mt-4 text-sm leading-relaxed text-foreground-muted">
          Les pénalités dépassent les {MAX_SCORE} points disponibles, le score reste donc à 0.
          Commence par les écarts en priorité haute, ce sont eux qui pèsent le plus.
        </p>
      )}

      {/*
        Le score affiché est recalculé ici à partir des écarts actuellement ouverts, alors
        que score_history garde celui du dernier passage du comparateur. Fermer une tâche
        fait donc bouger ce chiffre sans nouvelle analyse — c'est voulu, l'utilisateur doit
        voir l'effet de son action tout de suite. On le signale plutôt que de laisser croire
        à une incohérence entre cet écran et la courbe d'évolution.
      */}
      {hasRun && scoreFromHistory !== breakdown.score && (
        <p className="mt-4 border-t border-surface-border pt-4 text-xs leading-relaxed text-foreground-muted/70">
          Dernière analyse enregistrée à {scoreFromHistory}. L&rsquo;écart avec le score
          ci-dessus vient des tâches que tu as fermées depuis — la courbe se mettra à jour à la
          prochaine analyse.
        </p>
      )}
    </section>
  );
}
