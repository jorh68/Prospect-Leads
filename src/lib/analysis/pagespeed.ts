import "server-only";
import { env, integrations } from "../env";
import { errorMessage, fetchJson } from "../http";
import type { PageSpeedSignal } from "./signals";

/**
 * Google PageSpeed Insights (Lighthouse, mobile). Optional: only runs when
 * PAGESPEED_API_KEY is set; otherwise speed and mobile UX are judged from
 * the HTML alone and the analysis says so.
 */

interface PsiResponse {
  lighthouseResult?: {
    categories?: Record<string, { score: number | null } | undefined>;
    audits?: Record<string, { numericValue?: number } | undefined>;
  };
}

const pct = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100));
const num = (v: number | undefined) => (v == null ? null : Math.round(v * 1000) / 1000);

export function parsePageSpeed(data: PsiResponse, fetchedAt = new Date()): PageSpeedSignal {
  const cat = data.lighthouseResult?.categories ?? {};
  const audits = data.lighthouseResult?.audits ?? {};
  return {
    strategy: "mobile",
    performance: pct(cat.performance?.score),
    accessibility: pct(cat.accessibility?.score),
    seo: pct(cat.seo?.score),
    bestPractices: pct(cat["best-practices"]?.score),
    lcpMs: num(audits["largest-contentful-paint"]?.numericValue),
    cls: num(audits["cumulative-layout-shift"]?.numericValue),
    tbtMs: num(audits["total-blocking-time"]?.numericValue),
    fetchedAt: fetchedAt.toISOString(),
  };
}

export async function runPageSpeed(url: string): Promise<{ result: PageSpeedSignal | null; error: string | null }> {
  if (!integrations.pageSpeed()) return { result: null, error: null };
  const qs = new URLSearchParams({ url, strategy: "mobile", key: env().PAGESPEED_API_KEY! });
  for (const c of ["performance", "accessibility", "seo", "best-practices"]) qs.append("category", c);
  try {
    const data = await fetchJson<PsiResponse>(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`, {
      service: "PageSpeed Insights",
      timeoutMs: 90_000,
      retries: 1,
    });
    return { result: parsePageSpeed(data), error: null };
  } catch (e) {
    console.warn(`[analysis] PageSpeed Insights falló para ${url}: ${errorMessage(e)}`);
    return { result: null, error: errorMessage(e).replace(env().PAGESPEED_API_KEY!, "***") };
  }
}
