import { describe, expect, it } from "vitest";
import {
  SESSION_MAX_AGE_SECONDS,
  authConfig,
  authMode,
  checkPassword,
  createSessionToken,
  safeNextPath,
  verifySessionToken,
} from "@/lib/auth/session";
import { clearLoginFailures, loginBlockedFor, recordLoginFailure } from "@/lib/auth/rate-limit";

const config = authConfig({ NODE_ENV: "production", APP_PASSWORD: "correcto-123", AUTH_SECRET: "s3cret" });

describe("authMode", () => {
  it("is open in development without a password", () => {
    expect(authMode(authConfig({ NODE_ENV: "development" }))).toBe("open");
  });
  it("fails closed in production without a password", () => {
    expect(authMode(authConfig({ NODE_ENV: "production", APP_PASSWORD: "  " }))).toBe("locked");
  });
  it("requires login when a password is set", () => {
    expect(authMode(config)).toBe("enabled");
  });
});

describe("password and session token", () => {
  it("accepts only the exact password", () => {
    expect(checkPassword(config, "correcto-123")).toBe(true);
    expect(checkPassword(config, "correcto-12")).toBe(false);
    expect(checkPassword(config, "")).toBe(false);
    expect(checkPassword(authConfig({ NODE_ENV: "production" }), "")).toBe(false);
  });

  it("verifies its own tokens until they expire", () => {
    const now = 1_800_000_000_000;
    const token = createSessionToken(config, now);
    expect(verifySessionToken(config, token, now + 1000)).toBe(true);
    expect(verifySessionToken(config, token, now + SESSION_MAX_AGE_SECONDS * 1000 + 1)).toBe(false);
  });

  it("rejects tampered, foreign or empty tokens", () => {
    const now = 1_800_000_000_000;
    const token = createSessionToken(config, now);
    const [v, exp, sig] = token.split(".");
    expect(verifySessionToken(config, `${v}.${Number(exp) + 1}.${sig}`, now)).toBe(false);
    expect(verifySessionToken(config, `${token}x`, now)).toBe(false);
    expect(verifySessionToken(config, undefined, now)).toBe(false);
    expect(verifySessionToken(config, "v1.abc.def", now)).toBe(false);
    const otherPassword = authConfig({ NODE_ENV: "production", APP_PASSWORD: "otra", AUTH_SECRET: "s3cret" });
    expect(verifySessionToken(otherPassword, token, now)).toBe(false);
    const otherSecret = authConfig({ NODE_ENV: "production", APP_PASSWORD: "correcto-123", AUTH_SECRET: "x" });
    expect(verifySessionToken(otherSecret, token, now)).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths and rejects the rest", () => {
    expect(safeNextPath("/companies?q=1")).toBe("/companies?q=1");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("/login?next=/x")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});

describe("login rate limit", () => {
  it("blocks after repeated failures and resets on success", () => {
    const key = "test-ip";
    const now = 1_800_000_000_000;
    for (let i = 0; i < 8; i++) recordLoginFailure(key, now);
    expect(loginBlockedFor(key, now + 1000)).toBeGreaterThan(0);
    expect(loginBlockedFor(key, now + 16 * 60 * 1000)).toBe(0);
    clearLoginFailures(key);
    expect(loginBlockedFor(key, now)).toBe(0);
  });
});
