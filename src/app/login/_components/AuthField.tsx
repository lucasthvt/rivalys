import type { InputHTMLAttributes } from "react";
import { buttonVariants } from "@/components/ui/Button";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

/** Underline-style text field shared by /login and /signup. */
export function AuthField({ label, id, className, ...inputProps }: AuthFieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-foreground-muted">
        {label}
      </span>
      <input
        id={id}
        className={`mt-2 w-full border-0 border-b border-surface-border bg-transparent px-0 py-2 text-base text-foreground outline-none transition-colors placeholder:text-foreground-muted/60 focus:border-accent ${className ?? ""}`}
        {...inputProps}
      />
    </label>
  );
}

/**
 * Design-system primary button (see @/components/ui/Button), reused here
 * instead of a hardcoded hex-brass button so /login and /signup stay in
 * sync with the shared CTA styling.
 */
export const authPrimaryButton = buttonVariants({ variant: "primary", size: "lg", fullWidth: true });

export const authErrorBox = "border-l-2 border-flare bg-flare/10 px-4 py-3 text-sm text-flare";

export const authInfoBox = "border-l-2 border-mint bg-mint/10 px-4 py-3 text-sm text-mint";
