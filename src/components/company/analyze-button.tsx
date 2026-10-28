import { analyzeCompanyAction } from "@/lib/analysis/actions";
import { SubmitButton } from "./submit-button";

/** Queues an analysis of the company (module A's server action). */
export function AnalyzeButton({
  companyId,
  status,
  variant = "secondary",
}: {
  companyId: string;
  status: string;
  variant?: "primary" | "secondary";
}) {
  const busy = status === "queued" || status === "running";
  const label = status === "none" ? "Analizar empresa" : status === "failed" ? "Reintentar análisis" : "Volver a analizar";
  return (
    <form action={analyzeCompanyAction.bind(null, companyId)}>
      <SubmitButton size="sm" variant={variant} disabled={busy} pendingLabel="Encolando…">
        {busy ? "Analizando…" : label}
      </SubmitButton>
    </form>
  );
}
