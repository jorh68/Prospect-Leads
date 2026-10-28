import type { Metadata } from "next";
import Link from "next/link";
import { pipelineData, BOARD_COLUMN_LIMIT } from "@/lib/crm/queries";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { CrmStatusBadge } from "@/components/domain/badges";
import { PipelineBoard, type BoardColumn } from "@/components/crm/pipeline-board";
import { PipelineOwnerFilter } from "@/components/crm/owner-filter";
import { FollowUpDate } from "@/components/crm/follow-up";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage(props: PageProps<"/pipeline">) {
  const sp = await props.searchParams;
  const owner = typeof sp.owner === "string" && sp.owner.trim() ? sp.owner.trim().slice(0, 80) : null;
  const { columns, owners, followUps, overdue } = await pipelineData({ owner });
  const total = columns.reduce((n, c) => n + c.count, 0);

  const board: BoardColumn[] = columns.map((c) => ({
    status: c.status,
    count: c.count,
    cards: c.cards.map((card) => ({ ...card, followUpAt: card.followUpAt?.toISOString() ?? null })),
    moreHref: c.count > BOARD_COLUMN_LIMIT ? `/companies?status=${c.status}` : null,
  }));

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={`${formatNumber(total)} empresas${owner ? ` de ${owner}` : ""} · arrastra una tarjeta o usa su selector para cambiar el estado`}
        actions={<PipelineOwnerFilter owners={owners} value={owner} />}
      />
      <PageBody>
        {total === 0 ? (
          <Panel>
            <EmptyState
              title={owner ? `${owner} no tiene empresas asignadas` : "El pipeline está vacío"}
              description={owner ? undefined : "Las empresas que encuentres en tus búsquedas aparecerán aquí como Nuevas."}
              action={owner ? <ButtonLink href="/pipeline">Ver todo el pipeline</ButtonLink> : <ButtonLink href="/searches" variant="primary">Nueva búsqueda</ButtonLink>}
            />
          </Panel>
        ) : (
          <>
            <Panel
              title="Seguimientos"
              description={
                followUps.length === 0
                  ? "No hay seguimientos programados"
                  : overdue > 0
                    ? `${overdue} vencidos · próximos ordenados por fecha`
                    : "Próximos, ordenados por fecha"
              }
            >
              {followUps.length === 0 ? (
                <p className="px-4 py-3 text-[13px] text-ink-3">
                  Programa una fecha de seguimiento desde la ficha de una empresa para verla aquí.
                </p>
              ) : (
                <TableContainer>
                  <Table className="min-w-[720px]">
                    <THead>
                      <tr>
                        <TH>Fecha</TH>
                        <TH>Empresa</TH>
                        <TH>Próxima acción</TH>
                        <TH>Responsable</TH>
                        <TH>Estado</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {followUps.map((c) => (
                        <TR key={c.id}>
                          <TD className="w-36 text-xs">
                            <FollowUpDate date={c.followUpAt} />
                          </TD>
                          <TD className="max-w-60 truncate font-medium text-ink">
                            <Link href={`/companies/${c.id}`} className="hover:text-accent-700 hover:underline">
                              {c.name}
                            </Link>
                          </TD>
                          <TD className="max-w-96 truncate">{c.nextAction ?? <span className="text-ink-4">Sin definir</span>}</TD>
                          <TD>{c.owner ?? <span className="text-ink-4">Sin asignar</span>}</TD>
                          <TD>
                            <CrmStatusBadge status={c.crmStatus} />
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableContainer>
              )}
            </Panel>
            <PipelineBoard columns={board} />
          </>
        )}
      </PageBody>
    </>
  );
}
