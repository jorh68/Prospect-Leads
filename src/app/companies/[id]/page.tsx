import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { db } from "@/lib/db";
import { fieldSourcesSchema } from "@/lib/domain/types";
import { PROVIDER_LABELS, SOCIAL_PLATFORM_LABELS, type Provider, type SocialPlatform } from "@/lib/domain/constants";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AnalysisStatusBadge, CrmStatusBadge, ProviderBadge, ScoreBadge } from "@/components/domain/badges";
import { displayUrl, formatPhone, formatDateTime, formatNumber, formatRating } from "@/lib/format";

/*
 * Company page — OWNED BY THREAD B (company page, messages, PDF report).
 * Foundation version: discovered data with per-field provenance and raw sources.
 */

export async function generateMetadata(props: PageProps<"/companies/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const c = await db.company.findUnique({ where: { id }, select: { name: true } });
  return { title: c?.name ?? "Empresa" };
}

function Row({ label, value, source }: { label: string; value: ReactNode; source?: string }) {
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 px-4 py-2 text-[13px]">
      <dt className="text-ink-3">{label}</dt>
      <dd className="flex min-w-0 items-start justify-between gap-2 text-ink">
        <span className="min-w-0 break-words">{value ?? <span className="text-ink-4">No disponible</span>}</span>
        {source && value != null && (
          <span className="shrink-0 text-2xs text-ink-4">{PROVIDER_LABELS[source as Provider] ?? source}</span>
        )}
      </dd>
    </div>
  );
}

export default async function CompanyPage(props: PageProps<"/companies/[id]">) {
  const { id } = await props.params;
  const c = await db.company.findUnique({
    where: { id },
    include: { sources: { orderBy: { fetchedAt: "desc" } }, socialProfiles: true },
  });
  if (!c) notFound();

  const fs = fieldSourcesSchema.safeParse(c.fieldSources);
  const src = (f: string) => (fs.success ? fs.data[f] : undefined);
  const hours = Array.isArray(c.openingHours)
    ? (c.openingHours as string[]).join(" · ")
    : typeof c.openingHours === "string"
      ? c.openingHours
      : null;

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/companies" className="hover:text-ink">Empresas</Link>}
        title={c.name}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {c.category && <span>{c.category}</span>}
            {c.city && <span>{c.city}</span>}
            <CrmStatusBadge status={c.crmStatus} />
            <AnalysisStatusBadge status={c.analysisStatus} />
            <span className="flex items-center gap-1">Score <ScoreBadge score={c.score} /></span>
          </span>
        }
      />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Datos de contacto">
            <dl className="divide-y divide-line">
              <Row
                label="Web"
                value={c.website ? <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:underline">{displayUrl(c.website)}</a> : null}
                source={src("website")}
              />
              <Row label="Teléfono" value={c.phone ? formatPhone(c.phone) : null} source={src("phone")} />
              <Row label="Email" value={c.email} source={src("email")} />
              <Row label="Dirección" value={c.address} source={src("address")} />
              <Row label="Horario" value={hours} source={src("openingHours")} />
            </dl>
          </Panel>
          <Panel title="Reputación y presencia">
            <dl className="divide-y divide-line">
              <Row label="Valoración" value={c.rating != null ? `${formatRating(c.rating)} / 5` : null} source={src("rating")} />
              <Row label="Reseñas" value={c.reviewCount != null ? formatNumber(c.reviewCount) : null} source={src("reviewCount")} />
              <Row
                label="Ficha"
                value={c.mapsUrl ? <a href={c.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:underline">Ver en el mapa</a> : null}
                source={src("mapsUrl")}
              />
              <Row
                label="Redes"
                value={
                  c.socialProfiles.length > 0 ? (
                    <span className="flex flex-wrap gap-x-3 gap-y-1">
                      {c.socialProfiles.map((s) => (
                        <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:underline">
                          {SOCIAL_PLATFORM_LABELS[s.platform as SocialPlatform] ?? s.platform}
                        </a>
                      ))}
                    </span>
                  ) : null
                }
              />
              <Row label="Descripción" value={c.description} source={src("description")} />
            </dl>
          </Panel>
        </div>

        <Panel title="Fuentes" description="Registros originales de los que procede esta ficha">
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
                    <TD><ProviderBadge provider={s.provider} /></TD>
                    <TD className="font-mono text-xs">{s.externalId}</TD>
                    <TD>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent-700 hover:underline">
                          {displayUrl(s.url)}
                        </a>
                      ) : "—"}
                    </TD>
                    <TD className="whitespace-nowrap text-ink-3">{formatDateTime(s.fetchedAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableContainer>
        </Panel>
      </PageBody>
    </>
  );
}
