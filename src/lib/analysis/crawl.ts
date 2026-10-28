import "server-only";
import { userAgent } from "../http";
import { assertPublicUrl, BlockedUrlError } from "./net-guard";
import { classifyPage, extractPage, type PageExtract } from "./extract";
import type { PageKind } from "./signals";

/**
 * Polite, bounded crawler: the home page plus a few same-site pages that
 * matter commercially (booking, contact, services). Redirects are followed
 * by hand so every hop passes the SSRF guard.
 */

export const CRAWL_LIMITS = {
  maxPages: 5,
  maxBytes: 2_500_000,
  pageTimeoutMs: 15_000,
  totalBudgetMs: 60_000,
  maxRedirects: 5,
};

export interface FetchedPage {
  requestedUrl: string;
  finalUrl: string;
  kind: PageKind;
  status: number | null;
  html: string | null;
  bytes: number | null;
  loadTimeMs: number | null;
  error: string | null;
  /** Network-level failure (DNS, TLS, timeout…), as opposed to an HTTP answer */
  networkError: boolean;
  /** Start of the body of an error response (to recognise anti-bot pages) */
  errorBody: string | null;
}

export interface CrawlResult {
  home: FetchedPage;
  pages: FetchedPage[];
  extracts: PageExtract[];
  redirectsToHttps: boolean | null;
  /** The site answered but refuses automated visits (403/429/challenge) */
  blocked: boolean;
  /**
   * The URL on record is a dead inner page (404/410) but the site's home
   * works; the crawl continued from the home page.
   */
  listedUrlError: { url: string; status: number } | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function browserishHeaders(): Record<string, string> {
  return {
    "User-Agent": `Mozilla/5.0 (compatible; ${userAgent()})`,
    Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.6",
  };
}

export function charsetOf(contentType: string | null, head: Uint8Array): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const sniff = new TextDecoder("latin1").decode(head.slice(0, 4096));
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(sniff)?.[1];
  return (fromMeta ?? "utf-8").toLowerCase();
}

// Node decodes windows-1252 as plain latin1 (0x80–0x9F become control
// characters), which breaks "€", "…", "“" on older Spanish sites.
const CP1252_HIGH = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ";

export function decodeHtml(bytes: Uint8Array, charset: string): string {
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(charset);
  } catch {
    decoder = new TextDecoder("utf-8");
  }
  const text = decoder.decode(bytes);
  if (decoder.encoding !== "windows-1252") return text;
  return text.replace(/[\u0080-\u009f]/g, (c) => CP1252_HIGH[c.charCodeAt(0) - 0x80] ?? c);
}

