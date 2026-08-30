import type { Metadata } from "next";
import { Golos_Text, IBM_Plex_Mono } from "next/font/google";
import { Nav } from "@/components/layout/Nav";
import "./globals.css";

/**
 * Une seule famille pour le titrage et le texte courant : Golos Text. Ses formes larges et
 * ses contreformes ouvertes tiennent aussi bien à 80 px en gras serré qu'à 14 px en
 * paragraphe, ce qui rend une seconde famille inutile — et deux familles qui se
 * ressemblent sans se compléter ajoutent du poids de chargement pour rien.
 *
 * --font-display, --font-sans et --font-brand pointent tous ici (voir globals.css).
 */
const golosText = Golos_Text({
  variable: "--font-golos",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

/**
 * La voix des annotations : cotes, catégories, valeurs relevées. Conservée en monospace
 * parce que la direction visuelle du produit est le dessin coté — c'est ce qui distingue
 * une mesure d'un titre, et la seule famille de l'écran qui ne soit pas Golos.
 */
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const SITE_NAME = "Rivalys";
const TAGLINE = "Vois où tu perds du terrain face à ton concurrent";
const DESCRIPTION =
  "Rivalys compare ton SaaS à ton plus gros concurrent sur des données publiques factuelles — tarifs, avis, positionnement — et transforme chaque écart en action concrète à mener.";

/**
 * `metadataBase` résout les URL relatives des images de partage et des liens canoniques.
 * Sans elle, Next émet des chemins relatifs qu'aucun réseau social ne sait suivre, et
 * l'aperçu partagé reste vide. La variable d'environnement fait foi ; le domaine sert de
 * repli pour que la génération locale ne casse pas.
 */
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://rivalys.com";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `${SITE_NAME} — ${TAGLINE}`,
    // Les pages qui posent leur propre titre héritent du suffixe de marque.
    template: `%s — ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  keywords: [
    "veille concurrentielle",
    "comparateur SaaS",
    "analyse concurrent",
    "positionnement tarifaire",
    "SaaS",
  ],
  authors: [{ name: SITE_NAME, url: APP_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  // Aperçu de partage : sans openGraph, un lien collé dans Slack, LinkedIn ou iMessage
  // n'affiche qu'une URL nue. L'image est générée par src/app/opengraph-image.tsx.
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: APP_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  // Le produit ne s'adresse pas aux moteurs de recherche pour ses écrans applicatifs :
  // ceux-là sont marqués noindex par le proxy (voir src/proxy.ts).
  category: "technology",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${golosText.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <Nav />
        {/*
          min-h-0 stops this flex child from being forced to its content's
          intrinsic min-height, so it actually shrinks to "viewport minus
          Nav" instead of always growing to at least 100vh on top of that.
          Routes that hide Nav (see Nav.tsx's HIDE_NAV_PREFIXES — /login,
          /signup, /onboarding, /dashboard, /tasks) have no sibling above
          this wrapper, so it correctly fills the full viewport height for
          them; those pages should use `min-h-full`/`flex-1`, never their
          own `min-h-screen`, to inherit that height instead of double-
          counting it.
        */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
