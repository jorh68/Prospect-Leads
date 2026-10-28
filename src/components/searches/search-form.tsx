"use client";

import { useActionState } from "react";
import { createSearchAction, type SearchFormState } from "@/app/searches/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/progress";
import { MAX_SEARCH_COUNT } from "@/lib/domain/constants";

const initial: SearchFormState = { error: null, fieldErrors: {}, values: { niche: "", location: "", count: "25" } };

export function SearchForm() {
  const [state, action, pending] = useActionState(createSearchAction, initial);

  return (
    <form action={action} className="space-y-3 p-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_8rem_auto] md:items-start">
        <Field label="Tipo de negocio" htmlFor="niche" error={state.fieldErrors.niche}>
          <Input
            id="niche"
            name="niche"
            placeholder="Clínicas dentales"
            defaultValue={state.values.niche}
            aria-invalid={Boolean(state.fieldErrors.niche)}
            required
            autoComplete="off"
          />
        </Field>
        <Field label="Ciudad o zona" htmlFor="location" error={state.fieldErrors.location}>
          <Input
            id="location"
            name="location"
            placeholder="Madrid"
            defaultValue={state.values.location}
            aria-invalid={Boolean(state.fieldErrors.location)}
            required
            autoComplete="off"
          />
        </Field>
        <Field label="Nº de empresas" htmlFor="count" error={state.fieldErrors.count}>
          <Input
            id="count"
            name="count"
            type="number"
            min={1}
            max={MAX_SEARCH_COUNT}
            defaultValue={state.values.count}
            aria-invalid={Boolean(state.fieldErrors.count)}
            required
          />
        </Field>
        <div className="md:pt-[1.375rem]">
          <Button type="submit" variant="primary" disabled={pending} className="w-full md:w-auto">
            {pending && <Spinner />}
            {pending ? "Creando…" : "Buscar empresas"}
          </Button>
        </div>
      </div>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
    </form>
  );
}
