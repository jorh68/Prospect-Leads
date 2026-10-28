"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { setCrmStatusAction } from "@/lib/crm/actions";
import { CRM_STATUSES, CRM_STATUS_LABELS, type CrmStatus } from "@/lib/domain/constants";
import { ScoreBadge } from "@/components/domain/badges";
import { cn } from "@/lib/cn";
import { FollowUpDate } from "./follow-up";

export interface BoardCard {
  id: string;
  name: string;
  city: string | null;
  niche: string | null;
  score: number | null;
  opportunityCount: number;
  owner: string | null;
  nextAction: string | null;
  followUpAt: string | null;
  crmStatus: string;
}

export interface BoardColumn {
  status: CrmStatus;
  count: number;
  cards: BoardCard[];
  /** Link to the full list when the column has more cards than shown */
  moreHref: string | null;
}

type Move = { id: string; to: CrmStatus };

function applyMove(columns: BoardColumn[], move: Move): BoardColumn[] {
  const card = columns.flatMap((c) => c.cards).find((c) => c.id === move.id);
  if (!card || card.crmStatus === move.to) return columns;
  return columns.map((col) => {
    if (col.status === card.crmStatus) return { ...col, count: col.count - 1, cards: col.cards.filter((c) => c.id !== move.id) };
    if (col.status === move.to) return { ...col, count: col.count + 1, cards: [{ ...card, crmStatus: move.to }, ...col.cards] };
    return col;
  });
}

function Card({ card, onMove, disabled }: { card: BoardCard; onMove: (to: CrmStatus) => void; disabled: boolean }) {
  return (
    <li
      draggable={!disabled}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", card.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group relative rounded-md border border-line bg-surface p-2.5 shadow-xs hover:border-line-strong [&[draggable=true]]:cursor-grab"
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/companies/${card.id}`} className="min-w-0 text-[13px] leading-5 font-medium text-ink hover:text-accent-700 hover:underline">
          {card.name}
        </Link>
        <ScoreBadge score={card.score} />
      </div>
      <p className="mt-0.5 truncate text-xs text-ink-3">
        {[card.niche, card.city].filter(Boolean).join(" · ") || "—"}
        {card.opportunityCount > 0 && ` · ${card.opportunityCount} oport.`}
      </p>
      {card.nextAction && <p className="mt-1.5 line-clamp-2 text-xs text-ink-2">{card.nextAction}</p>}
      {(card.followUpAt || card.owner) && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
          <FollowUpDate date={card.followUpAt} />
          {card.owner && <span className="truncate text-ink-3">{card.owner}</span>}
        </div>
      )}
      <label className="sr-only" htmlFor={`move-${card.id}`}>
        Mover {card.name} a
      </label>
      <select
        id={`move-${card.id}`}
        value={card.crmStatus}
        disabled={disabled}
        onChange={(e) => onMove(e.target.value as CrmStatus)}
        className="mt-2 h-6 w-full rounded-sm border border-line bg-subtle/60 px-1.5 text-2xs text-ink-2 focus:border-accent-500 focus:outline-none"
      >
        {CRM_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === card.crmStatus ? `Estado: ${CRM_STATUS_LABELS[s]}` : `Mover a ${CRM_STATUS_LABELS[s]}`}
          </option>
        ))}
      </select>
    </li>
  );
}

/**
 * Kanban board of the 9 CRM statuses. Cards move by drag and drop or with
 * the per-card select (keyboard and touch). Moves are optimistic and roll
 * back with an error message if the save fails.
 */
export function PipelineBoard({ columns }: { columns: BoardColumn[] }) {
  const [optimistic, move] = useOptimistic(columns, applyMove);
  const [pending, start] = useTransition();
  const [over, setOver] = useState<CrmStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doMove = (id: string, to: CrmStatus) => {
    setError(null);
    start(async () => {
      move({ id, to });
      const r = await setCrmStatusAction(id, to);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <div>
      {error && (
        <p className="mb-2 text-xs text-danger-600" role="alert">
          {error}
        </p>
      )}
      <div className="relative -mx-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
        <div className="grid auto-cols-[16rem] grid-flow-col gap-3">
          {optimistic.map((col) => (
            <section
              key={col.status}
              aria-label={CRM_STATUS_LABELS[col.status]}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== col.status) setOver(col.status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id) doMove(id, col.status);
              }}
              className={cn(
                "flex max-h-[calc(100dvh-15rem)] min-h-40 flex-col rounded-lg border border-line bg-subtle/60",
                over === col.status && "border-accent-500 bg-accent-50/60",
              )}
            >
              <header className="flex h-9 shrink-0 items-center justify-between border-b border-line px-3">
                <h3 className="text-xs font-semibold text-ink">{CRM_STATUS_LABELS[col.status]}</h3>
                <span className="text-xs tabular-nums text-ink-3">{col.count}</span>
              </header>
              <ul className="flex-1 space-y-2 overflow-y-auto p-2">
                {col.cards.length === 0 && <li className="px-1 py-3 text-center text-xs text-ink-4">Sin empresas</li>}
                {col.cards.map((card) => (
                  <Card key={card.id} card={card} disabled={pending} onMove={(to) => doMove(card.id, to)} />
                ))}
              </ul>
              {col.moreHref && col.count > col.cards.length && (
                <Link href={col.moreHref} className="block shrink-0 border-t border-line px-3 py-2 text-xs font-medium text-ink-3 hover:text-ink">
                  Ver las {col.count} en la lista
                </Link>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
