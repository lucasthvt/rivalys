import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Bricolage_Grotesque } from "next/font/google";
import { Nav } from "@/components/layout/Nav";
import "./globals.css";

// The single display face for the whole app — see globals.css § Signal
// palette. --font-display (used by Card/Button/every heading) and
// --font-brand (the Nav/landing wordmark) both point at this.
const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rivalys — Vois où tu perds du terrain face à ton concurrent",
  description:
    "Rivalys compare ton SaaS à ton plus gros concurrent sur des données publiques factuelles — pricing, avis, positionnement — et transforme chaque écart en action concrète à mener.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${inter.variable} ${plexMono.variable} ${bricolageGrotesque.variable} h-full antialiased`}
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
