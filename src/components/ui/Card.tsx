import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "./utils";

export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  /** Adds hover lift + pointer cursor for cards that act as links/buttons. */
  interactive?: boolean;
}

const paddingStyles: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { padding = "md", interactive = false, className, children, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cx(
        "rounded-2xl border border-surface-border bg-surface text-foreground",
        "shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
        interactive &&
          "cursor-pointer transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-signal-sm",
        paddingStyles[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("mb-4 flex items-start justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cx("font-display text-lg font-semibold leading-snug text-foreground", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx("text-sm leading-relaxed text-foreground-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("text-sm text-foreground", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx("mt-4 flex items-center gap-3 border-t border-surface-border pt-4", className)}
      {...props}
    />
  );
}
