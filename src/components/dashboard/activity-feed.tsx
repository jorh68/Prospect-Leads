import Link from "next/link";
import { formatDateTime, formatRelative } from "@/lib/format";

export interface FeedItem {
  id: string;
  message: string;
  createdAt: Date;
  company: { id: string; name: string } | null;
  search: { id: string; query: string } | null;
}

export function ActivityFeed({ items }: { items: FeedItem[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-2 text-[13px]">
          <span className="min-w-0 text-ink-2">
            {a.company ? (
              <>
                <Link href={`/companies/${a.company.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                  {a.company.name}
                </Link>
                <span className="text-ink-4"> · </span>
              </>
            ) : a.search ? (
              <>
                <Link href={`/searches/${a.search.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                  {a.search.query}
                </Link>
                <span className="text-ink-4"> · </span>
              </>
            ) : null}
            {a.message}
          </span>
          <time dateTime={a.createdAt.toISOString()} title={formatDateTime(a.createdAt)} className="shrink-0 text-xs text-ink-4">
            {formatRelative(a.createdAt)}
          </time>
        </li>
      ))}
    </ul>
  );
}
