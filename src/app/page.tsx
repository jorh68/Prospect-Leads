import Link from "next/link";
import { dashboardData, PRIORITY_SCORE } from "@/lib/crm/queries";
import { CRM_STATUS_LABELS, PROVIDER_LABELS, SERVICES, type Provider } from "@/lib/domain/constants";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Stat } from "@/components/ui/stat";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CrmStatusBadge, ScoreBadge } from "@/components/domain/badges";
import { BarList } from "@/components/dashboard/bar-list";
import { ScoreHistogram } from "@/components/dashboard/score-histogram";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { FollowUpDate } from "@/components/crm/follow-up";
import { formatNumber, formatRating } from "@/lib/format";
import { cn } from "@/lib/cn";

function pct(part: number, whole: number) {
  return whole > 0 ? `${Math.round((part / whole) * 100)} %` : "—";
}

function NoAnalysis() {
  return <p className="px-4 py-6 text-center text-[13px] text-ink-3">Aparecerá cuando haya empresas analizadas.</p>;
}

export default async function DashboardPage() {
  const d = await dashboardData();
  const t = d.totals;

  if (t.total === 0) {
    return (
      <>
        <PageHeader title="Dashboard" description="Resumen de empresas, análisis y pipeline comercial." />
        <PageBody>
          <Panel>
            <EmptyState
              title={d.hasSearches ? "Tus búsquedas todavía no han encontrado empresas" : "Empieza buscando empresas"}
              description='Introduce un tipo de negocio y una ubicación, por ejemplo "Clínicas dentales" en "Madrid". Las empresas reales que se encuentren se analizarán y aparecerán aquí.'
              action={
                <ButtonLink href="/searches" variant="primary">
                  Nueva búsqueda
                </ButtonLink>
              }
            />
          </Panel>
        </PageBody>
      </>
    );
  }

  const pipelineMax = Math.max(1, ...d.pipeline.map((p) => p.count));

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
        <div className="grid grid-cols-2 rounded-lg border border-line bg-surface shadow-xs sm:grid-cols-3 lg:grid-cols-5 [&>*]:border-line max-lg:[&>*]:border-b lg:divide-x lg:divide-line">
          <Link href="/companies" className="hover:bg-subtle/50">
            <Stat label="Empresas encontradas" value={formatNumber(t.total)} />
          </Link>
          <Link href="/companies?analysis=completed" className="hover:bg-subtle/50">
            <Stat
              label="Empresas analizadas"
              value={formatNumber(t.analyzed)}
              hint={
                <>
                  {pct(t.analyzed, t.total)} del total
                  {t.analysisPending > 0 && ` · ${t.analysisPending} en cola`}
                  {t.analysisFailed > 0 && <span className="text-danger-700"> · {t.analysisFailed} con error</span>}
                </>
              }
            />
          </Link>
          <Link href={`/companies?scoreMin=${PRIORITY_SCORE}`} className="hover:bg-subtle/50">
            <Stat label="Prioritarias" value={formatNumber(t.priorityCount)} hint={`Puntuación ≥ ${PRIORITY_SCORE}, sin cerrar`} />
          </Link>
          <Link href="/pipeline" className="hover:bg-subtle/50">
            <Stat label="En conversación" value={formatNumber(t.activePipeline)} hint="Contactada → Propuesta" />
          </Link>
          <Link href="/pipeline" className="col-span-2 hover:bg-subtle/50 sm:col-span-1">
            <Stat
              label="Seguimientos vencidos"
              value={<span className={cn(t.overdue > 0 && "text-danger-700")}>{formatNumber(t.overdue)}</span>}
              hint={t.overdue > 0 ? "Revisa el pipeline" : "Al día"}
            />
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <Panel
            className="lg:col-span-2"
            title="Oportunidades prioritarias"
            description="Empresas abiertas con mayor puntuación heurística"
            actions={
              <ButtonLink href="/companies" variant="ghost" size="sm">
                Ver todas
              </ButtonLink>
            }
          >
            {d.priority.length === 0 ? (
              <NoAnalysis />
            ) : (
              <TableContainer>
                <Table className="min-w-[720px]">
                  <THead>
                    <tr>
                      <TH>Empresa</TH>
                      <TH>Oportunidad principal</TH>
                      <TH className="text-right">Valoración</TH>
                      <TH className="text-right">Oport.</TH>
                      <TH>Estado</TH>
                      <TH className="text-right">Puntuación</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {d.priority.map((c) => (
                      <TR key={c.id}>
                        <TD className="max-w-56">
                          <Link href={`/companies/${c.id}`} className="block truncate font-medium text-ink hover:text-accent-700 hover:underline">
                            {c.name}
                          </Link>
                          <span className="block truncate text-xs text-ink-3">{[c.niche, c.city].filter(Boolean).join(" · ") || "—"}</span>
                        </TD>
                        <TD className="max-w-72">
                          {c.topOpportunity ? (
                            <>
                              <span className="block truncate text-ink-2">{c.topOpportunity.title}</span>
                              <span className="block truncate text-xs text-ink-3">
                                {SERVICES[c.topOpportunity.serviceKey as keyof typeof SERVICES]?.label ?? c.topOpportunity.serviceKey}
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-4">Sin oportunidades detectadas</span>
                          )}
                        </TD>
                        <TD className="text-right">
                          {c.rating != null ? (
                            <>
                              <span className="block tabular-nums text-ink-2">
                                {formatRating(c.rating)}
                                {c.reviewCount != null && <span className="text-ink-3"> · {formatNumber(c.reviewCount)}</span>}
                              </span>
                              <span className="block text-xs text-ink-3">
                                {c.ratingSource ? (PROVIDER_LABELS[c.ratingSource as Provider] ?? c.ratingSource) : "—"}
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-4">No disponible</span>
                          )}
                        </TD>
                        <TD className="text-right tabular-nums">{c.opportunityCount}</TD>
                        <TD>
                          <CrmStatusBadge status={c.crmStatus} />
                        </TD>
                        <TD className="text-right">
                          <ScoreBadge score={c.score} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableContainer>
            )}
          </Panel>

          <Panel
            title="Próximos seguimientos"
            actions={
              <ButtonLink href="/pipeline" variant="ghost" size="sm">
                Pipeline
              </ButtonLink>
            }
          >
            {d.upcoming.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-ink-3">No hay seguimientos programados.</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.upcoming.map((c) => (
                  <li key={c.id} className="px-4 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/companies/${c.id}`} className="min-w-0 truncate text-[13px] font-medium text-ink hover:text-accent-700 hover:underline">
                        {c.name}
                      </Link>
                      <FollowUpDate date={c.followUpAt} className="shrink-0 text-xs" />
                    </div>
                    {(c.nextAction || c.owner) && (
                      <p className="mt-0.5 truncate text-xs text-ink-3">{[c.nextAction, c.owner].filter(Boolean).join(" · ")}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <Panel
            title="Distribución de puntuaciones"
            description={d.scoredCount > 0 ? `${formatNumber(d.scoredCount)} empresas puntuadas · heurística 0–100` : "Puntuación heurística 0–100"}
          >
            {d.scoredCount === 0 ? <NoAnalysis /> : <ScoreHistogram bins={d.histogram} priorityFrom={PRIORITY_SCORE} />}
          </Panel>

          <Panel title="Problemas más habituales" description="Empresas analizadas en las que se detecta">
            {d.problems.length === 0 ? (
              <NoAnalysis />
            ) : (
              <BarList
                unit="empresas"
                max={t.analyzed}
                items={d.problems.map((p) => ({
                  key: p.value,
                  label: p.label,
                  value: p.count,
                  detail: pct(p.count, t.analyzed),
                  href: `/companies?problem=${encodeURIComponent(p.value)}`,
                }))}
              />
            )}
          </Panel>

          <Panel title="Servicios con mayor oportunidad" description="Empresas con al menos una oportunidad para el servicio">
            {d.services.length === 0 ? (
              <NoAnalysis />
            ) : (
              <BarList
                unit="empresas"
                items={d.services.map((s) => ({
                  key: s.key,
                  label: SERVICES[s.key].label,
                  value: s.companies,
                  detail: s.highImpact > 0 ? `${s.highImpact} impacto alto` : undefined,
                  href: `/companies?service=${s.key}`,
                }))}
              />
            )}
          </Panel>
        </div>

        <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
          <Panel
            title="Estado del pipeline"
            description="Empresas por estado del CRM"
            actions={
              <ButtonLink href="/pipeline" variant="ghost" size="sm">
                Abrir
              </ButtonLink>
            }
          >
            <BarList
              unit="empresas"
              max={pipelineMax}
              items={d.pipeline.map((p) => ({
                key: p.status,
                label: CRM_STATUS_LABELS[p.status],
                value: p.count,
                href: `/companies?status=${p.status}`,
              }))}
            />
          </Panel>

          <Panel className="lg:col-span-2" title="Actividad reciente">
            {d.activity.length === 0 ? <p className="px-4 py-6 text-center text-[13px] text-ink-3">Sin actividad todavía.</p> : <ActivityFeed items={d.activity} />}
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
