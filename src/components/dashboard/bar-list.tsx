import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

export interface BarItem {
  key: string;
  label: string;
  value: number;
  /** Secondary text after the value, e.g. "40 %" or "3 de impacto alto" */
  detail?: string;
  href?: string;
}

/**
 * Ranked horizontal bars: label above, a thin bar scaled to the largest
 * value, and the value as text. One series, so no legend; the panel title
 * names what is measured.
 */
export function BarList({ items, max, unit }: { items: BarItem[]; max?: number; unit: string }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2.5 px-4 py-3">
      {items.map((item) => {
        const pct = top > 0 ? Math.max(item.value > 0 ? 2 : 0, (item.value / top) * 100) : 0;
        const title = `${item.label}: ${formatNumber(item.value)} ${unit}${item.detail ? ` · ${item.detail}` : ""}`;
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate text-ink-2 group-hover:text-ink">{item.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-ink-3">
                <span className="font-medium text-ink">{formatNumber(item.value)}</span>
                {item.detail && <span> · {item.detail}</span>}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-subtle" aria-hidden>
              <div className={cn("h-full rounded-full bg-accent-600 group-hover:bg-accent-700")} style={{ width: `${pct}%` }} />
            </div>
          </>
        );
        return (
          <li key={item.key} title={title}>
            {item.href ? (
              <Link href={item.href} className="group block rounded-sm focus-visible:outline-offset-4">
                {content}
              </Link>
            ) : (
              <div className="group">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
