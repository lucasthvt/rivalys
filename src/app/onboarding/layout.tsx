import type { ReactNode } from "react";
import { authFontVariables } from "./_shared/fonts";

// Font loading is centralized in ./_shared/fonts.ts and shared with /login
// and /signup — see that file for why the variable names are namespaced
// (`-auth` suffix) instead of reusing the design system's global
// `--font-display` token.
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${authFontVariables} flex flex-1 flex-col [font-family:var(--font-body)]`}
    >
      {children}
    </div>
  );
}
