import { cn } from "@/lib/cn";

export function ProgressBar({ value, className }: { value: number | null; className?: string }) {
  const pct = value == null ? null : Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-subtle", className)} role="progressbar" aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={cn("h-full rounded-full bg-accent-600 transition-[width]", pct == null && "w-1/3 animate-pulse")}
        style={pct != null ? { width: `${pct}%` } : undefined}
      />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
      aria-hidden
    />
  );
}
