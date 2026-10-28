import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Compact KPI: label, value and an optional context line. */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-3", className)}>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}
