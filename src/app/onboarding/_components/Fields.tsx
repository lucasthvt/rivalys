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
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-foreground-muted">
        {label}
      </span>
      <input
        id={id}
        className={`mt-3 w-full border-0 border-b-2 border-surface-border bg-transparent px-0 py-3 text-xl text-foreground outline-none transition-colors placeholder:text-foreground-muted/60 focus:border-accent sm:text-2xl ${className ?? ""}`}
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
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-foreground-muted">
        {label}
      </span>
      <textarea
        id={id}
        rows={2}
        className={`mt-3 w-full resize-none border-0 border-b-2 border-surface-border bg-transparent px-0 py-3 text-xl leading-snug text-foreground outline-none transition-colors placeholder:text-foreground-muted/60 focus:border-accent sm:text-2xl ${className ?? ""}`}
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
          ? "border-accent bg-accent/10 text-signal-bright"
          : "border-surface-border text-foreground-muted hover:border-accent"
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
          ? "border-accent bg-accent/10"
          : "border-surface-border hover:border-foreground/40"
      }`}
    >
      <span
        className={`font-display text-2xl ${active ? "text-signal-bright" : "text-foreground"}`}
      >
        {title}
      </span>
      <p className="mt-2 text-sm text-foreground-muted">{description}</p>
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
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

export const wizardErrorBox =
  "border-l-2 border-flare bg-flare/10 px-4 py-3 text-sm text-flare";

export function FieldGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-6">{children}</div>;
}
