import { ImageResponse } from "next/og";

/**
 * Icône pour l'écran d'accueil iOS.
 *
 * Safari ignore les icônes SVG pour « Ajouter à l'écran d'accueil » : sans PNG dédié, il
 * fabrique une vignette à partir d'une capture de la page, illisible à 60 px. Elle est
 * générée ici plutôt que stockée en binaire, pour rester alignée sur `icon.svg` sans avoir
 * deux fichiers à maintenir à la main.
 *
 * Pas de coins arrondis : iOS applique son propre masque, et en ajouter donnerait un
 * liseré sombre sur le bord.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const VOID_RAISED = "#101319";
const SIGNAL_BRIGHT = "#6c90ff";

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: VOID_RAISED,
        }}
      >
        <svg width="128" height="128" viewBox="0 0 24 24" fill="none">
          <rect x="14" y="3.5" width="6" height="17" rx="1.8" fill={SIGNAL_BRIGHT} opacity="0.42" />
          <rect x="4" y="11.5" width="6" height="9" rx="1.8" fill={SIGNAL_BRIGHT} />
          <rect
            x="4.75"
            y="4.25"
            width="4.5"
            height="5"
            rx="1.05"
            stroke={SIGNAL_BRIGHT}
            strokeWidth="1.5"
            strokeDasharray="2.2 1.8"
            opacity="0.85"
          />
        </svg>
      </div>
    ),
    size,
  );
}
