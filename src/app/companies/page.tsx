import type { Metadata } from "next";
import Link from "next/link";
import { analysisAvailable } from "@/lib/analysis";
import {
  COMPANY_SORTS,
  activeFilterChips,
  companyFiltersQuery,
  hasActiveFilters,
  parseCompanyFilters,
  PAGE_SIZE,
  type CompanySort,
} from "@/lib/crm/filters";
import { companyFilterOptions, listCompanies } from "@/lib/crm/queries";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CompanyFilterBar } from "@/components/crm/company-filters";
import { CompaniesTable, type CompanyRowView, type SortLink } from "@/components/crm/companies-table";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Empresas" };

export default async function CompaniesPage(props: PageProps<"/companies">) {
  const filters = parseCompanyFilters(await props.searchParams);
  const [{ rows, total, page, pageCount }, options] = await Promise.all([listCompanies(filters), companyFilterOptions()]);

  const problemLabels = Object.fromEntries(options.problems.map((p) => [p.value, p.label]));
  const chips = activeFilterChips(filters, problemLabels);
  const chipHrefs = Object.fromEntries(chips.map((c) => [c.key, `/companies${companyFiltersQuery(filters, { [c.key]: c.key === "q" ? "" : null })}`]));

  const sortLinks = Object.fromEntries(
    (Object.keys(COMPANY_SORTS) as CompanySort[]).map((sort): [CompanySort, SortLink] => {
      const active = filters.sort === sort;
      // Clicking the active column flips the direction; others start at their default.
      const dir = active ? (filters.dir === "asc" ? "desc" : "asc") : parseCompanyFilters({ sort }).dir;
      return [sort, { href: `/companies${companyFiltersQuery(filters, { sort, dir })}`, active, dir: active ? filters.dir : dir }];
    }),
  ) as Record<CompanySort, SortLink>;

  const view: CompanyRowView[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    niche: r.niche,
    city: r.city,
    website: r.website,
    rating: r.rating,
    reviewCount: r.reviewCount,
    crmStatus: r.crmStatus,
    score: r.score,
    opportunityCount: r.opportunityCount,
    analysisStatus: r.analysisStatus,
    followUpAt: r.followUpAt?.toISOString() ?? null,
    owner: r.owner,
    topService: r.topOpportunity?.serviceKey ?? null,
    topOpportunity: r.topOpportunity?.title ?? null,
  }));

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  const filtered = hasActiveFilters(filters);

  return (
    <>
      <PageHeader
        title="Empresas"
        description={
          filtered
            ? `${formatNumber(total)} ${total === 1 ? "empresa coincide" : "empresas coinciden"} con los filtros`
            : `${formatNumber(total)} ${total === 1 ? "empresa" : "empresas"} encontradas en tus búsquedas`
        }
        actions={
          <ButtonLink href="/searches" variant="primary">
            Nueva búsqueda
          </ButtonLink>
        }
      />
      <PageBody>
        <Panel>
          <CompanyFilterBar
            filters={filters}
            options={{ ...options, services: options.services.map((s) => ({ key: s.key, companies: s.companies })) }}
            chips={chips}
            chipHrefs={chipHrefs}
          />
          {rows.length === 0 ? (
            filtered ? (
              <EmptyState
                title="Ninguna empresa coincide"
                description="Prueba a quitar algún filtro o a ampliar los rangos."
                action={<ButtonLink href="/companies">Limpiar filtros</ButtonLink>}
              />
            ) : (
              <EmptyState
                title="Todavía no hay empresas"
                description="Lanza una búsqueda por nicho y ubicación para descubrir negocios reales."
                action={<ButtonLink href="/searches" variant="primary">Nueva búsqueda</ButtonLink>}
              />
            )
          ) : (
            <>
              <CompaniesTable rows={view} sortLinks={sortLinks} analysisAvailable={analysisAvailable} />
              <nav className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-ink-3" aria-label="Paginación">
                <span className="tabular-nums">
                  {formatNumber(from)}–{formatNumber(to)} de {formatNumber(total)}
                </span>
                {pageCount > 1 && (
                  <div className="flex items-center gap-2">
                    {page > 1 ? (
                      <Link className="font-medium text-ink-2 hover:text-ink" href={`/companies${companyFiltersQuery(filters, { page: page - 1 })}`}>
                        Anterior
                      </Link>
                    ) : (
                      <span className="text-ink-4">Anterior</span>
                    )}
                    <span className="tabular-nums">
                      Página {page} de {pageCount}
                    </span>
                    {page < pageCount ? (
                      <Link className="font-medium text-ink-2 hover:text-ink" href={`/companies${companyFiltersQuery(filters, { page: page + 1 })}`}>
                        Siguiente
                      </Link>
                    ) : (
                      <span className="text-ink-4">Siguiente</span>
                    )}
                  </div>
                )}
              </nav>
            </>
          )}
        </Panel>
        <p className="text-xs text-ink-4">
          La puntuación es heurística: resume las oportunidades detectadas y la información disponible, no es una medida
          exacta. Ábrela en la ficha de cada empresa para ver cómo se ha calculado.
        </p>
      </PageBody>
    </>
  );
}
