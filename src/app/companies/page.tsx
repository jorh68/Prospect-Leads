import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { normalizeText } from "@/lib/text";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { CrmStatusBadge, ScoreBadge } from "@/components/domain/badges";
import { displayUrl, formatNumber, formatRating } from "@/lib/format";

export const metadata: Metadata = { title: "Empresas" };

/*
 * Company list — OWNED BY THREAD C (search + filters).
 * Foundation version: name search and the core columns.
 */
export default async function CompaniesPage(props: PageProps<"/companies">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const companies = await db.company.findMany({
    where: q ? { normalizedName: { contains: normalizeText(q) } } : undefined,
    orderBy: [{ score: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <>
      <PageHeader title="Empresas" description={`${formatNumber(companies.length)} empresas${q ? ` para "${q}"` : ""}`} />
      <PageBody>
        <Panel
          title={
            <form className="flex items-center gap-2" role="search">
              <Input name="q" defaultValue={q} placeholder="Buscar por nombre" className="w-64" aria-label="Buscar por nombre" />
              <Button type="submit" size="sm">Buscar</Button>
            </form>
          }
        >
          {companies.length === 0 ? (
            <EmptyState title="No hay empresas" description="Lanza una búsqueda para descubrir negocios reales." />
          ) : (
            <TableContainer>
              <Table>
                <THead>
                  <tr>
                    <TH>Empresa</TH>
                    <TH>Nicho</TH>
                    <TH>Ciudad</TH>
                    <TH>Web</TH>
                    <TH className="text-right">Valoración</TH>
                    <TH className="text-right">Reseñas</TH>
                    <TH>Estado</TH>
                    <TH className="text-right">Score</TH>
                  </tr>
                </THead>
                <TBody>
                  {companies.map((c) => (
                    <TR key={c.id}>
                      <TD className="font-medium text-ink">
                        <Link href={`/companies/${c.id}`} className="hover:text-accent-700 hover:underline">
                          {c.name}
                        </Link>
                      </TD>
                      <TD>{c.niche ?? "—"}</TD>
                      <TD>{c.city ?? "—"}</TD>
                      <TD className="max-w-48 truncate">{c.website ? displayUrl(c.website) : <span className="text-ink-4">Sin web</span>}</TD>
                      <TD className="text-right tabular-nums">{formatRating(c.rating)}</TD>
                      <TD className="text-right tabular-nums">{formatNumber(c.reviewCount)}</TD>
                      <TD><CrmStatusBadge status={c.crmStatus} /></TD>
                      <TD className="text-right"><ScoreBadge score={c.score} /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableContainer>
          )}
        </Panel>
      </PageBody>
    </>
  );
}
