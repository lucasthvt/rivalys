export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-[#2A362F] px-6 py-14 text-center">
      <span aria-hidden className="mb-1 h-px w-10 bg-[#2A362F]" />
      <p className="text-sm font-medium text-[#EDF2EE]">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-[#8CA093]">{description}</p>
      )}
    </div>
  );
}
