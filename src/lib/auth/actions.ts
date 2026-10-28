"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearLoginFailures, loginBlockedFor, recordLoginFailure } from "./rate-limit";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  authConfig,
  authMode,
  checkPassword,
  createSessionToken,
  safeNextPath,
} from "./session";

export interface LoginFormState {
  error: string | null;
}

async function clientKey(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function loginAction(_prev: LoginFormState, formData: FormData): Promise<LoginFormState> {
  const config = authConfig();
  const mode = authMode(config);
  if (mode === "open") redirect("/");
  if (mode === "locked") {
    return { error: "El acceso está bloqueado: falta configurar la variable APP_PASSWORD en el servidor." };
  }

  const key = await clientKey();
  const waitMs = loginBlockedFor(key);
  if (waitMs > 0) {
    return { error: `Demasiados intentos fallidos. Vuelve a intentarlo en ${Math.ceil(waitMs / 60000)} min.` };
  }

  const password = String(formData.get("password") ?? "");
  if (!checkPassword(config, password)) {
    recordLoginFailure(key);
    console.warn(`[auth] intento de acceso fallido desde ${key}`);
    return { error: "Contraseña incorrecta." };
  }

  clearLoginFailures(key);
  (await cookies()).set(SESSION_COOKIE, createSessionToken(config), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.production,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(safeNextPath(formData.get("next")));
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
