import { db } from "@/lib/db";
import { CrmStatusBadge } from "@/components/domain/badges";
import { Panel } from "@/components/ui/panel";
import { formatDate } from "@/lib/format";

/*
 * PLACEHOLDER added by module B so the company page builds before module C
 * lands. Module C owns this file (ARCHITECTURE.md § 10) and replaces it
 * wholesale with the editable panel; keep the export: CrmPanel({ companyId }).
 */
export async function CrmPanel({ companyId }: { companyId: string }) {
  const c = await db.company.findUnique({
    where: { id: companyId },
    select: { crmStatus: true, owner: true, nextAction: true, followUpAt: true },
  });
  if (!c) return null;
  const rows: [string, React.ReactNode][] = [
    ["Estado", <CrmStatusBadge key="s" status={c.crmStatus} />],
    ["Responsable", c.owner],
    ["Próxima acción", c.nextAction],
    ["Seguimiento", c.followUpAt ? formatDate(c.followUpAt) : null],
  ];
  return (
    <Panel title="Seguimiento comercial">
      <dl className="divide-y divide-line">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 px-4 py-2 text-[13px]">
            <dt className="text-ink-3">{label}</dt>
            <dd className="text-ink">{value ?? <span className="text-ink-4">—</span>}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
