import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { authConfig, authMode, safeNextPath } from "@/lib/auth/session";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Acceso" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const mode = authMode(authConfig());
  if (mode === "open") redirect("/");
  const next = safeNextPath((await searchParams).next);

  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
          <span className="grid size-7 place-items-center rounded-md bg-ink text-[12px] font-bold text-white">PL</span>
          Prospect Leads
        </div>
        <div className="rounded-lg border border-line bg-surface p-5 shadow-xs">
          <h1 className="text-[15px] font-semibold text-ink">Iniciar sesión</h1>
          <p className="mt-1 text-[13px] text-ink-3">Introduce la contraseña de acceso para continuar.</p>
          {mode === "locked" ? (
            <Alert tone="danger" className="mt-4" title="Acceso bloqueado">
              Falta configurar la variable APP_PASSWORD en el servidor.
            </Alert>
          ) : (
            <LoginForm next={next} />
          )}
        </div>
      </div>
    </div>
  );
}
