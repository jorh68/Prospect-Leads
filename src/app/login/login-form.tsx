"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/progress";

const initial: LoginFormState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="next" value={next} />
      <Field label="Contraseña" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.error)}
          required
          autoFocus
        />
      </Field>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending && <Spinner />}
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
