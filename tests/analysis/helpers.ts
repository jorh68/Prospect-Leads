/** Builds crawl results from the saved HTML fixtures (fictional businesses). */
import { readFileSync } from "node:fs";
import { extractPage } from "@/lib/analysis/extract";
import type { CrawlResult, FetchedPage } from "@/lib/analysis/crawl";
import type { CompanyContext } from "@/lib/analysis/collect";
import type { PageKind } from "@/lib/analysis/signals";

export function fixture(name: string, encoding: BufferEncoding = "utf8"): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), encoding);
}

export function page(url: string, html: string | null, kind: PageKind, extra: Partial<FetchedPage> = {}): FetchedPage {
  return {
    requestedUrl: url,
    finalUrl: url,
    kind,
    status: html ? 200 : null,
    html,
    bytes: html ? Buffer.byteLength(html) : null,
    loadTimeMs: html ? 420 : null,
    error: html ? null : "sin respuesta tras 15 s",
    networkError: !html,
    errorBody: null,
    ...extra,
  };
}

export function crawlOf(pages: FetchedPage[], redirectsToHttps: boolean | null = true): CrawlResult {
  return {
    home: pages[0]!,
    pages,
    extracts: pages.filter((p) => p.html).map((p) => extractPage(p.html!, p.finalUrl)),
    redirectsToHttps,
    blocked: false,
    listedUrlError: null,
  };
}

export function context(overrides: Partial<CompanyContext> = {}): CompanyContext {
  return {
    id: "c1",
    name: "Clínica Dental Ejemplo",
    niche: "Clínicas dentales",
    category: "dentist",
    city: "Madrid",
    website: "https://dental-ejemplo.test/",
    phone: "+34912345678",
    email: null,
    rating: null,
    reviewCount: null,
    ratingSource: null,
    openingHours: "Mo-Fr 09:00-14:00,16:00-20:00",
    businessStatus: "operational",
    socials: [],
    ...overrides,
  };
}

export const dentalCrawl = () =>
  crawlOf([
    page("https://dental-ejemplo.test/", fixture("dental-home.html"), "home"),
    page("https://dental-ejemplo.test/contacto/", fixture("dental-contacto.html"), "contact"),
  ]);

export const fisioCrawl = () =>
  crawlOf([
    page("https://fisio-ejemplo.test/", fixture("fisio-home.html"), "home"),
    page("https://fisio-ejemplo.test/reservar-cita", fixture("fisio-reservar.html"), "booking"),
  ]);
