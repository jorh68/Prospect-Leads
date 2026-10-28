/**
 * Merges the company record and the crawled pages into one AnalysisSignals
 * object. Pure (no I/O) so the whole interpretation can be unit-tested.
 */
import type { SocialPlatform } from "../domain/constants";
import { extractDomain, isOwnWebsite, normalizeUrl } from "../text";
import type { CrawlResult } from "./crawl";
import { dedupePhones, type PageExtract } from "./extract";
import { siteIdentityMismatch } from "./identity";
import type { AnalysisSignals, PageSpeedSignal, VendorHit } from "./signals";
import type { VendorGroup } from "./vendors";
import { ANALYSIS_VERSION } from "./version";

/** What the analysis knows about the company before visiting its website. */
export interface CompanyContext {
  id: string;
  name: string;
  niche: string | null;
  category: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  rating: number | null;
  reviewCount: number | null;
  /** provider of rating/reviewCount (e.g. "google_places") */
  ratingSource: string | null;
  openingHours: string | string[] | null;
  businessStatus: string | null;
  socials: { platform: SocialPlatform; url: string; source: string }[];
}

export interface SiteInput {
  crawl: CrawlResult | null;
  pageSpeed: PageSpeedSignal | null;
  pageSpeedError: string | null;
}

const uniq = <T>(xs: T[]) => [...new Set(xs)];

function vendorHits(extracts: PageExtract[], group: VendorGroup): VendorHit[] {
  const byName = new Map<string, VendorHit>();
  for (const p of extracts) {
    for (const m of p.vendors) {
      if (m.vendor.group === group && !byName.has(m.vendor.name)) {
        byName.set(m.vendor.name, { name: m.vendor.name, evidence: m.evidence, page: p.url });
      }
    }
  }
  return [...byName.values()];
}

function pickValueProposition(home: PageExtract | undefined, companyName: string): string | null {
  if (!home) return null;
  const h1 = home.h1.find((t) => t.length >= 3 && t.length <= 160);
  if (h1) return h1;
  if (home.heroText) return home.heroText;
  const title = home.title?.split(/[|–—-]/)[0]?.trim();
  return title && title.toLowerCase() !== companyName.toLowerCase() ? title : null;
}

/** " («Error de la base de datos»)" — what the visitor sees on an error page. */
function errorPageTitle(body: string | null): string {
  const title = body ? /<title[^>]*>([^<]{3,120})<\/title>/i.exec(body)?.[1]?.replace(/\s+/g, " ").trim() : null;
  return title ? ` («${title}»)` : "";
}

