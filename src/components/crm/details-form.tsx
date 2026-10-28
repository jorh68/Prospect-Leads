"use client";

import { useActionState, useState } from "react";
import { updateCrmDetailsAction, type CrmDetailsState } from "@/lib/crm/actions";
import { toDateInputValue } from "@/lib/crm/dates";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/progress";

const initial: CrmDetailsState = { error: null, fieldErrors: {}, savedCount: 0 };

/** Owner, next action and follow-up date, saved together. */
export function CrmDetailsForm({
  companyId,
  owner,
  nextAction,
  followUpAt,
  owners,
}: {
  companyId: string;
  owner: string | null;
  nextAction: string | null;
  followUpAt: string | null;
  owners: string[];
}) {
  const [state, action, pending] = useActionState(updateCrmDetailsAction.bind(null, companyId), initial);
  // Controlled so a failed validation keeps what the user typed (React resets
  // uncontrolled fields after every form action). When the stored values
  // change (after a save or a refresh) the inputs follow them.
  const stored = { owner: owner ?? "", nextAction: nextAction ?? "", followUpAt: toDateInputValue(followUpAt) };
  const storedKey = `${stored.owner}|${stored.nextAction}|${stored.followUpAt}`;
  const [values, setValues] = useState(stored);
  const [lastKey, setLastKey] = useState(storedKey);
  if (storedKey !== lastKey) {
    setLastKey(storedKey);
    setValues(stored);
  }
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const dirty =
    values.owner !== stored.owner || values.nextAction !== stored.nextAction || values.followUpAt !== stored.followUpAt;
  const listId = `crm-owners-${companyId}`;

  return (
    <form action={action} className="space-y-3">
      <Field label="Responsable" htmlFor={`crm-owner-${companyId}`} error={state.fieldErrors.owner}>
        <Input
          id={`crm-owner-${companyId}`}
          name="owner"
          value={values.owner}
          onChange={set("owner")}
          list={owners.length ? listId : undefined}
          placeholder="Sin asignar"
          maxLength={80}
          autoComplete="off"
          aria-invalid={Boolean(state.fieldErrors.owner)}
        />
        {owners.length > 0 && (
          <datalist id={listId}>
            {owners.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        )}
      </Field>
      <Field label="Próxima acción" htmlFor={`crm-next-${companyId}`} error={state.fieldErrors.nextAction}>
        <Textarea
          id={`crm-next-${companyId}`}
          name="nextAction"
          rows={2}
          value={values.nextAction}
          onChange={set("nextAction")}
          placeholder="Ej.: Llamar para presentar el análisis"
          maxLength={300}
          aria-invalid={Boolean(state.fieldErrors.nextAction)}
        />
      </Field>
      <Field label="Fecha de seguimiento" htmlFor={`crm-date-${companyId}`} error={state.fieldErrors.followUpAt}>
        <Input
          id={`crm-date-${companyId}`}
          name="followUpAt"
          type="date"
          value={values.followUpAt}
          onChange={set("followUpAt")}
          aria-invalid={Boolean(state.fieldErrors.followUpAt)}
        />
      </Field>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant={dirty ? "primary" : "secondary"} disabled={pending}>
          {pending && <Spinner />}
          {pending ? "Guardando…" : "Guardar seguimiento"}
        </Button>
        {state.savedCount > 0 && !dirty && !pending && (
          <span className="text-xs text-success-700" role="status">
            Guardado
          </span>
        )}
      </div>
    </form>
  );
}
