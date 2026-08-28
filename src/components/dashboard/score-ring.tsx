import { MAX_SCORE } from "@/lib/compare/score";

/**
 * Le score en anneau : la lecture d'un coup d'œil, avant le détail du calcul.
 *
 * Une seule teinte en dégradé, du signal sourd au signal clair — jamais un
 * dégradé rouge→vert. Un arc tricolore transformerait une mesure d'écarts
 * ouverts en jugement de valeur, et le produit ne classe pas le fondateur.
 *
 * `score` à null = jamais analysé. L'anneau reste alors vide et affiche « — » :
 * un anneau à zéro se lirait comme un score de zéro, ce qui est une mesure, pas
 * une absence de mesure.
 */
export function ScoreRing({
  score,
  delta,
  size = 168,
}: {
  score: number | null;
  /** Écart avec l'analyse précédente. Null quand il n'y en a pas encore deux. */
  delta: number | null;
  size?: number;
}) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // L'anneau est ouvert en bas (270° utilisés sur 360°) : la coupure donne un
  // point de départ et un point d'arrivée lisibles, là où un cercle fermé ne
  // dit pas où commence l'échelle.
  const arcFraction = 0.75;
  const arcLength = circumference * arcFraction;
  const filled = score === null ? 0 : (score / MAX_SCORE) * arcLength;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={
          score === null
            ? "Score pas encore calculé."
            : `Score de ${score} sur ${MAX_SCORE}.`
        }
        // Rotation : l'arc démarre en bas à gauche plutôt qu'à 3 h.
        className="-rotate-[225deg]"
      >
        <defs>
          <linearGradient id="score-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-signal)" />
            <stop offset="100%" stopColor="var(--color-signal-bright)" />
          </linearGradient>
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-void)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
        />

        {score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#score-ring-gradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[46px] leading-none tracking-tight text-foreground">
          {score === null ? "—" : score}
        </span>
        <span className="font-mono mt-1 text-[11px] uppercase tracking-[0.16em] text-foreground-muted/70">
          / {MAX_SCORE}
        </span>
        {delta !== null && (
          <span
            className={`font-mono mt-2 text-xs ${
              delta > 0 ? "text-mint" : delta < 0 ? "text-flare" : "text-foreground-muted"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta} pt{Math.abs(delta) > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
