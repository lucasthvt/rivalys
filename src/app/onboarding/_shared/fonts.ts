import { Fraunces, JetBrains_Mono, Public_Sans } from "next/font/google";

// Shared by the /login, /signup, and /onboarding layouts (all three loaded
// the exact same trio independently before this file existed — see git
// history on those layouts for the original triplication).
//
// The `--font-display-auth` / `--font-mono-auth` variable names are
// deliberately namespaced with an `-auth` suffix rather than reusing
// `--font-display` / `--font-mono-ui`: the design system's root layout
// (src/app/layout.tsx + globals.css) already defines a global
// `--font-display` token (Space Grotesk, via `@theme inline`). Since
// next/font attaches its CSS variable via a class on a wrapping element,
// redefining `--font-display` locally here would silently shadow the
// global token for every design-system component rendered under these
// three routes. `--font-mono-ui` doesn't collide with a global token
// today, but is namespaced too for consistency and to stay collision-proof
// if the design system adds one later.
export const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display-auth",
});

export const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono-auth",
});

/** Convenience string of all three next/font variable classes, for the layout wrapper. */
export const authFontVariables = `${fraunces.variable} ${publicSans.variable} ${jetBrainsMono.variable}`;
