import type { ReactNode } from "react";
import { PROVIDER_LABELS, type Provider } from "@/lib/domain/constants";
import { cn } from "@/lib/cn";

/** Definition list used across the company page: label, value, provenance. */
export function InfoList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn("divide-y divide-line", className)}>{children}</dl>;
}

export function InfoRow({
  label,
  value,
  source,
  empty = "No disponible",
}: {
  label: string;
  value: ReactNode;
  /** Provider key from Company.fieldSources */
  source?: string;
  empty?: string;
}) {
  const has = value != null && value !== "";
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-4 py-2 text-[13px]">
      <dt className="text-ink-3">{label}</dt>
      <dd className="min-w-0">
        <span className={cn("block break-words", has ? "text-ink" : "text-ink-4")}>{has ? value : empty}</span>
        {source && has && (
          <span className="mt-0.5 block text-2xs text-ink-4" title="Fuente del dato">
            Fuente: {PROVIDER_LABELS[source as Provider] ?? source}
          </span>
        )}
      </dd>
    </div>
  );
}

export function ExternalA({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:underline">
      {children}
    </a>
  );
}
