"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { X } from "lucide-react";
import { ANALYSIS_STATUSES, ANALYSIS_STATUS_LABELS, CRM_STATUSES, CRM_STATUS_LABELS, SERVICES, type ServiceKey } from "@/lib/domain/constants";
import type { CompanyFilters, FilterChip } from "@/lib/crm/filters";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface CompanyFilterOptions {
  niches: FilterOption[];
  cities: FilterOption[];
  problems: FilterOption[];
  services: { key: ServiceKey; companies: number }[];
}

function Control({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-2xs font-medium text-ink-3">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Filter bar for the companies list. Builds a clean query string (no empty
 * params) and navigates; selects apply immediately, text and number fields
 * on Enter or "Aplicar".
 */
export function CompanyFilterBar({
  filters,
  options,
  chips,
  chipHrefs,
}: {
  filters: CompanyFilters;
  options: CompanyFilterOptions;
  chips: FilterChip[];
  /** Link that removes each chip's filter */
  chipHrefs: Record<string, string>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const apply = () => {
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) {
      const s = String(v).trim();
      if (s) params.set(k, s);
    }
    const qs = params.toString();
    router.push(`/companies${qs ? `?${qs}` : ""}`);
  };

  const num = (n: number | null) => (n == null ? "" : String(n));
  const keyed = JSON.stringify(filters);

  return (
    <div className="border-b border-line">
      <form
        ref={formRef}
        key={keyed}
        role="search"
        aria-label="Filtrar empresas"
        className="grid grid-cols-2 gap-x-3 gap-y-2.5 px-4 py-3 sm:grid-cols-3 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
        onChange={(e) => {
          if (e.target instanceof HTMLSelectElement) apply();
        }}
      >
        {filters.sort !== "score" && <input type="hidden" name="sort" value={filters.sort} />}
        {(filters.sort !== "score" || filters.dir !== "desc") && <input type="hidden" name="dir" value={filters.dir} />}

        <Control label="Nombre" htmlFor="f-q" className="col-span-2 sm:col-span-3 lg:col-span-2">
          <Input id="f-q" name="q" type="search" defaultValue={filters.q} placeholder="Buscar empresa…" autoComplete="off" />
        </Control>
        <Control label="Nicho" htmlFor="f-niche">
          <Select id="f-niche" name="niche" defaultValue={filters.niche ?? ""}>
            <option value="">Todos</option>
            {options.niches.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} ({o.count})
              </option>
            ))}
          </Select>
        </Control>
        <Control label="Ubicación" htmlFor="f-city">
          <Select id="f-city" name="city" defaultValue={filters.city ?? ""}>
            <option value="">Todas</option>
            {options.cities.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} ({o.count})
              </option>
            ))}
          </Select>
        </Control>
        <Control label="Estado CRM" htmlFor="f-status">
          <Select id="f-status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            {CRM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CRM_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Control>
        <Control label="Análisis" htmlFor="f-analysis">
          <Select id="f-analysis" name="analysis" defaultValue={filters.analysis ?? ""}>
            <option value="">Todos</option>
            {ANALYSIS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ANALYSIS_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Control>

        <Control label="Problema detectado" htmlFor="f-problem" className="col-span-2 sm:col-span-1 lg:col-span-2">
          <Select id="f-problem" name="problem" defaultValue={filters.problem ?? ""} disabled={options.problems.length === 0 && !filters.problem}>
            <option value="">{options.problems.length ? "Cualquiera" : "Sin análisis todavía"}</option>
            {options.problems.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} ({o.count})
              </option>
            ))}
            {filters.problem && !options.problems.some((o) => o.value === filters.problem) && (
              <option value={filters.problem}>{filters.problem}</option>
            )}
          </Select>
        </Control>
        <Control label="Servicio recomendado" htmlFor="f-service" className="col-span-2 sm:col-span-1 lg:col-span-2">
          <Select id="f-service" name="service" defaultValue={filters.service ?? ""}>
            <option value="">Cualquiera</option>
            {(Object.keys(SERVICES) as ServiceKey[]).map((k) => {
              const n = options.services.find((s) => s.key === k)?.companies ?? 0;
              return (
                <option key={k} value={k}>
                  {SERVICES[k].label} ({n})
                </option>
              );
            })}
          </Select>
        </Control>
        <Control label="Web" htmlFor="f-web">
          <Select id="f-web" name="web" defaultValue={filters.web ?? ""}>
            <option value="">Todas</option>
            <option value="yes">Con web</option>
            <option value="no">Sin web</option>
          </Select>
        </Control>
        <Control label="Puntuación" htmlFor="f-scoreMin">
          <div className="flex items-center gap-1">
            <Input id="f-scoreMin" name="scoreMin" type="number" min={0} max={100} inputMode="numeric" placeholder="Mín" defaultValue={num(filters.scoreMin)} aria-label="Puntuación mínima" />
            <span className="text-ink-4" aria-hidden>–</span>
            <Input name="scoreMax" type="number" min={0} max={100} inputMode="numeric" placeholder="Máx" defaultValue={num(filters.scoreMax)} aria-label="Puntuación máxima" />
          </div>
        </Control>

        <Control label="Oportunidades ≥" htmlFor="f-oppMin">
          <Input id="f-oppMin" name="oppMin" type="number" min={0} inputMode="numeric" placeholder="0" defaultValue={num(filters.oppMin)} />
        </Control>
        <Control label="Valoración ≥" htmlFor="f-ratingMin">
          <Input id="f-ratingMin" name="ratingMin" type="number" min={0} max={5} step={0.1} inputMode="decimal" placeholder="0,0" defaultValue={num(filters.ratingMin)} />
        </Control>
        <Control label="Reseñas ≥" htmlFor="f-reviewsMin">
          <Input id="f-reviewsMin" name="reviewsMin" type="number" min={0} inputMode="numeric" placeholder="0" defaultValue={num(filters.reviewsMin)} />
        </Control>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-3 lg:col-span-3 lg:justify-end">
          <Button type="submit" size="md" variant="primary">
            Aplicar
          </Button>
          {chips.length > 0 && (
            <Link href={`/companies${filters.sort !== "score" ? `?sort=${filters.sort}` : ""}`} className="inline-flex h-8 items-center px-2 text-[13px] font-medium text-ink-3 hover:text-ink">
              Limpiar filtros
            </Link>
          )}
        </div>
      </form>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-4 py-2">
          <span className="mr-1 text-2xs font-medium text-ink-3">Filtros activos</span>
          {chips.map((c) => (
            <Link
              key={c.key}
              href={chipHrefs[c.key]}
              className="inline-flex h-6 items-center gap-1 rounded-sm bg-accent-50 px-2 text-xs font-medium text-accent-800 ring-1 ring-accent-200 ring-inset hover:bg-accent-100"
              aria-label={`Quitar filtro ${c.label}`}
            >
              {c.label}
              <X className="size-3" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
