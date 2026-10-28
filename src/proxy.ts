import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authConfig, authMode, verifySessionToken } from "@/lib/auth/session";

const PUBLIC_PATHS = new Set(["/login", "/api/health"]);

/** Requires a valid session (see src/lib/auth/session.ts) for every page, action and API route. */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const config = authConfig();
  const mode = authMode(config);
  if (mode === "open") return NextResponse.next();
  if (mode === "enabled" && verifySessionToken(config, request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado: inicia sesión." }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
