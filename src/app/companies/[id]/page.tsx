import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { isLlmAvailable } from "@/lib/llm";
import { messageBasisSchema } from "@/lib/domain/types";
import { SOCIAL_PLATFORM_LABELS, type SocialPlatform } from "@/lib/domain/constants";
import { loadCompanyDossier } from "@/lib/reports/dossier";
import { deriveNextActions, isSpanishMobile } from "@/lib/reports/next-actions";
import { recommendServices } from "@/lib/reports/services";
import { latestMessages } from "@/lib/messages/generate";
import { displayUrl, formatDate, formatDateTime, formatNumber, formatPhone, formatRating, formatRelative } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { buttonClasses } from "@/components/ui/button";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AnalysisStatusBadge, CrmStatusBadge, ProviderBadge } from "@/components/domain/badges";
import { AutoRefresh } from "@/components/searches/auto-refresh";
import { CrmPanel } from "@/components/crm/crm-panel";
import { AnalyzeButton } from "@/components/company/analyze-button";
import { GenerateReportButton } from "@/components/company/report-button";
import { MessagesPanel, type MessageView } from "@/components/company/messages-panel";
import { OpportunityList, ImpactBadge } from "@/components/company/opportunity-list";
import { ScoreBreakdown } from "@/components/company/score-breakdown";
import { FindingsList } from "@/components/company/findings-list";
import { ExternalA, InfoList, InfoRow } from "@/components/company/info-list";
import { cn } from "@/lib/cn";
import { z } from "zod";

/*
 * Company page — module B. Everything about one business on one screen:
 * main column = what we found and what to do about it; side column = CRM,
 * next actions, contact data and services to offer.
 */

export async function generateMetadata(props: PageProps<"/companies/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const c = await db.company.findUnique({ where: { id }, select: { name: true } });
  return { title: c?.name ?? "Empresa" };
}

/** Only the part of module A's Analysis.signals this page reads. */
const signalsLimitationsSchema = z.object({ limitations: z.array(z.string()) });

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function hoursLines(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.trim()) return value.split(/;\s*/);
  return null;
}

function whatsappNumber(phone: string | null, socials: { platform: string; url: string }[]): string | null {
  const wa = socials.find((s) => s.platform === "whatsapp");
  const fromLink = wa?.url.match(/wa\.me\/(\d{8,15})|phone=(\d{8,15})/);
  if (fromLink) return fromLink[1] ?? fromLink[2] ?? null;
  if (!isSpanishMobile(phone)) return null;
  const digits = phone!.replace(/\D/g, "");
  return digits.length === 9 ? `34${digits}` : digits;
}

