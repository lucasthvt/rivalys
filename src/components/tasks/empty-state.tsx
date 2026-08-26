export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-surface-border px-6 py-14 text-center">
      <span aria-hidden className="mb-1 h-px w-10 bg-surface-border" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-foreground-muted">{description}</p>
      )}
    </div>
  );
}
