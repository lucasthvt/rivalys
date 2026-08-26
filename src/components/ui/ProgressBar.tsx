import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "./utils";

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** 0-100. Ignored when `step` + `totalSteps` are both provided. */
  value?: number;
  max?: number;
  /** 1-indexed current step, e.g. the onboarding screen number. */
  step?: number;
  totalSteps?: number;
  /** "steps" renders discrete waypoint segments — the default once step/totalSteps are set. */
  variant?: "bar" | "steps";
  label?: string;
  /** Shows a small caption ("Étape 2 sur 5") below the indicator. */
  showLabel?: boolean;
}

export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(function ProgressBar(
  {
    value = 0,
    max = 100,
    step,
    totalSteps,
    variant,
    label,
    showLabel = false,
    className,
    ...rest
  },
  ref
) {
  const hasSteps = typeof step === "number" && typeof totalSteps === "number" && totalSteps > 0;
  const resolvedVariant = variant ?? (hasSteps ? "steps" : "bar");
  const percent = hasSteps
    ? Math.min(100, Math.max(0, (step! / totalSteps!) * 100))
    : Math.min(100, Math.max(0, (value / max) * 100));

  const accessibleLabel =
    label ?? (hasSteps ? `Étape ${step} sur ${totalSteps}` : `${Math.round(percent)}%`);

  if (resolvedVariant === "steps" && hasSteps) {
    return (
      <div ref={ref} className={cx("w-full", className)} {...rest}>
        <div
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-label={accessibleLabel}
          className="flex gap-1.5"
        >
          {Array.from({ length: totalSteps as number }).map((_, i) => (
            <span
              key={i}
              className={cx(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                i < (step as number) ? "bg-accent" : "bg-surface-border"
              )}
            />
          ))}
        </div>
        {showLabel && (
          <p className="mt-2 font-mono text-xs uppercase tracking-wide text-foreground-muted">
            {accessibleLabel}
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className={cx("w-full", className)} {...rest}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={accessibleLabel}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-border"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <p className="mt-2 font-mono text-xs uppercase tracking-wide text-foreground-muted">
          {accessibleLabel}
        </p>
      )}
    </div>
  );
});
