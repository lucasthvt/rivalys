import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { buttonVariants } from "@/components/ui/Button";

type BigFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

/** Large underline text input — the primary answer control for a wizard step. */
export function BigField({ label, id, className, ...inputProps }: BigFieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="[font-family:var(--font-mono-auth)] text-[11px] font-medium uppercase tracking-[0.16em] text-[#6B7A6C]">
        {label}
      </span>
      <input
        id={id}
        className={`mt-3 w-full border-0 border-b-2 border-[#DAD6C7] bg-transparent px-0 py-3 text-xl text-[#1F2A22] outline-none transition-colors placeholder:text-[#A9B0A2] focus:border-[#B8791A] sm:text-2xl ${className ?? ""}`}
        {...inputProps}
      />
    </label>
  );
}

type BigTextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

export function BigTextArea({ label, id, className, ...textareaProps }: BigTextAreaProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="[font-family:var(--font-mono-auth)] text-[11px] font-medium uppercase tracking-[0.16em] text-[#6B7A6C]">
        {label}
      </span>
      <textarea
        id={id}
        rows={2}
        className={`mt-3 w-full resize-none border-0 border-b-2 border-[#DAD6C7] bg-transparent px-0 py-3 text-xl leading-snug text-[#1F2A22] outline-none transition-colors placeholder:text-[#A9B0A2] focus:border-[#B8791A] sm:text-2xl ${className ?? ""}`}
        {...textareaProps}
      />
    </label>
  );
}

export function SuggestionChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
        active
          ? "border-[#B8791A] bg-[#F3E3C8] text-[#8A5A13]"
          : "border-[#DAD6C7] text-[#46524A] hover:border-[#B8791A]"
      }`}
    >
      {label}
    </button>
  );
}

export function ChoiceCard({
  title,
  description,
  active,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-2xl border px-6 py-8 text-left transition-colors ${
        active
          ? "border-[#B8791A] bg-[#F3E3C8]/60"
          : "border-[#DAD6C7] hover:border-[#1F2A22]/40"
      }`}
    >
      <span
        className={`[font-family:var(--font-display-auth)] text-2xl ${active ? "text-[#8A5A13]" : "text-[#1F2A22]"}`}
      >
        {title}
      </span>
      <p className="mt-2 text-sm text-[#46524A]">{description}</p>
    </button>
  );
}

/**
 * Design-system primary button (see @/components/ui/Button), reused here
 * instead of a hardcoded hex-brass button so the wizard's CTA stays in
 * sync with the shared CTA styling.
 */
export const wizardPrimaryButton = buttonVariants({ variant: "primary", size: "md" });

export const wizardGhostButton =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-[#46524A] transition-colors hover:text-[#1F2A22] disabled:cursor-not-allowed disabled:opacity-40";

export const wizardErrorBox =
  "border-l-2 border-[#A5402E] bg-[#A5402E]/[0.06] px-4 py-3 text-sm text-[#7A2E20]";

export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}
