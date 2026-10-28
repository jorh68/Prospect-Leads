import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Single-user password protection.
 *
 * The app is protected by one shared password (APP_PASSWORD). A successful
 * login sets an HttpOnly cookie holding `v1.<expiresAt>.<hmac>`, signed with a
 * key derived from AUTH_SECRET and APP_PASSWORD, so changing the password logs
 * every browser out. Without APP_PASSWORD the app is open in development and
 * locked in production (fail closed).
 *
 * No `server-only` import: this module is shared by `src/proxy.ts`, server
 * actions and tests.
 */

export const SESSION_COOKIE = "pl_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface AuthConfig {
  password: string | null;
  secret: string | null;
  production: boolean;
}

export function authConfig(source: NodeJS.ProcessEnv = process.env): AuthConfig {
  const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
  return {
    password: clean(source.APP_PASSWORD),
    secret: clean(source.AUTH_SECRET),
    production: source.NODE_ENV === "production",
  };
}

/** "open": no password in development; "locked": no password in production; "enabled": login required. */
export function authMode(config: AuthConfig): "open" | "locked" | "enabled" {
  if (config.password) return "enabled";
  return config.production ? "locked" : "open";
}

function signingKey(config: AuthConfig): Buffer {
  return createHash("sha256")
    .update(`prospect-leads-session\0${config.secret ?? ""}\0${config.password ?? ""}`)
    .digest();
}

function mac(config: AuthConfig, payload: string): string {
  return createHmac("sha256", signingKey(config)).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  // Hash first so the comparison is constant-time regardless of length.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(config: AuthConfig, candidate: string): boolean {
  if (!config.password) return false;
  return safeEqual(candidate, config.password);
}

export function createSessionToken(config: AuthConfig, now = Date.now()): string {
  const payload = `v1.${now + SESSION_MAX_AGE_SECONDS * 1000}`;
  return `${payload}.${mac(config, payload)}`;
}

export function verifySessionToken(config: AuthConfig, token: string | undefined | null, now = Date.now()): boolean {
  if (!config.password || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
  return safeEqual(parts[2], mac(config, `${parts[0]}.${parts[1]}`));
}

/** Only same-site paths are allowed as post-login destinations. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.startsWith("/login")) return "/";
  return value;
}
