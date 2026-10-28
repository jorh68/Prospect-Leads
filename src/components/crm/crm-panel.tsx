import { crmPanelData } from "@/lib/crm/queries";
import { Panel } from "@/components/ui/panel";
import { formatRelative } from "@/lib/format";
import { CrmStatusSelect } from "./status-select";
import { CrmDetailsForm } from "./details-form";
import { CrmNotes } from "./notes";

/**
 * CRM block for the company page (module B embeds it in a ~320px column).
 * Status saves on change; owner / next action / follow-up save together;
 * notes are added, edited and deleted inline. Everything is persisted and
 * logged to the activity feed.
 */
export async function CrmPanel({ companyId }: { companyId: string }) {
  const data = await crmPanelData(companyId);
  if (!data) return null;
  const { company, notes, history, owners } = data;

  return (
    <Panel title="Seguimiento comercial">
      <div className="space-y-4 p-4">
        <div className="space-y-1.5">
          <label htmlFor={`crm-status-${company.id}`} className="block text-xs font-medium text-ink-2">
            Estado
          </label>
          <CrmStatusSelect id={`crm-status-${company.id}`} companyId={company.id} status={company.crmStatus} />
        </div>
        <CrmDetailsForm
          companyId={company.id}
          owner={company.owner}
          nextAction={company.nextAction}
          followUpAt={company.followUpAt?.toISOString() ?? null}
          owners={owners}
        />
      </div>

      <div className="border-t border-line">
        <CrmNotes
          companyId={company.id}
          notes={notes.map((n) => ({
            id: n.id,
            body: n.body,
            createdAt: n.createdAt.toISOString(),
            edited: n.updatedAt.getTime() - n.createdAt.getTime() > 1000,
          }))}
        />
      </div>

      {history.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-3">Historial</h3>
          <ol className="mt-2 space-y-1.5">
            {history.map((a) => (
              <li key={a.id} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 break-words text-ink-2">{a.message}</span>
                <time dateTime={a.createdAt.toISOString()} className="shrink-0 text-ink-4">
                  {formatRelative(a.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Panel>
  );
}
