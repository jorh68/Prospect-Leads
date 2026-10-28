"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { bulkAnalyzeAction, bulkSetCrmStatusAction } from "@/lib/crm/actions";
import { CRM_STATUSES, CRM_STATUS_LABELS, SERVICES, type ServiceKey } from "@/lib/domain/constants";
import type { CompanySort } from "@/lib/crm/filters";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/progress";
import { AnalysisStatusBadge, CrmStatusBadge, ScoreBadge } from "@/components/domain/badges";
import { displayUrl, formatNumber, formatRating } from "@/lib/format";
import { cn } from "@/lib/cn";
import { FollowUpDate } from "./follow-up";

export interface CompanyRowView {
  id: string;
  name: string;
  niche: string | null;
  city: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  crmStatus: string;
  score: number | null;
  opportunityCount: number;
  analysisStatus: string;
  followUpAt: string | null;
  owner: string | null;
  topService: string | null;
  topOpportunity: string | null;
}

export interface SortLink {
  href: string;
  active: boolean;
  dir: "asc" | "desc";
}

function SortHeader({ label, link, className }: { label: string; link: SortLink; className?: string }) {
  const Icon = link.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TH className={className} aria-sort={link.active ? (link.dir === "asc" ? "ascending" : "descending") : undefined}>
      <Link
        href={link.href}
        scroll={false}
        className={cn("inline-flex items-center gap-1 hover:text-ink", link.active && "text-ink")}
      >
        {label}
        {link.active && <Icon className="size-3" aria-hidden />}
      </Link>
    </TH>
  );
}

export function CompaniesTable({
  rows,
  sortLinks,
  analysisAvailable,
}: {
  rows: CompanyRowView[];
  sortLinks: Record<CompanySort, SortLink>;
  analysisAvailable: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [result, setResult] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  // Drop selections that are no longer on the page (filters/paging changed).
  const visible = new Set(rows.map((r) => r.id));
  const ids = [...selected].filter((id) => visible.has(id));
  const allSelected = rows.length > 0 && ids.length === rows.length;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      setResult(r.ok ? { tone: "ok", text: r.message ?? "Hecho" } : { tone: "error", text: r.error });
      if (r.ok) {
        setSelected(new Set());
        setBulkStatus("");
      }
    });

  return (
    <>
      {(ids.length > 0 || result) && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-accent-50/60 px-4 py-2 text-[13px]" role="region" aria-label="Acciones en bloque">
          {ids.length > 0 ? (
            <>
              <span className="font-medium text-ink">
                {ids.length} {ids.length === 1 ? "seleccionada" : "seleccionadas"}
              </span>
              <Button
                size="sm"
                onClick={() => run(() => bulkAnalyzeAction(ids))}
                disabled={pending || !analysisAvailable}
                title={analysisAvailable ? undefined : "El módulo de análisis todavía no está disponible"}
              >
                Analizar
              </Button>
              <div className="flex items-center gap-1.5">
                <Select
                  aria-label="Nuevo estado"
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="h-7 w-40 text-xs"
                  disabled={pending}
                >
                  <option value="">Cambiar estado a…</option>
                  {CRM_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {CRM_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
                <Button size="sm" disabled={pending || !bulkStatus} onClick={() => run(() => bulkSetCrmStatusAction(ids, bulkStatus))}>
                  Aplicar
                </Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={pending}>
                Quitar selección
              </Button>
              {pending && <Spinner className="text-ink-3" />}
            </>
          ) : null}
          {result && (
            <span className={cn("ml-auto text-xs", result.tone === "ok" ? "text-success-700" : "text-danger-600")} role="status">
              {result.text}
              <button type="button" className="ml-2 text-ink-3 hover:text-ink" onClick={() => setResult(null)} aria-label="Cerrar aviso">
                ×
              </button>
            </span>
          )}
        </div>
      )}
      <TableContainer>
        <Table className="min-w-[1080px]">
          <THead>
            <tr>
              <TH className="w-8">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todas las de esta página"
                  className="size-3.5 accent-accent-600 align-middle"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = ids.length > 0 && !allSelected;
                  }}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                />
              </TH>
              <SortHeader label="Empresa" link={sortLinks.name} />
              <TH>Nicho</TH>
              <TH>Ubicación</TH>
              <SortHeader label="Valoración" link={sortLinks.rating} className="text-right" />
              <SortHeader label="Reseñas" link={sortLinks.reviews} className="text-right" />
              <SortHeader label="Oport." link={sortLinks.opportunities} className="text-right" />
              <TH>Servicio principal</TH>
              <TH>Estado</TH>
              <SortHeader label="Seguimiento" link={sortLinks.followUp} />
              <SortHeader label="Puntuación" link={sortLinks.score} className="text-right" />
            </tr>
          </THead>
          <TBody>
            {rows.map((c) => {
              const checked = selected.has(c.id);
              return (
                <TR key={c.id} className={cn(checked && "bg-accent-50/50 hover:bg-accent-50/70")}>
                  <TD>
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${c.name}`}
                      className="size-3.5 accent-accent-600 align-middle"
                      checked={checked}
                      onChange={() => toggle(c.id)}
                    />
                  </TD>
                  <TD className="max-w-72">
                    <Link href={`/companies/${c.id}`} className="block truncate font-medium text-ink hover:text-accent-700 hover:underline">
                      {c.name}
                    </Link>
                    <span className="block truncate text-xs text-ink-3">
                      {c.website ? displayUrl(c.website) : <span className="text-ink-4">Sin web</span>}
                    </span>
                  </TD>
                  <TD className="max-w-40 truncate">{c.niche ?? "—"}</TD>
                  <TD className="max-w-36 truncate">{c.city ?? "—"}</TD>
                  <TD className="text-right tabular-nums">{formatRating(c.rating)}</TD>
                  <TD className="text-right tabular-nums">{formatNumber(c.reviewCount)}</TD>
                  <TD className="text-right tabular-nums">
                    {c.analysisStatus === "completed" ? c.opportunityCount : <span className="text-ink-4">—</span>}
                  </TD>
                  <TD className="max-w-56">
                    {c.topService ? (
                      <span className="block truncate" title={c.topOpportunity ?? undefined}>
                        {SERVICES[c.topService as ServiceKey]?.label ?? c.topService}
                      </span>
                    ) : c.analysisStatus === "completed" ? (
                      <span className="text-ink-4">Ninguno</span>
                    ) : (
                      <AnalysisStatusBadge status={c.analysisStatus} />
                    )}
                  </TD>
                  <TD>
                    <CrmStatusBadge status={c.crmStatus} />
                  </TD>
                  <TD className="text-xs">
                    <FollowUpDate date={c.followUpAt} />
                    {c.owner && <span className="block truncate text-ink-4">{c.owner}</span>}
                  </TD>
                  <TD className="text-right">
                    <ScoreBadge score={c.score} />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </TableContainer>
    </>
  );
}
