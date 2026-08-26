import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "./utils";

/**
 * Priority/status vocabulary mirrors `detected_gaps` (priority, status) from
 * the schema. Deliberately not a red/yellow/green stoplight — Rivalys frames
 * gaps as opportunities, not alarms, so tones are drawn from the terrain
 * palette (clay/brass/sage/teal/slate) instead.
 */
export type BadgeVariant =
  | "priority-high"
  | "priority-medium"
  | "priority-low"
  | "status-open"
  | "status-done"
  | "status-dismissed"
  | "neutral"
  | "brand";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
  /** Leading color dot instead of/alongside an icon. */
  dot?: boolean;
  icon?: ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  "priority-high": "bg-clay-500/20 text-clay-100",
  "priority-medium": "bg-brass-500/20 text-brass-100",
  "priority-low": "bg-sage-500/20 text-sage-100",
  "status-open": "border border-surface-border bg-transparent text-foreground-muted",
  "status-done": "bg-teal-500/20 text-teal-100",
  "status-dismissed": "bg-slate-500/15 text-slate-100",
  neutral: "bg-white/10 text-stone-100",
  brand: "bg-accent text-accent-foreground",
};

const dotStyles: Record<BadgeVariant, string> = {
  "priority-high": "bg-clay-500",
  "priority-medium": "bg-brass-500",
  "priority-low": "bg-sage-500",
  "status-open": "bg-stone-400",
  "status-done": "bg-teal-500",
  "status-dismissed": "bg-slate-500",
  neutral: "bg-stone-400",
  brand: "bg-paper",
};

const sizeStyles: Record<"sm" | "md", string> = {
  sm: "px-2 py-0.5 text-[0.7rem] gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = "neutral", size = "sm", dot = false, icon, className, children, ...props },
  ref
) {
  return (
    <span
      ref={ref}
      className={cx(
        "inline-flex items-center rounded-full font-mono font-medium uppercase tracking-wide",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cx("h-1.5 w-1.5 shrink-0 rounded-full", dotStyles[variant])}
        />
      )}
      {icon}
      {children}
    </span>
  );
});
