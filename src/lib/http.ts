import "server-only";
import { env } from "./env";

/** Error from an external service, with a message that can be shown to the user. */
export class ExternalServiceError extends Error {
  constructor(
    public readonly service: string,
    message: string,
    public readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(`${service}: ${message}`, options);
    this.name = "ExternalServiceError";
  }
}

export function userAgent(): string {
  const contact = env().OSM_CONTACT_EMAIL;
  return `ProspectLeads/0.1 (+https://github.com/jorh68/Prospect-Leads${contact ? `; ${contact}` : ""})`;
}

interface FetchOptions extends RequestInit {
  service: string;
  timeoutMs?: number;
  /** Extra attempts on network errors, 429 and 5xx */
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch with timeout, retries with backoff and errors that name the service.
 * Returns the Response for any 2xx; throws ExternalServiceError otherwise.
 */
export async function fetchWithRetry(url: string, opts: FetchOptions): Promise<Response> {
  const { service, timeoutMs = 20000, retries = 2, headers, ...init } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": userAgent(), ...headers },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (res.ok) return res;
      const body = await res.text().catch(() => "");
      const err = new ExternalServiceError(service, `HTTP ${res.status} ${body.slice(0, 300)}`.trim(), res.status);
      if (res.status === 429 || res.status >= 500) {
        lastError = err;
        continue;
      }
      throw err;
    } catch (e) {
      if (e instanceof ExternalServiceError) throw e;
      const timedOut = e instanceof DOMException && e.name === "TimeoutError";
      lastError = new ExternalServiceError(
        service,
        timedOut ? `sin respuesta tras ${Math.round(timeoutMs / 1000)} s` : `no se pudo conectar (${(e as Error).message})`,
        undefined,
        { cause: e },
      );
    }
  }
  throw lastError;
}

export async function fetchJson<T>(url: string, opts: FetchOptions): Promise<T> {
  const res = await fetchWithRetry(url, opts);
  try {
    return (await res.json()) as T;
  } catch (e) {
    throw new ExternalServiceError(opts.service, "respuesta no es JSON válido", res.status, { cause: e });
  }
}

/** Message suitable for the UI from any thrown value. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
