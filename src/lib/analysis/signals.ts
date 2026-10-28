/**
 * Shape of Analysis.signals: everything the analysis observed, stored as-is
 * so the company page, the report and later re-interpretations can show the
 * evidence behind every finding. Parse with `analysisSignalsSchema.safeParse`.
 *
 * No `server-only` import: UI code may read the types.
 */
import { z } from "zod";
import { SOCIAL_PLATFORMS } from "../domain/constants";

/** A third-party tool detected on the site, with the snippet that proves it. */
export const vendorHitSchema = z.object({
  name: z.string(),
  evidence: z.string(),
  page: z.string(),
});
export type VendorHit = z.infer<typeof vendorHitSchema>;

export const PAGE_KINDS = ["home", "contact", "booking", "services", "other"] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

export const CTA_KINDS = ["booking", "call", "whatsapp", "contact", "quote", "other"] as const;
export type CtaKind = (typeof CTA_KINDS)[number];

export const FORM_PURPOSES = ["contact", "booking", "newsletter", "search", "login", "other"] as const;
export type FormPurpose = (typeof FORM_PURPOSES)[number];

export const pageSignalSchema = z.object({
  url: z.string(),
  kind: z.enum(PAGE_KINDS),
  status: z.number().nullable(),
  title: z.string().nullable(),
  bytes: z.number().nullable(),
  loadTimeMs: z.number().nullable(),
  error: z.string().nullable(),
});
export type PageSignal = z.infer<typeof pageSignalSchema>;

export const ctaSchema = z.object({
  text: z.string(),
  href: z.string().nullable(),
  kind: z.enum(CTA_KINDS),
  /** Styled as a button (button element or btn/cta class), not a plain menu link */
  prominent: z.boolean(),
  page: z.string(),
});
export type Cta = z.infer<typeof ctaSchema>;

export const formSignalSchema = z.object({
  page: z.string(),
  purpose: z.enum(FORM_PURPOSES),
  fieldCount: z.number(),
  requiredCount: z.number(),
  fields: z.array(z.string()),
  hasEmail: z.boolean(),
  hasPhone: z.boolean(),
  hasMessage: z.boolean(),
  hasConsent: z.boolean(),
  hasCaptcha: z.boolean(),
  submitText: z.string().nullable(),
});
export type FormSignal = z.infer<typeof formSignalSchema>;

export const pageSpeedSchema = z.object({
  strategy: z.literal("mobile"),
  performance: z.number().nullable(),
  accessibility: z.number().nullable(),
  seo: z.number().nullable(),
  bestPractices: z.number().nullable(),
  lcpMs: z.number().nullable(),
  cls: z.number().nullable(),
  tbtMs: z.number().nullable(),
  fetchedAt: z.string(),
});
export type PageSpeedSignal = z.infer<typeof pageSpeedSchema>;

export const analysisSignalsSchema = z.object({
  version: z.string(),
  website: z.object({
    /** The company has a website on record (from any source) */
    provided: z.boolean(),
    url: z.string().nullable(),
    finalUrl: z.string().nullable(),
    /** The home page answered with HTML we could read */
    reachable: z.boolean(),
    /** The site answered but refused automated access (403/429/anti-bot) */
    blocked: z.boolean(),
    httpStatus: z.number().nullable(),
    https: z.boolean().nullable(),
    /** Plain http:// is redirected to https:// */
    redirectsToHttps: z.boolean().nullable(),
    error: z.string().nullable(),
    loadTimeMs: z.number().nullable(),
    pageBytes: z.number().nullable(),
    platform: vendorHitSchema.nullable(),
  }),
  pages: z.array(pageSignalSchema),
  content: z.object({
    title: z.string().nullable(),
    metaDescription: z.string().nullable(),
    h1: z.array(z.string()),
    lang: z.string().nullable(),
    wordCount: z.number(),
    /** Best candidate for the headline/value proposition (h1 or hero text) */
    valueProposition: z.string().nullable(),
    hasPrices: z.boolean(),
    testimonials: z.string().nullable(),
    hasFaq: z.boolean(),
    copyrightYear: z.number().nullable(),
    underConstruction: z.string().nullable(),
    parked: z.string().nullable(),
  }),
  ctas: z.array(ctaSchema),
  forms: z.array(formSignalSchema),
  booking: z.object({
    vendors: z.array(vendorHitSchema),
    links: z.array(z.object({ text: z.string(), href: z.string(), page: z.string() })),
    /** Sentences saying appointments are made by phone, verbatim */
    phoneOnlyHints: z.array(z.string()),
  }),
  contact: z.object({
    phones: z.array(z.string()),
    emails: z.array(z.string()),
    telLinks: z.number(),
    mailtoLinks: z.number(),
    hasContactPage: z.boolean(),
  }),
  whatsapp: z.object({
    links: z.array(z.string()),
    vendors: z.array(vendorHitSchema),
  }),
  chat: z.object({ vendors: z.array(vendorHitSchema) }),
  tracking: z.object({
    analytics: z.array(vendorHitSchema),
    adPixels: z.array(vendorHitSchema),
    crmMarketing: z.array(vendorHitSchema),
    consent: z.array(vendorHitSchema),
  }),
  leadCapture: z.object({
    newsletter: z.boolean(),
    popups: z.array(vendorHitSchema),
    leadMagnets: z.array(z.string()),
  }),
  socials: z.array(z.object({ platform: z.enum(SOCIAL_PLATFORMS), url: z.string() })),
  reviews: z.object({
    rating: z.number().nullable(),
    reviewCount: z.number().nullable(),
    /** provider that reported rating/reviewCount */
    source: z.string().nullable(),
    widgets: z.array(vendorHitSchema),
  }),
  technical: z.object({
    mixedContent: z.array(z.string()),
    brokenPages: z.array(z.object({ url: z.string(), status: z.number() })),
    imageCount: z.number(),
    imagesWithoutAlt: z.number(),
    scriptCount: z.number(),
    legal: z.object({ privacy: z.boolean(), legalNotice: z.boolean(), cookies: z.boolean() }),
    pageSpeed: pageSpeedSchema.nullable(),
    pageSpeedError: z.string().nullable(),
  }),
  mobile: z.object({
    viewport: z.string().nullable(),
    responsive: z.boolean(),
  }),
  /** What this analysis could not check, shown next to the results */
  limitations: z.array(z.string()),
});
export type AnalysisSignals = z.infer<typeof analysisSignalsSchema>;