export function buildSignals(ctx: CompanyContext, site: SiteInput): AnalysisSignals {
  const rawUrl = normalizeUrl(ctx.website);
  const provided = rawUrl != null && isOwnWebsite(rawUrl);
  const crawl = provided ? site.crawl : null;
  // A site that belongs to another business is not evidence about this one:
  // none of its content, contacts or gaps are used.
  const mismatch = crawl?.home.html && !crawl.extracts[0]?.hints.parked ? siteIdentityMismatch(ctx, crawl.extracts) : null;
  const extracts = mismatch ? [] : (crawl?.extracts ?? []);
  const home = extracts[0];
  const limitations: string[] = [];

  const finalUrl = crawl?.home.finalUrl ?? null;
  const reachable = Boolean(crawl?.home.html) && !mismatch;
  const https = finalUrl ? finalUrl.startsWith("https:") : null;

  const ctas = extracts.flatMap((p) => p.ctas);
  const forms = extracts.flatMap((p) => p.forms);
  const allSocials = extracts.flatMap((p) => p.socials);
  const socials = uniq(allSocials.map((s) => JSON.stringify(s))).map(
    (s) => JSON.parse(s) as { platform: SocialPlatform; url: string },
  );
  const siteDomain = extractDomain(finalUrl);
  const emails = uniq(extracts.flatMap((p) => [...p.mailtoLinks, ...p.emails]))
    // Addresses on the company's own domain first: most likely the real contact.
    .sort((a, b) => Number(b.endsWith(`@${siteDomain}`)) - Number(a.endsWith(`@${siteDomain}`)))
    .slice(0, 5);
  const telLinks = uniq(extracts.flatMap((p) => p.telLinks));
  const phones = dedupePhones([...telLinks, ...extracts.flatMap((p) => p.phones)]).slice(0, 5);

  const platform = vendorHits(extracts, "platform")[0] ?? null;
  const copyrightYears = extracts.map((p) => p.hints.copyrightYear).filter((y): y is number => y != null);

  if (!provided) {
    limitations.push("La empresa no tiene web propia registrada: el análisis se basa en los datos de las fuentes.");
  } else if (mismatch) {
    limitations.push("La web registrada no parece de este negocio, así que su contenido no se ha usado en el análisis.");
  } else if (!reachable) {
    limitations.push("No se pudo leer la web: los apartados de contenido, formularios y herramientas no se han podido revisar.");
  } else {
    limitations.push(
      `Se revisaron ${extracts.length} página(s) de la web sin ejecutar JavaScript: herramientas que se cargan solo con JavaScript o tras aceptar cookies pueden no detectarse.`,
    );
  }
  if (crawl?.listedUrlError) {
    limitations.push(
      `La dirección registrada (${crawl.listedUrlError.url}) da error ${crawl.listedUrlError.status}; se analizó la página de inicio del mismo dominio.`,
    );
  }
  if (reachable && !site.pageSpeed) {
    limitations.push(
      site.pageSpeedError
        ? `PageSpeed Insights no respondió (${site.pageSpeedError}): la velocidad se estima por el tiempo de descarga del HTML.`
        : "Sin PAGESPEED_API_KEY: la velocidad se estima por el tiempo de descarga del HTML, no con métricas de navegador.",
    );
  }
  if (ctx.rating == null && ctx.reviewCount == null) {
    limitations.push("Sin valoración ni número de reseñas en las fuentes (requiere GOOGLE_PLACES_API_KEY).");
  }
  limitations.push("No es posible comprobar desde fuera si las reseñas se responden ni cómo se atienden llamadas y formularios.");

  return {
    version: ANALYSIS_VERSION,
    website: {
      provided,
      url: provided ? rawUrl : (rawUrl ?? null),
      finalUrl,
      reachable,
      blocked: !mismatch && (crawl?.blocked ?? false),
      httpStatus: crawl?.home.status ?? null,
      https,
      redirectsToHttps: crawl?.redirectsToHttps ?? null,
      error: crawl?.home.error ? `${crawl.home.error}${errorPageTitle(crawl.home.errorBody)}` : null,
      loadTimeMs: crawl?.home.loadTimeMs ?? null,
      pageBytes: crawl?.home.bytes ?? null,
      platform,
      listedUrlError: crawl?.listedUrlError ?? null,
      mismatch,
    },
    pages: (mismatch ? [crawl!.home] : (crawl?.pages ?? [])).map((p) => ({
      url: p.finalUrl,
      kind: p.kind,
      status: p.status,
      title: extracts.find((e) => e.url === p.finalUrl)?.title ?? null,
      bytes: p.bytes,
      loadTimeMs: p.loadTimeMs,
      error: p.error,
    })),
    content: {
      title: home?.title ?? null,
      metaDescription: home?.metaDescription ?? null,
      h1: home?.h1 ?? [],
      lang: home?.lang ?? null,
      wordCount: home?.wordCount ?? 0,
      valueProposition: pickValueProposition(home, ctx.name),
      hasPrices: extracts.some((p) => p.hints.hasPrices),
      testimonials: extracts.map((p) => p.hints.testimonials).find(Boolean) ?? null,
      hasFaq: extracts.some((p) => p.hints.hasFaq),
      copyrightYear: copyrightYears.length ? Math.max(...copyrightYears) : null,
      underConstruction: home?.hints.underConstruction ?? null,
      parked: home?.hints.parked ?? null,
    },
    ctas: ctas.slice(0, 40),
    forms,
    booking: {
      vendors: vendorHits(extracts, "booking"),
      links: extracts.flatMap((p) => p.bookingLinks.map((l) => ({ ...l, page: p.url }))).slice(0, 10),
      phoneOnlyHints: uniq(extracts.flatMap((p) => p.hints.phoneOnlyHints)).slice(0, 3),
    },
    contact: {
      phones,
      emails,
      telLinks: telLinks.length,
      mailtoLinks: uniq(extracts.flatMap((p) => p.mailtoLinks)).length,
      hasContactPage: (crawl?.pages ?? []).some((p) => p.kind === "contact" && p.html != null),
    },
    whatsapp: {
      links: uniq(extracts.flatMap((p) => p.whatsappLinks)).slice(0, 5),
      vendors: vendorHits(extracts, "whatsapp"),
    },
    chat: { vendors: vendorHits(extracts, "chat") },
    tracking: {
      analytics: vendorHits(extracts, "analytics"),
      adPixels: vendorHits(extracts, "ad_pixel"),
      crmMarketing: vendorHits(extracts, "crm_marketing"),
      consent: vendorHits(extracts, "consent"),
    },
    leadCapture: {
      newsletter: extracts.some((p) => p.hints.newsletter),
      popups: vendorHits(extracts, "popup"),
      leadMagnets: uniq(extracts.flatMap((p) => p.hints.leadMagnets)).slice(0, 5),
    },
    socials,
    reviews: {
      rating: ctx.rating,
      reviewCount: ctx.reviewCount,
      source: ctx.ratingSource,
      widgets: vendorHits(extracts, "review_widget"),
    },
    technical: {
      mixedContent: uniq(extracts.flatMap((p) => p.mixedContent)).slice(0, 5),
      brokenPages: (crawl?.pages ?? [])
        .filter((p) => p.kind !== "home" && p.status != null && p.status >= 400 && p.status !== 403 && p.status !== 429)
        .map((p) => ({ url: p.requestedUrl, status: p.status! })),
      imageCount: extracts.reduce((n, p) => n + p.imageCount, 0),
      imagesWithoutAlt: extracts.reduce((n, p) => n + p.imagesWithoutAlt, 0),
      scriptCount: home?.scriptCount ?? 0,
      legal: {
        privacy: extracts.some((p) => p.hints.legal.privacy),
        legalNotice: extracts.some((p) => p.hints.legal.legalNotice),
        cookies: extracts.some((p) => p.hints.legal.cookies),
      },
      pageSpeed: site.pageSpeed,
      pageSpeedError: site.pageSpeedError,
    },
    mobile: {
      viewport: home?.viewport ?? null,
      responsive: Boolean(home?.viewport && /width\s*=\s*device-width/i.test(home.viewport)),
    },
    limitations,
  };
}

/** Full visible text of the crawled pages; used to verify quoted evidence. */
export function crawledText(crawl: CrawlResult | null): string {
  return (crawl?.extracts ?? []).map((p) => p.text).join("\n");
}
