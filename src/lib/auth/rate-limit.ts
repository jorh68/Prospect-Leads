/**
 * In-memory limiter for failed logins (one server process, see ARCHITECTURE).
 * After MAX_FAILURES within WINDOW_MS a client must wait until the window ends.
 */
const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;

const failures = new Map<string, { count: number; resetAt: number }>();

/** Milliseconds the client still has to wait, or 0 if it may try. */
export function loginBlockedFor(key: string, now = Date.now()): number {
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= now) return 0;
  return entry.count >= MAX_FAILURES ? entry.resetAt - now : 0;
}

export function recordLoginFailure(key: string, now = Date.now()): void {
  const entry = failures.get(key);
  if (!entry || entry.resetAt <= now) {
    failures.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
  if (failures.size > 10_000) {
    for (const [k, v] of failures) if (v.resetAt <= now) failures.delete(k);
  }
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}
