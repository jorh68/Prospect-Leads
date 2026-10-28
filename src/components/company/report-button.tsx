"use client";

import { useActionState } from "react";
import { createReportAction, type ReportActionState } from "@/lib/reports/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/progress";

/** Freezes a new report snapshot and opens it. Errors show inline. */
export function GenerateReportButton({
  companyId,
  disabled,
  variant = "secondary",
  label = "Generar informe",
}: {
  companyId: string;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  label?: string;
}) {
  const [state, action, pending] = useActionState(createReportAction.bind(null, companyId), { error: null } as ReportActionState);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <Button type="submit" size="sm" variant={variant} disabled={disabled || pending}>
        {pending && <Spinner />}
        {pending ? "Generando…" : label}
      </Button>
      {state.error && <p className="max-w-64 text-right text-xs text-danger-600">{state.error}</p>}
    </form>
  );
}
