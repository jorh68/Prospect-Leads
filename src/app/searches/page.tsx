import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { integrations } from "@/lib/env";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { ProviderBadge, SearchStatusBadge } from "@/components/domain/badges";
import { SearchForm } from "@/components/searches/search-form";
import { AutoRefresh } from "@/components/searches/auto-refresh";
import { formatNumber, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Búsquedas" };

export default async function SearchesPage() {
  const searches = await db.search.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const active = searches.some((s) => s.status === "pending" || s.status === "running");

  return (
    <>
      <PageHeader
        title="Búsquedas"
        description="Encuentra negocios reales por tipo y ubicación. Cada resultado se guarda con su fuente."
      />
      <PageBody>
        {!integrations.googlePlaces() && (
          <Alert tone="info" title="Solo OpenStreetMap activo">
            Las búsquedas usan OpenStreetMap, que no incluye valoraciones ni reseñas. Añade{" "}
            <code className="font-mono text-xs">GOOGLE_PLACES_API_KEY</code> para completarlas con Google Places.{" "}
            <Link href="/settings" className="font-medium underline underline-offset-2">
              Ver integraciones
            </Link>
          </Alert>
        )}

        <Panel title="Nueva búsqueda">
          <SearchForm />
        </Panel>

        <Panel title="Historial" description={`${searches.length} búsquedas`}>
          {active && <AutoRefresh />}
          {searches.length === 0 ? (
            <EmptyState
              title="Todavía no hay búsquedas"
              description='Prueba con un nicho y una ciudad, por ejemplo "Clínicas dentales" en "Madrid".'
            />
          ) : (
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <TH>Búsqueda</TH>
                    <TH>Estado</TH>
                    <TH className="text-right">Empresas</TH>
                    <TH>Fuentes</TH>
                    <TH>Creada</TH>
                  </tr>
                </THead>
                <TBody>
                  {searches.map((s) => {
                    const providers = Array.isArray(s.providers) ? (s.providers as string[]) : [];
                    return (
                      <TR key={s.id}>
                        <TD className="font-medium text-ink">
                          <Link href={`/searches/${s.id}`} className="hover:text-accent-700 hover:underline">
                            {s.query}
                          </Link>
                        </TD>
                        <TD>
                          <SearchStatusBadge status={s.status} />
                        </TD>
                        <TD className="text-right tabular-nums">
                          {formatNumber(s.resultCount)}
                          <span className="text-ink-4"> / {s.requestedCount}</span>
                        </TD>
                        <TD>
                          <div className="flex gap-1">
                            {providers.map((p) => (
                              <ProviderBadge key={p} provider={p} />
                            ))}
                          </div>
                        </TD>
                        <TD className="whitespace-nowrap text-ink-3">{formatRelative(s.createdAt)}</TD>
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
