import Link from "next/link";
import { EmptyState } from "@/components/tasks/empty-state";

/**
 * Shown on every app screen that has nothing to say until a competitor is
 * tracked. The comparator has no second side without one, so these screens
 * would otherwise read as "no gaps, score at 100" — technically true, but it
 * would let the user believe an analysis ran and found nothing.
 */
export function NoCompetitorState({ description }: { description: string }) {
  return (
    <EmptyState
      title="Aucun concurrent suivi"
      description={description}
      action={
        <Link
          href="/concurrent"
          className="font-mono inline-block border border-accent bg-accent px-5 py-2.5 text-[11px] uppercase tracking-[0.14em] text-accent-foreground transition-colors hover:border-accent-strong hover:bg-accent-strong"
        >
          Ajouter un concurrent
        </Link>
      }
    />
  );
}
