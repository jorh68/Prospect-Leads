"use client";

import { useState, useTransition } from "react";
import { setCrmStatusAction } from "@/lib/crm/actions";
import { CRM_STATUSES, CRM_STATUS_LABELS } from "@/lib/domain/constants";
import { Select } from "@/components/ui/form";
import { Spinner } from "@/components/ui/progress";
import { cn } from "@/lib/cn";

/** CRM status dropdown that saves on change. */
export function CrmStatusSelect({
  companyId,
  status,
  id,
  className,
  size = "md",
}: {
  companyId: string;
  status: string;
  id?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [value, setValue] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Follow server-side changes (another tab, bulk action) after a refresh.
  const [lastStatus, setLastStatus] = useState(status);
  if (status !== lastStatus) {
    setLastStatus(status);
    setValue(status);
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div className="relative">
        <Select
          id={id}
          aria-label={id ? undefined : "Estado del CRM"}
          value={value}
          disabled={pending}
          className={cn(size === "sm" && "h-7 text-xs")}
          onChange={(e) => {
            const next = e.target.value;
            const prev = value;
            setValue(next);
            setError(null);
            start(async () => {
              const r = await setCrmStatusAction(companyId, next);
              if (!r.ok) {
                setValue(prev);
                setError(r.error);
              }
            });
          }}
        >
          {CRM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CRM_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        {pending && <Spinner className="pointer-events-none absolute top-1/2 right-7 -translate-y-1/2 text-ink-4" />}
      </div>
      {error && <p className="mt-1 text-xs text-danger-600" role="alert">{error}</p>}
    </div>
  );
}
