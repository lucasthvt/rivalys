import type { ReactNode } from "react";
import { authFontVariables } from "../onboarding/_shared/fonts";

// Font loading is centralized in ../onboarding/_shared/fonts.ts and shared
// with /signup and /onboarding — see that file for why the variable names
// are namespaced (`-auth` suffix) instead of reusing the design system's
// global `--font-display` token.
export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${authFontVariables} flex flex-1 flex-col [font-family:var(--font-body)]`}
    >
      {children}
    </div>
  );
}
