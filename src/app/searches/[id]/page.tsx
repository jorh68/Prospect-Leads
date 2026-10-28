import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { searchAreaSchema } from "@/lib/domain/types";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { ButtonLink } from "@/components/ui/button";
import { AnalysisStatusBadge, ProviderBadge, ScoreBadge, SearchStatusBadge } from "@/components/domain/badges";
import { AutoRefresh } from "@/components/searches/auto-refresh";
import { Button } from "@/components/ui/button";
import { repeatSearchAction } from "@/app/searches/actions";
import { displayUrl, formatPhone, formatDateTime, formatNumber, formatRating } from "@/lib/format";

const STEP_LABELS: Record<string, string> = {
  geocoding: "Localizando la zona",
  google_places: "Consultando Google Places",
  osm: "Consultando OpenStreetMap",
  saving: "Guardando empresas",
};

export async function generateMetadata(props: PageProps<"/searches/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const search = await db.search.findUnique({ where: { id }, select: { query: true } });
  return { title: search?.query ?? "Búsqueda" };
}

export default async function SearchDetailPage(props: PageProps<"/searches/[id]">) {
  const { id } = await props.params;
  const search = await db.search.findUnique({
    where: { id },
    include: {
      results: {
        orderBy: { rank: "asc" },
        include: {
          company: {
            include: { sources: { select: { provider: true } }, _count: { select: { socialProfiles: true } } },
          },
        },
      },
      jobs: { where: { type: "discovery" }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!search) notFound();

  const running = search.status === "pending" || search.status === "running";
  const job = search.jobs[0];
  const progress = (job?.progress ?? null) as { step?: string; done?: number; total?: number } | null;
  const warnings = Array.isArray(search.warnings) ? (search.warnings as string[]) : [];
  const area = searchAreaSchema.safeParse(search.area);
  const providers = Array.isArray(search.providers) ? (search.providers as string[]) : [];

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/searches" className="hover:text-ink">
            Búsquedas
          </Link>
        }
        title={search.query}
        actions={
          !running ? (
            <form action={repeatSearchAction.bind(null, search.id)}>
              <Button type="submit">Repetir búsqueda</Button>
            </form>
          ) : undefined
        }
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <SearchStatusBadge status={search.status} />
            <span>
              {formatNumber(search.resultCount)} de {search.requestedCount} empresas
            </span>
            <span>Creada {formatDateTime(search.createdAt)}</span>
            {providers.length > 0 && (
              <span className="flex items-center gap-1">
                Fuentes: {providers.map((p) => <ProviderBadge key={p} provider={p} />)}
              </span>
            )}
          </span>
        }
      />
      <PageBody>
        {running && (
          <Panel>
            <AutoRefresh />
            <div className="space-y-2 p-4">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-medium text-ink">
                  {search.status === "pending" ? "En cola" : (progress?.step && STEP_LABELS[progress.step]) || "Buscando"}…
                </span>
                {progress?.total ? (
                  <span className="tabular-nums text-ink-3">
                    {progress.done} / {progress.total}
                  </span>
                ) : null}
              </div>
              <ProgressBar value={progress?.total ? ((progress.done ?? 0) / progress.total) * 100 : null} />
            </div>
          </Panel>
        )}

        {search.status === "failed" && (
          <Alert tone="danger" title="La búsqueda no se pudo completar">
            {search.error}
          </Alert>
        )}

        {warnings.length > 0 && (
          <Alert tone="warning" title="Avisos">
            <ul className="list-disc space-y-0.5 pl-4">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Alert>
        )}

        {area.success && (
          <p className="text-xs text-ink-3">
            Zona buscada: {area.data.displayName}
          </p>
        )}

        <Panel title="Empresas encontradas" description="Ordenadas por relevancia de la fuente y datos de contacto disponibles">
          {search.results.length === 0 ? (
            <EmptyState
              title={running ? "Buscando empresas…" : "Sin resultados"}
              description={
                running
                  ? "Los resultados aparecerán aquí en cuanto se guarden."
                  : search.status === "failed"
                    ? "La búsqueda falló antes de obtener resultados. Revisa el error y repítela."
                    : "No se encontraron negocios con este criterio en las fuentes disponibles."
              }
              action={!running ? <ButtonLink href="/searches">Nueva búsqueda</ButtonLink> : undefined}
            />
          ) : (
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <TH className="w-10">#</TH>
                    <TH>Empresa</TH>
                    <TH>Web</TH>
                    <TH>Teléfono</TH>
                    <TH>Email</TH>
                    <TH>Dirección</TH>
                    <TH className="text-right">Valoración</TH>
                    <TH className="text-right">Reseñas</TH>
                    <TH>Fuentes</TH>
                    <TH>Análisis</TH>
                    <TH className="text-right">Score</TH>
                  </tr>
                </THead>
                <TBody>
                  {search.results.map(({ company: c, rank }) => {
                    const sources = [...new Set(c.sources.map((s) => s.provider))];
                    return (
                      <TR key={c.id}>
                        <TD className="tabular-nums text-ink-4">{rank}</TD>
                        <TD className="min-w-48">
                          <Link href={`/companies/${c.id}`} className="font-medium text-ink hover:text-accent-700 hover:underline">
                            {c.name}
                          </Link>
                          {c.category && <div className="text-xs text-ink-3">{c.category}</div>}
                        </TD>
                        <TD className="max-w-48 truncate">
                          {c.website ? (
                            <a href={c.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-accent-700">
                              {displayUrl(c.website)}
                              <ExternalLink className="size-3 text-ink-4" aria-hidden />
                            </a>
                          ) : (
                            <span className="text-ink-4">Sin web</span>
                          )}
                        </TD>
                        <TD className="whitespace-nowrap tabular-nums">{c.phone ? formatPhone(c.phone) : <span className="text-ink-4">—</span>}</TD>
                        <TD className="max-w-48 truncate">{c.email ?? <span className="text-ink-4">—</span>}</TD>
                        <TD className="min-w-48 text-xs">{c.address ?? <span className="text-ink-4">—</span>}</TD>
                        <TD className="text-right tabular-nums">{formatRating(c.rating)}</TD>
                        <TD className="text-right tabular-nums">{formatNumber(c.reviewCount)}</TD>
                        <TD>
                          <div className="flex gap-1">
                            {sources.map((p) => (
                              <ProviderBadge key={p} provider={p} />
                            ))}
                          </div>
                        </TD>
                        <TD>
                          <AnalysisStatusBadge status={c.analysisStatus} />
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
          )}
        </Panel>
      </PageBody>
    </>
  );
}
