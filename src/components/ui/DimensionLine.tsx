/**
 * La ligne de cote — l'objet signature du produit.
 *
 * Vocabulaire emprunté au dessin technique : deux ticks aux extrémités, un trait, et la
 * valeur de l'écart annotée au milieu. C'est exactement ce que fait Rivalys — mesurer une
 * distance entre deux relevés — et c'est pour ça que la landing en a fait son élément de
 * hero. Le tableau de bord l'utilise désormais aussi, sur des valeurs réelles cette fois.
 *
 * `measured` distingue les deux états, et la distinction porte tout le sens : un écart
 * mesuré (ticks, trait plein, valeur en accent) et deux valeurs alignées (trait pointillé
 * effacé, pas de tick). Sans elle, chaque ligne ressemblerait à un problème — or le
 * produit doit pouvoir dire « ici, rien à rattraper » sans que ça se lise comme un échec.
 */
export function DimensionLine({
  measured,
  className = "h-2.5 w-full",
}: {
  measured: boolean;
  className?: string;
}) {
  const stroke = measured ? "var(--color-signal-bright)" : "var(--color-mist)";
  return (
    <svg
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      {measured && (
        <>
          <line
            x1="1"
            y1="1"
            x2="1"
            y2="9"
            stroke={stroke}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="99"
            y1="1"
            x2="99"
            y2="9"
            stroke={stroke}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
      <line
        x1="1"
        y1="5"
        x2="99"
        y2="5"
        stroke={stroke}
        strokeWidth="1"
        strokeOpacity={measured ? 0.9 : 0.3}
        strokeDasharray={measured ? undefined : "3 4"}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
