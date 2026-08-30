import { ImageResponse } from "next/og";

/**
 * Image d'aperçu, générée à la demande.
 *
 * Un lien collé dans Slack, LinkedIn, iMessage ou X n'affiche qu'une URL nue sans elle.
 * C'est le seul visuel du produit que verront des gens qui n'ont pas encore cliqué.
 *
 * Générée par du code plutôt que dessinée dans un fichier : le jour où la promesse change,
 * c'est une chaîne de caractères à modifier, pas un export à refaire. Et rien à stocker.
 *
 * Aucune police n'est chargée à distance. Une image d'aperçu qui échoue vaut moins qu'une
 * image d'aperçu au dessin générique, et une dépendance réseau au moment du rendu est
 * exactement le genre de chose qui casse un vendredi. La marque tient ici par la couleur,
 * la composition et le glyphe.
 */

export const alt = "Rivalys — Vois où tu perds du terrain face à ton concurrent";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Repris de globals.css. Dupliqués parce que ImageResponse ne lit ni Tailwind ni les
// variables CSS du document — il rend hors du navigateur.
const VOID = "#000000";
const PAPER = "#fafafa";
const MIST = "#a2a2ae";
const SIGNAL = "#6247e6";
const SIGNAL_BRIGHT = "#a394ff";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: VOID,
          padding: "72px 80px",
          position: "relative",
        }}
      >
        {/* La lueur du hero, reprise pour que l'aperçu et la page se ressemblent. */}
        <div
          style={{
            position: "absolute",
            top: -320,
            left: 300,
            width: 900,
            height: 620,
            borderRadius: 9999,
            background: SIGNAL,
            opacity: 0.22,
            filter: "blur(150px)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <BrandMark />
          <span
            style={{
              color: PAPER,
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            Rivalys
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              color: PAPER,
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            }}
          >
            <span>Vois où tu perds</span>
            <span>
              du terrain
              <span style={{ color: SIGNAL_BRIGHT }}>.</span>
            </span>
          </div>
          <div
            style={{
              marginTop: 26,
              color: MIST,
              fontSize: 30,
              lineHeight: 1.35,
              maxWidth: 760,
              display: "flex",
            }}
          >
            Chaque écart avec ton concurrent, relevé sur des données publiques et transformé
            en action précise.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            color: MIST,
            fontSize: 21,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Deux URL suffisent · aucune donnée privée · aucun crawl autonome
        </div>
      </div>
    ),
    size,
  );
}

/**
 * Le glyphe de marque, redessiné ici plutôt qu'importé de components/brand/Logo.
 * Ce composant-là est un composant React du navigateur ; ImageResponse rend hors DOM et
 * n'accepte qu'un sous-ensemble de SVG. Les deux doivent rester visuellement identiques.
 */
function BrandMark() {
  return (
    <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
      {/* Le concurrent : le niveau à rejoindre. */}
      <rect x="14" y="3.5" width="6" height="17" rx="1.8" fill={SIGNAL_BRIGHT} opacity="0.42" />
      {/* Toi : le terrain tenu. */}
      <rect x="4" y="11.5" width="6" height="9" rx="1.8" fill={SIGNAL_BRIGHT} />
      {/* L'écart, ce que le produit mesure. */}
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
  );
}