async function readLimited(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
    if (total >= maxBytes) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  const out = new Uint8Array(Math.min(total, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    const take = Math.min(c.byteLength, out.length - offset);
    out.set(c.subarray(0, take), offset);
    offset += take;
    if (offset >= out.length) break;
  }
  return out;
}

function networkErrorMessage(e: unknown, timeoutMs: number): string {
  if (e instanceof DOMException && e.name === "TimeoutError") return `sin respuesta tras ${Math.round(timeoutMs / 1000)} s`;
  const cause = (e as { cause?: { code?: string; message?: string } })?.cause;
  const code = cause?.code ?? "";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "el dominio no resuelve (DNS)";
  if (code === "ECONNREFUSED") return "conexión rechazada";
  if (code === "ECONNRESET") return "conexión cortada por el servidor";
  if (/CERT|SSL|TLS/i.test(code) || /certificate/i.test(cause?.message ?? "")) return "certificado HTTPS no válido";
  return `no se pudo conectar (${code || (e as Error)?.message || "error de red"})`;
}

const META_REFRESH = /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["']?\s*\d+\s*;\s*url=['"]?([^"'>\s]+)/i;
const JS_REDIRECT = /location(?:\.href)?\s*=\s*["']([^"']+)["']|location\.replace\(\s*["']([^"']+)["']\s*\)/i;

/**
 * Target of a stub page that only redirects with a meta refresh or a line of
 * JavaScript (common on parked domains and old hosting). Large pages are real
 * content, so they are never treated as redirects.
 */
export function softRedirectTarget(html: string): string | null {
  if (html.length > 4000) return null;
  const m = META_REFRESH.exec(html) ?? JS_REDIRECT.exec(html);
  const target = m?.[1] ?? m?.[2] ?? null;
  return target && !/^(javascript|data):/i.test(target) ? target : null;
}

/** GET a page following redirects manually (each hop checked by the SSRF guard). */
export async function fetchPage(url: string, kind: PageKind, timeoutMs = CRAWL_LIMITS.pageTimeoutMs): Promise<FetchedPage> {
  const started = Date.now();
  let current = url;
  const base = { requestedUrl: url, kind };
  try {
    for (let hop = 0; hop <= CRAWL_LIMITS.maxRedirects; hop++) {
      await assertPublicUrl(current);
      const res = await fetch(current, {
        redirect: "manual",
        headers: browserishHeaders(),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        await res.body?.cancel().catch(() => {});
        current = new URL(location, current).toString();
        continue;
      }
      const contentType = res.headers.get("content-type");
      const isHtml = !contentType || /html|xml/i.test(contentType);
      const bytes = isHtml ? await readLimited(res, CRAWL_LIMITS.maxBytes) : null;
      if (!isHtml) await res.body?.cancel().catch(() => {});
      const html = bytes ? decodeHtml(bytes, charsetOf(contentType, bytes)) : null;
      const soft = res.ok && html ? softRedirectTarget(html) : null;
      if (soft) {
        current = new URL(soft, current).toString();
        continue;
      }
      return {
        ...base,
        finalUrl: current,
        status: res.status,
        html: res.ok ? html : null,
        bytes: bytes?.byteLength ?? null,
        loadTimeMs: Date.now() - started,
        error: res.ok ? (isHtml ? null : `no es una página HTML (${contentType})`) : `HTTP ${res.status}`,
        networkError: false,
        errorBody: res.ok ? null : (html?.slice(0, 5000) ?? null),
      };
    }
    return { ...base, finalUrl: current, status: null, html: null, bytes: null, loadTimeMs: null, error: "demasiadas redirecciones", networkError: false, errorBody: null };
  } catch (e) {
    const blocked = e instanceof BlockedUrlError;
    return {
      ...base,
      finalUrl: current,
      status: null,
      html: null,
      bytes: null,
      loadTimeMs: null,
      error: blocked ? e.message : networkErrorMessage(e, timeoutMs),
      networkError: !blocked,
      errorBody: null,
    };
  }
}

const KIND_PRIORITY: Record<PageKind, number> = { booking: 0, contact: 1, services: 2, other: 9, home: 9 };

/** Same-site pages worth visiting, best first, one per kind-ish. */
export function pickSubpages(home: PageExtract, homeUrl: string, max: number): { url: string; kind: PageKind }[] {
  const seen = new Set<string>([normalizePath(homeUrl)]);
  const candidates: { url: string; kind: PageKind; priority: number }[] = [];
  for (const link of home.internalLinks) {
    if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4)(\?|$)/i.test(link.href)) continue;
    const key = normalizePath(link.href);
    if (seen.has(key)) continue;
    seen.add(key);
    const kind = classifyPage(link.href, link.text);
    if (kind === "other" || kind === "home") continue;
    candidates.push({ url: link.href, kind, priority: KIND_PRIORITY[kind] });
  }
  candidates.sort((a, b) => a.priority - b.priority);
  // At most 2 of each kind so one menu full of services doesn't use the budget.
  const perKind = new Map<PageKind, number>();
  const out: { url: string; kind: PageKind }[] = [];
  for (const c of candidates) {
    const n = perKind.get(c.kind) ?? 0;
    if (n >= 2) continue;
    perKind.set(c.kind, n + 1);
    out.push({ url: c.url, kind: c.kind });
    if (out.length >= max) break;
  }
  return out;
}

function normalizePath(u: string): string {
  try {
    const url = new URL(u);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return u;
  }
}

const CHALLENGE = /(cf-chl|just a moment|attention required|captcha|access denied|acceso denegado|ddos protection)/i;

function looksBlocked(page: FetchedPage): boolean {
  if (page.status == null) return false;
  if ([401, 403, 406, 429, 451].includes(page.status)) return true;
  return page.status === 503 && CHALLENGE.test(page.errorBody ?? "");
}

async function checkHttpsRedirect(finalUrl: string): Promise<boolean | null> {
  try {
    const u = new URL(finalUrl);
    if (u.protocol !== "https:") return false;
    const httpUrl = `http://${u.host}/`;
    await assertPublicUrl(httpUrl);
    const res = await fetch(httpUrl, {
      redirect: "manual",
      headers: browserishHeaders(),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    await res.body?.cancel().catch(() => {});
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) return new URL(location, httpUrl).protocol === "https:";
    return false;
  } catch {
    return null; // port 80 closed or unreachable: can't tell
  }
}

export async function crawlSite(startUrl: string): Promise<CrawlResult> {
  const deadline = Date.now() + CRAWL_LIMITS.totalBudgetMs;
  let home = await fetchPage(startUrl, "home");

  if (home.networkError) {
    // Transient failures are common: retry once, then try the other scheme.
    await sleep(1500);
    home = await fetchPage(startUrl, "home");
    if (home.networkError) {
      const alt = startUrl.startsWith("https:") ? startUrl.replace(/^https:/, "http:") : startUrl.replace(/^http:/, "https:");
      const second = await fetchPage(alt, "home");
      if (!second.networkError) home = second;
    }
  }

  // Listings often keep an old inner URL (a chain's branch page, a moved
  // section). A 404 there says nothing about the site as a whole.
  let listedUrlError: CrawlResult["listedUrlError"] = null;
  if (!home.html && (home.status === 404 || home.status === 410)) {
    const root = siteRoot(home.finalUrl);
    if (root && normalizePath(root) !== normalizePath(home.finalUrl)) {
      const rootPage = await fetchPage(root, "home");
      if (rootPage.html) {
        listedUrlError = { url: startUrl, status: home.status };
        home = rootPage;
      }
    }
  }

  const blocked = looksBlocked(home);
  if (!home.html) return { home, pages: [home], extracts: [], redirectsToHttps: null, blocked, listedUrlError };

  const homeExtract = extractPage(home.html, home.finalUrl);
  const pages: FetchedPage[] = [home];
  const extracts: PageExtract[] = [homeExtract];

  for (const sub of pickSubpages(homeExtract, home.finalUrl, CRAWL_LIMITS.maxPages - 1)) {
    if (Date.now() > deadline) break;
    await sleep(300);
    const page = await fetchPage(sub.url, sub.kind);
    pages.push(page);
    if (page.html) extracts.push(extractPage(page.html, page.finalUrl));
  }

  const redirectsToHttps = startUrl.startsWith("http:") && home.finalUrl.startsWith("https:")
    ? true
    : await checkHttpsRedirect(home.finalUrl);

  return { home, pages, extracts, redirectsToHttps, blocked, listedUrlError };
}

function siteRoot(u: string): string | null {
  try {
    return `${new URL(u).origin}/`;
  } catch {
    return null;
  }
}

// ── Connectivity of this server ──

let connectivity: { ok: boolean; at: number } | null = null;

/**
 * Whether this server can reach the internet at all. Used to tell "the
 * company's website is down" apart from "we have no network", so a sandbox
 * or proxy never produces false findings about a company.
 */
export async function hasInternetAccess(): Promise<boolean> {
  if (connectivity && Date.now() - connectivity.at < 60_000) return connectivity.ok;
  const probes = ["https://www.google.com/generate_204", "https://www.cloudflare.com/cdn-cgi/trace"];
  let ok = false;
  for (const url of probes) {
    try {
      const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(6000), cache: "no-store" });
      await res.body?.cancel().catch(() => {});
      ok = true;
      break;
    } catch {
      // try next probe
    }
  }
  connectivity = { ok, at: Date.now() };
  return ok;
}
