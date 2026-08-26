import type { Metadata } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import { Nav } from "@/components/layout/Nav";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
      className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <Nav />
        {/*
          min-h-0 stops this flex child from being forced to its content's
          intrinsic min-height, so it actually shrinks to "viewport minus
          Nav" instead of always growing to at least 100vh on top of that.
          NOTE (coordination point — not fully fixed by this wrapper alone):
          this only controls the space this wrapper itself claims. A child
          page that sets `min-h-screen` on ITS OWN root container declares
          `min-height: 100vh` directly on that element, which this parent
          flex container cannot override — the child would still render at
          100vh *inside* an already-shorter parent, adding Nav's 64px
          (h-16) as extra scroll. /dashboard and /tasks currently do this.
          The real fix has to happen in those pages (owned by a different
          agent/scope): replace `min-h-screen` with `min-h-[calc(100vh-4rem)]`,
          or drop it entirely and let this flex-1 parent supply the height.
        */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
