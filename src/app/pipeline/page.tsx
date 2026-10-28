import type { Metadata } from "next";
import { db } from "@/lib/db";
import { CRM_STATUSES, CRM_STATUS_LABELS } from "@/lib/domain/constants";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CrmStatusBadge } from "@/components/domain/badges";

export const metadata: Metadata = { title: "Pipeline" };

/*
 * Pipeline / CRM — OWNED BY THREAD C.
 * Foundation version: company count per CRM status.
 */
export default async function PipelinePage() {
  const groups = await db.company.groupBy({ by: ["crmStatus"], _count: { _all: true } });
  const counts = new Map(groups.map((g) => [g.crmStatus, g._count._all]));

  return (
    <>
      <PageHeader title="Pipeline" description="Estado comercial de las empresas que estás trabajando." />
      <PageBody>
        <Panel title="Empresas por estado">
          <TableContainer>
            <Table>
              <THead>
                <tr>
                  <TH>Estado</TH>
                  <TH className="text-right">Empresas</TH>
                </tr>
              </THead>
              <TBody>
                {CRM_STATUSES.map((s) => (
                  <TR key={s}>
                    <TD>
                      <CrmStatusBadge status={s} />
                      <span className="sr-only">{CRM_STATUS_LABELS[s]}</span>
                    </TD>
                    <TD className="text-right tabular-nums">{counts.get(s) ?? 0}</TD>
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
