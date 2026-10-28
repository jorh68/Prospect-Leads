import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line bg-surface px-4 py-4 sm:flex-row sm:items-end sm:justify-between md:px-6">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs text-ink-3">{eyebrow}</div>}
        <h1 className="truncate text-lg font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Standard page body spacing. */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="space-y-4 px-4 py-4 md:px-6 md:py-5">{children}</div>;
}
