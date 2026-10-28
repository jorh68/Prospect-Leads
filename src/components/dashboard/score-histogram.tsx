import Link from "next/link";
import type { ScoreBin } from "@/lib/crm/stats";
import { cn } from "@/lib/cn";

/**
 * Vertical histogram of heuristic scores in ten 10-point bins. Bins at or
 * above the priority threshold use the full accent; the rest a light tint.
 * Each bar links to the companies in that range.
 */
export function ScoreHistogram({ bins, priorityFrom }: { bins: ScoreBin[]; priorityFrom: number }) {
  const max = Math.max(1, ...bins.map((b) => b.count));
  return (
    <div className="px-4 pt-4 pb-3">
      <div className="flex h-44 items-end gap-[2px]" role="list" aria-label="Empresas por tramo de puntuación">
        {bins.map((b) => {
          const priority = b.from >= priorityFrom;
          const h = b.count === 0 ? 0 : Math.max(3, (b.count / max) * 86);
          return (
            <Link
              key={b.from}
              role="listitem"
              href={`/companies?scoreMin=${b.from}&scoreMax=${b.to}`}
              title={`${b.from}–${b.to}: ${b.count} ${b.count === 1 ? "empresa" : "empresas"}`}
              aria-label={`${b.from} a ${b.to}: ${b.count} empresas`}
              className="group relative flex h-full flex-1 flex-col justify-end"
            >
              {b.count > 0 && (
                <span className="mb-0.5 text-center text-2xs tabular-nums text-ink-3 group-hover:text-ink">{b.count}</span>
              )}
              <span
                className={cn(
                  "block w-full rounded-t-[4px]",
                  priority ? "bg-accent-600 group-hover:bg-accent-700" : "bg-accent-200 group-hover:bg-accent-500",
                )}
                style={{ height: `${h}%` }}
              />
            </Link>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[2px] border-t border-line-strong pt-1" aria-hidden>
        {bins.map((b) => (
          <span key={b.from} className="flex-1 text-center text-2xs tabular-nums text-ink-4">
            {b.from}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-accent-600" aria-hidden />
          Prioritarias (≥ {priorityFrom})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-accent-200" aria-hidden />
          Resto
        </span>
      </div>
    </div>
  );
}
