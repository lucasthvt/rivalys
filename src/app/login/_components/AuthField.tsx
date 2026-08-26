import type { InputHTMLAttributes } from "react";
import { buttonVariants } from "@/components/ui/Button";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

/** Underline-style text field shared by /login and /signup. */
export function AuthField({ label, id, className, ...inputProps }: AuthFieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="[font-family:var(--font-mono-auth)] text-[11px] font-medium uppercase tracking-[0.16em] text-[#6B7A6C]">
        {label}
      </span>
      <input
        id={id}
        className={`mt-2 w-full border-0 border-b border-[#DAD6C7] bg-transparent px-0 py-2 text-base text-[#1F2A22] outline-none transition-colors placeholder:text-[#A9B0A2] focus:border-[#B8791A] ${className ?? ""}`}
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

export const authErrorBox =
  "border-l-2 border-[#A5402E] bg-[#A5402E]/[0.06] px-4 py-3 text-sm text-[#7A2E20]";

export const authInfoBox =
  "border-l-2 border-[#2F5D45] bg-[#2F5D45]/[0.06] px-4 py-3 text-sm text-[#234A37]";