export default async function CompanyPage(props: PageProps<"/companies/[id]">) {
  const { id } = await props.params;
  const d = await loadCompanyDossier(id);
  if (!d) notFound();

  const [{ latest, versions }, reports] = await Promise.all([
    latestMessages(id),
    db.report.findMany({ where: { companyId: id }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, createdAt: true } }),
  ]);

  const c = d.company;
  const src = (f: string) => d.fieldSources[f];
  const running = c.analysisStatus === "queued" || c.analysisStatus === "running";
  const failed = d.latestAnalysis?.status === "failed" || c.analysisStatus === "failed";
  const issues = d.findings.filter((f) => f.kind === "issue");
  const highIssues = issues.filter((f) => f.severity === "high").length;
  const highOpps = d.opportunities.filter((o) => o.impact === "high").length;
  const services = recommendServices(d.opportunities);
  const hours = hoursLines(c.openingHours);
  const linkedin = c.socialProfiles.find((s) => s.platform === "linkedin");

  const nextActions = deriveNextActions({
    crmStatus: c.crmStatus,
    nextAction: c.nextAction,
    followUpAt: c.followUpAt,
    analysisStatus: c.analysisStatus,
    hasAnalysis: d.analysis != null,
    opportunityCount: d.opportunities.length,
    hasMessages: latest.size > 0,
    hasReport: reports.length > 0,
    email: c.email,
    phone: c.phone,
    hasLinkedin: linkedin != null,
    businessStatus: c.businessStatus,
  });

  const messages: MessageView[] = [...latest.values()].map((m) => {
    const basis = messageBasisSchema.safeParse(m.basis);
    return {
      id: m.id,
      channel: m.channel,
      subject: m.subject,
      body: m.body,
      generator: m.generator,
      edited: m.edited,
      updatedAt: m.updatedAt.toISOString(),
      facts: basis.success ? basis.data.facts : [],
    };
  });

  const limitations = signalsLimitationsSchema.safeParse(d.analysis?.signals);
  // Load time and size describe the page only when it was actually served (not an error page).
  const pageServed = d.analysis?.httpStatus != null && d.analysis.httpStatus >= 200 && d.analysis.httpStatus < 300;
  const analysisMetrics = d.analysis
    ? [
        { label: "Página analizada", value: d.analysis.finalUrl ?? d.analysis.url ? displayUrl(d.analysis.finalUrl ?? d.analysis.url) : "Sin web" },
        { label: "Respuesta HTTP", value: d.analysis.httpStatus != null ? String(d.analysis.httpStatus) : "—" },
        {
          label: "Tiempo de carga",
          value:
            pageServed && d.analysis.loadTimeMs != null
              ? d.analysis.loadTimeMs < 100
                ? "< 0,1 s"
                : `${formatNumber(Math.round(d.analysis.loadTimeMs / 100) / 10)} s`
              : "—",
        },
        { label: "Peso de la página", value: pageServed && d.analysis.pageBytes != null ? `${formatNumber(Math.max(1, Math.round(d.analysis.pageBytes / 1024)))} KB` : "—" },
        { label: "Interpretación", value: d.analysis.generator === "llm" ? "IA sobre señales detectadas" : "Reglas" },
      ]
    : [];

  return (
    <>
      {running && <AutoRefresh ms={3000} />}
      <PageHeader
        eyebrow={
          <Link href="/companies" className="hover:text-ink">
            Empresas
          </Link>
        }
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {(c.category || c.niche) && <span>{c.category ?? c.niche}</span>}
            {c.city && <span>{c.city}</span>}
            <CrmStatusBadge status={c.crmStatus} />
            {c.analysisStatus !== "completed" && <AnalysisStatusBadge status={c.analysisStatus} />}
          </span>
        }
        actions={
          <>
            {c.website && (
              <a href={c.website} target="_blank" rel="noopener noreferrer" className={buttonClasses("ghost", "sm")}>
                <ExternalLink aria-hidden />
                {displayUrl(c.website)}
              </a>
            )}
            <AnalyzeButton companyId={c.id} status={c.analysisStatus} variant={d.analysis ? "secondary" : "primary"} />
            <GenerateReportButton companyId={c.id} disabled={!d.analysis} variant={d.analysis ? "primary" : "secondary"} />
          </>
        }
      />

      <PageBody>
        <Panel bodyClassName="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-line sm:grid-cols-5 [&>*]:bg-surface">
          <Stat label="Puntuación" value={c.score != null ? <>{c.score}<span className="text-sm font-normal text-ink-4"> /100</span></> : "—"} hint="Heurística de prioridad" />
          <Stat label="Oportunidades" value={d.analysis ? d.opportunities.length : "—"} hint={d.analysis ? `${highOpps} de impacto alto` : "Sin analizar"} />
          <Stat label="Problemas detectados" value={d.analysis ? issues.length : "—"} hint={d.analysis ? `${highIssues} de prioridad alta` : "Sin analizar"} />
          <Stat
            label="Valoración"
            value={c.rating != null ? formatRating(c.rating) : "—"}
            hint={c.reviewCount != null ? `${formatNumber(c.reviewCount)} reseñas` : "No disponible en las fuentes"}
          />
          <Stat className="col-span-2 sm:col-span-1" label="Último análisis" value={d.analysis ? formatRelative(d.analysis.finishedAt ?? d.analysis.createdAt) : "—"} hint={d.analysis ? formatDate(d.analysis.finishedAt ?? d.analysis.createdAt) : "Nunca"} />
        </Panel>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ── Main column ── */}
          <div className="min-w-0 space-y-4">
            <section id="analisis" className="scroll-mt-4">
              <Panel title="Resumen del análisis" description={d.analysis ? `Versión ${d.analysis.version} · ${formatDateTime(d.analysis.finishedAt ?? d.analysis.createdAt)}` : undefined}>
                {running && (
                  <div className="space-y-2 border-b border-line p-4">
                    <div className="text-[13px] font-medium text-ink">
                      {c.analysisStatus === "queued" ? "Análisis en cola…" : "Analizando la web y la presencia digital…"}
                    </div>
                    <ProgressBar value={null} />
                  </div>
                )}
                {failed && !running && (
                  <div className="border-b border-line p-4">
                    <Alert tone="danger" title="El último análisis no se pudo completar">
                      {d.latestAnalysis?.error ?? "Error desconocido. Revisa los logs del servidor."}
                      {d.analysis && ` Se muestran los resultados del análisis del ${formatDate(d.analysis.finishedAt ?? d.analysis.createdAt)}.`}
                    </Alert>
                  </div>
                )}
                {d.analysis ? (
                  <>
                    <p className="whitespace-pre-line px-4 py-3 text-[13px] leading-6 text-ink-2">
                      {d.analysis.summary ?? "El análisis no generó un resumen."}
                    </p>
                    <dl className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
                      {analysisMetrics.map((m) => (
                        <div key={m.label} className="bg-surface px-4 py-2">
                          <dt className="text-2xs text-ink-3">{m.label}</dt>
                          <dd className="truncate text-[13px] tabular-nums text-ink" title={m.value}>
                            {m.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {limitations.success && limitations.data.limitations.length > 0 && (
                      <div className="border-t border-line px-4 py-2.5">
                        <div className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Lo que el análisis no pudo comprobar</div>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-5 text-ink-3">
                          {limitations.data.limitations.map((l) => (
                            <li key={l}>{l}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  !running &&
                  !failed && (
                    <EmptyState
                      title="Esta empresa todavía no se ha analizado"
                      description="El análisis revisa su web y su presencia digital, detecta problemas con evidencia y calcula la puntuación."
                      action={<AnalyzeButton companyId={c.id} status={c.analysisStatus} variant="primary" />}
                    />
                  )
                )}
              </Panel>
            </section>

            {d.analysis && (
              <>
                <Panel
                  title={`Oportunidades (${d.opportunities.length})`}
                  description="Problema, evidencia, consecuencia y solución. Ordenadas por impacto y confianza."
                >
                  {d.opportunities.length > 0 ? (
                    <OpportunityList opportunities={d.opportunities} />
                  ) : (
                    <EmptyState
                      title="Sin oportunidades con evidencia suficiente"
                      description="El análisis no encontró problemas que justifiquen una propuesta. No se muestran oportunidades sin evidencia."
                    />
                  )}
                </Panel>

                <Panel title="¿Por qué esta nota?" description="Cada factor, su peso y lo que aporta a la puntuación">
                  {d.score ? (
                    <ScoreBreakdown total={d.score.total} breakdown={d.score.breakdown} />
                  ) : (
                    <EmptyState title="Sin puntuación" description="El análisis no generó una puntuación para esta empresa." />
                  )}
                </Panel>

                <Panel
                  title="Hallazgos y evidencias"
                  description={[
                    plural(issues.length, "problema", "problemas"),
                    plural(d.findings.filter((f) => f.kind === "positive").length, "punto fuerte", "puntos fuertes"),
                    plural(d.findings.filter((f) => f.kind === "neutral").length, "observación", "observaciones"),
                  ].join(" · ")}
                >
                  {d.findings.length > 0 ? (
                    <FindingsList findings={d.findings} />
                  ) : (
                    <EmptyState title="Sin hallazgos" description="El análisis no registró observaciones." />
                  )}
                </Panel>
              </>
            )}

            <MessagesPanel
              companyId={c.id}
              messages={messages}
              contact={{ email: c.email, whatsappNumber: whatsappNumber(c.phone, c.socialProfiles), linkedinUrl: linkedin?.url ?? null }}
              canGenerate={d.opportunities.length > 0}
              blockedReason={
                d.analysis
                  ? "El análisis no encontró oportunidades con evidencia; un mensaje sin un motivo concreto sería genérico."
                  : "Primero hay que analizar la empresa: los mensajes se basan en lo que encuentra el análisis."
              }
              llmAvailable={isLlmAvailable()}
            />
            {versions > messages.length && (
              <p className="-mt-2 px-1 text-2xs text-ink-4">Se conservan {versions - messages.length} versiones anteriores de los mensajes.</p>
            )}

            <section id="informes" className="scroll-mt-4">
              <Panel
                title="Informes"
                description="Instantáneas para enseñar al cliente, exportables a PDF"
                actions={<GenerateReportButton companyId={c.id} disabled={!d.analysis} label={reports.length > 0 ? "Nueva versión" : "Generar informe"} />}
              >
                {reports.length === 0 ? (
                  <EmptyState
                    title="Sin informes"
                    description={
                      d.analysis
                        ? "Genera un informe con la situación actual, los problemas, las oportunidades y las recomendaciones."
                        : "Disponible cuando la empresa esté analizada."
                    }
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {reports.map((r, i) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                        <div className="min-w-0">
                          <Link href={`/companies/${c.id}/report/${r.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                            {formatDateTime(r.createdAt)}
                          </Link>
                          {i === 0 && (
                            <Badge tone="outline" className="ml-2">
                              Más reciente
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <Link href={`/companies/${c.id}/report/${r.id}`} className="text-accent-700 hover:underline">
                            Ver
                          </Link>
                          <a href={`/companies/${c.id}/report/${r.id}/pdf`} className="text-accent-700 hover:underline">
                            Descargar PDF
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </section>

            <Panel
              title="Fuentes"
              description={
                c.searchResults.length > 0
                  ? `Encontrada en: ${c.searchResults.map((r) => r.search.query).join(" · ")}`
                  : "Registros originales de los que procede esta ficha"
              }
            >
              <TableContainer>
                <Table>
                  <THead>
                    <tr>
                      <TH>Fuente</TH>
                      <TH>Identificador</TH>
                      <TH>Enlace</TH>
                      <TH>Obtenido</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {c.sources.map((s) => (
                      <TR key={s.id}>
                        <TD>
                          <ProviderBadge provider={s.provider} />
                        </TD>
                        <TD className="max-w-56 truncate font-mono text-xs">{s.externalId}</TD>
                        <TD className="max-w-64 truncate">{s.url ? <ExternalA href={s.url}>{displayUrl(s.url)}</ExternalA> : "—"}</TD>
                        <TD className="whitespace-nowrap text-ink-3">{formatDateTime(s.fetchedAt)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableContainer>
            </Panel>
          </div>

          {/* ── Side column ── */}
          <aside className="min-w-0 space-y-4">
            <CrmPanel companyId={c.id} />

            <Panel title="Próximas acciones">
              {nextActions.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-ink-3">Nada pendiente.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {nextActions.map((a, i) => {
                    const inner = (
                      <>
                        <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", a.tone === "warning" ? "bg-warning-600" : "bg-accent-600")} aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-ink">{a.label}</span>
                          {a.detail && <span className="block text-xs text-ink-3">{a.detail}</span>}
                        </span>
                      </>
                    );
                    return (
                      <li key={i}>
                        {a.href ? (
                          <a href={a.href} className="flex gap-2.5 px-4 py-2.5 hover:bg-subtle/50">
                            {inner}
                          </a>
                        ) : (
                          <div className="flex gap-2.5 px-4 py-2.5">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel title="Contacto">
              <InfoList>
                <InfoRow label="Web" value={c.website ? <ExternalA href={c.website}>{displayUrl(c.website)}</ExternalA> : null} source={src("website")} empty="Sin web propia" />
                <InfoRow label="Teléfono" value={c.phone ? <a href={`tel:${c.phone}`} className="tabular-nums hover:text-accent-700">{formatPhone(c.phone)}</a> : null} source={src("phone")} />
                <InfoRow label="Email" value={c.email ? <a href={`mailto:${c.email}`} className="hover:text-accent-700">{c.email}</a> : null} source={src("email")} />
                <InfoRow label="Dirección" value={c.address} source={src("address")} />
                <InfoRow
                  label="Horario"
                  value={
                    hours ? (
                      <span className="block space-y-0.5 text-xs leading-5">
                        {hours.map((h) => (
                          <span key={h} className="block">
                            {h}
                          </span>
                        ))}
                      </span>
                    ) : null
                  }
                  source={src("openingHours")}
                />
              </InfoList>
            </Panel>

            <Panel title="Reseñas y presencia digital">
              <InfoList>
                <InfoRow label="Valoración" value={c.rating != null ? `${formatRating(c.rating)} / 5` : null} source={src("rating")} />
                <InfoRow label="Reseñas" value={c.reviewCount != null ? formatNumber(c.reviewCount) : null} source={src("reviewCount")} />
                <InfoRow label="Ficha" value={c.mapsUrl ? <ExternalA href={c.mapsUrl}>Ver en el mapa</ExternalA> : null} source={src("mapsUrl")} />
                <InfoRow
                  label="Redes"
                  empty="No se han encontrado"
                  value={
                    c.socialProfiles.length > 0 ? (
                      <span className="block space-y-0.5">
                        {c.socialProfiles.map((s) => (
                          <span key={s.id} className="flex items-center justify-between gap-2">
                            <ExternalA href={s.url}>{SOCIAL_PLATFORM_LABELS[s.platform as SocialPlatform] ?? s.platform}</ExternalA>
                            <span className="text-2xs text-ink-4">{s.source === "website" ? "Web" : s.source === "osm" ? "OSM" : "Google"}</span>
                          </span>
                        ))}
                      </span>
                    ) : null
                  }
                />
                {c.description && <InfoRow label="Descripción" value={c.description} source={src("description")} />}
              </InfoList>
              {c.rating == null && !src("rating") && (
                <p className="border-t border-line px-4 py-2 text-xs text-ink-3">
                  Las valoraciones y reseñas solo llegan desde Google Places (variable <code className="font-mono">GOOGLE_PLACES_API_KEY</code>).
                </p>
              )}
            </Panel>

            <Panel title="Servicios que podríamos ofrecer">
              {services.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-ink-3">
                  {d.analysis ? "Ninguno: no hay oportunidades con evidencia." : "Se calculan a partir de las oportunidades del análisis."}
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {services.map((s) => (
                    <li key={s.key} className="space-y-1 px-4 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[13px] font-medium text-ink">{s.label}</span>
                        <ImpactBadge impact={s.impact} />
                      </div>
                      <p className="text-xs leading-5 text-ink-3">{s.description}</p>
                      <p className="text-xs leading-5 text-ink-2">Por: {s.opportunities.map((o) => o.title).join(" · ")}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </aside>
        </div>
      </PageBody>
    </>
  );
}
