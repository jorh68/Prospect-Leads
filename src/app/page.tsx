import Link from "next/link";
import { db } from "@/lib/db";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchStatusBadge } from "@/components/domain/badges";
import { formatNumber, formatRelative } from "@/lib/format";

/*
 * Dashboard — OWNED BY THREAD C (dashboard + CRM + filters).
 * Foundation version: live counters, recent searches and activity feed.
 */
export default async function DashboardPage() {
  const [companies, analyzed, opportunities, priority, searches, activity] = await Promise.all([
    db.company.count(),
    db.company.count({ where: { analysisStatus: "completed" } }),
    db.opportunity.count({ where: { status: "open" } }),
    db.company.count({ where: { crmStatus: "priority" } }),
    db.search.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Resumen de empresas, análisis y pipeline comercial."
        actions={
          <ButtonLink href="/searches" variant="primary">
            Nueva búsqueda
          </ButtonLink>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 divide-line rounded-lg border border-line bg-surface shadow-xs md:grid-cols-4 md:divide-x [&>*:nth-child(n+3)]:border-t [&>*:nth-child(n+3)]:border-line md:[&>*:nth-child(n+3)]:border-t-0">
          <Stat label="Empresas encontradas" value={formatNumber(companies)} />
          <Stat label="Empresas analizadas" value={formatNumber(analyzed)} />
          <Stat label="Oportunidades abiertas" value={formatNumber(opportunities)} />
          <Stat label="Prioritarias" value={formatNumber(priority)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Búsquedas recientes" actions={<ButtonLink href="/searches" variant="ghost" size="sm">Ver todas</ButtonLink>}>
            {searches.length === 0 ? (
              <EmptyState title="Sin búsquedas" description="Lanza la primera búsqueda para empezar a encontrar empresas." />
            ) : (
              <ul className="divide-y divide-line">
                {searches.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <Link href={`/searches/${s.id}`} className="truncate text-[13px] font-medium text-ink hover:text-accent-700">
                      {s.query}
                    </Link>
                    <div className="flex shrink-0 items-center gap-3 text-xs text-ink-3">
                      <span className="tabular-nums">{s.resultCount} empresas</span>
                      <SearchStatusBadge status={s.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Actividad reciente">
            {activity.length === 0 ? (
              <EmptyState title="Sin actividad" />
            ) : (
              <ul className="divide-y divide-line">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-[13px]">
                    <span className="text-ink-2">{a.message}</span>
                    <span className="shrink-0 text-xs text-ink-4">{formatRelative(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
