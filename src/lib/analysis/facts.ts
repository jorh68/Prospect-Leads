/**
 * Derived facts shared by findings, opportunities, score and summary, so the
 * same question ("does it have online booking?") is answered once.
 */
import { PROVIDER_LABELS, SOCIAL_PLATFORM_LABELS, type Provider } from "../domain/constants";
import { displayUrl, formatPhone } from "../format";
import type { CompanyContext } from "./collect";
import { businessProfile, type BusinessProfile } from "./profile";
import type { AnalysisSignals, Cta, FormSignal } from "./signals";

export interface Facts {
  profile: BusinessProfile;
  hasOwnSite: boolean;
  reachable: boolean;
  blocked: boolean;
  siteLabel: string;
  pagesChecked: number;
  /** "inicio, contacto y citas" */
  pagesDescription: string;
  /** A tag manager can inject widgets we cannot see without JavaScript */
  hiddenScriptsPossible: boolean;
  hasBooking: boolean;
  bookingEvidence: string | null;
  hasWhatsapp: boolean;
  hasChat: boolean;
  hasInstantChannel: boolean;
  leadForms: FormSignal[];
  /** Visitors can leave their details: a form, a booking tool or a JS form vendor */
  capturesData: boolean;
  /** Form tools that render with JavaScript (not visible as <form> in the HTML) */
  jsFormVendors: string[];
  homeCtas: Cta[];
  strongCtas: Cta[];
  phoneOnSite: string | null;
  knownPhone: string | null;
  isMobilePhone: boolean;
  hoursText: string | null;
  socialPlatforms: string[];
  reviewSourceLabel: string;
  closed: "permanently" | "temporarily" | null;
}

const PAGE_KIND_LABELS = { home: "inicio", contact: "contacto", booking: "citas/reservas", services: "servicios", other: "otra" };

export function listEs(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

export function hoursToText(hours: CompanyContext["openingHours"]): string | null {
  if (!hours) return null;
  const text = Array.isArray(hours) ? hours.join("; ") : hours;
  return text.trim() ? text.trim().slice(0, 240) : null;
}

export function deriveFacts(ctx: CompanyContext, s: AnalysisSignals): Facts {
  const profile = businessProfile(ctx.niche, ctx.category);
  const home = s.pages[0]?.url ?? s.website.finalUrl;
  const okPages = s.pages.filter((p) => p.status != null && p.status < 400 && !p.error);
  const kinds = [...new Set(okPages.map((p) => PAGE_KIND_LABELS[p.kind]))];

  const bookingForm = s.forms.find((f) => f.purpose === "booking");
  const bookingVendor = s.booking.vendors[0];
  const bookingLink = s.booking.links[0];
  const bookingEvidence = bookingVendor
    ? `${bookingVendor.name}: ${bookingVendor.evidence}`
    : bookingLink
      ? `Enlace "${bookingLink.text}" → ${bookingLink.href}`
      : bookingForm
        ? `Formulario de cita (${bookingForm.fields.join(", ")}) en ${bookingForm.page}`
        : null;

  const leadForms = s.forms.filter((f) => f.purpose === "contact" || f.purpose === "booking");
  const jsFormVendors = s.tracking.crmMarketing
    .filter((v) => /HubSpot|Typeform|Zoho|Pipedrive|Clientify|GoHighLevel|Salesforce/.test(v.name))
    .map((v) => v.name);
  const homeCtas = s.ctas.filter((c) => c.page === home);
  const strongCtas = homeCtas.filter((c) => c.kind !== "other" && (c.kind !== "contact" || c.prominent));
  const phoneOnSite = s.contact.phones[0] ?? null;
  const knownPhone = ctx.phone ?? phoneOnSite;
  const digits = (knownPhone ?? "").replace(/\D/g, "").replace(/^34(?=\d{9}$)/, "");

  return {
    profile,
    hasOwnSite: s.website.provided,
    // A parked domain answers, but it is not the business's website.
    reachable: s.website.reachable && !s.content.parked,
    blocked: s.website.blocked,
    siteLabel: displayUrl(s.website.finalUrl ?? s.website.url),
    pagesChecked: okPages.length,
    pagesDescription: listEs(kinds),
    hiddenScriptsPossible: s.tracking.analytics.some((v) => v.name === "Google Tag Manager"),
    hasBooking: Boolean(bookingEvidence),
    bookingEvidence,
    hasWhatsapp: s.whatsapp.links.length > 0 || s.whatsapp.vendors.length > 0,
    hasChat: s.chat.vendors.length > 0,
    hasInstantChannel: s.whatsapp.links.length > 0 || s.whatsapp.vendors.length > 0 || s.chat.vendors.length > 0,
    leadForms,
    capturesData: leadForms.length > 0 || Boolean(bookingEvidence) || jsFormVendors.length > 0,
    jsFormVendors,
    homeCtas,
    strongCtas,
    phoneOnSite,
    knownPhone,
    isMobilePhone: /^[67]\d{8}$/.test(digits),
    hoursText: hoursToText(ctx.openingHours),
    socialPlatforms: [...new Set([...s.socials.map((x) => x.platform), ...ctx.socials.map((x) => x.platform)])]
      .filter((p) => p !== "whatsapp")
      .map((p) => SOCIAL_PLATFORM_LABELS[p]),
    reviewSourceLabel: ctx.ratingSource ? (PROVIDER_LABELS[ctx.ratingSource as Provider] ?? ctx.ratingSource) : "las fuentes",
    closed:
      ctx.businessStatus === "closed_permanently"
        ? "permanently"
        : ctx.businessStatus === "closed_temporarily"
          ? "temporarily"
          : null,
  };
}

export const fmtPhone = formatPhone;

export function fmtSeconds(ms: number): string {
  return `${(ms / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} s`;
}

export function quote(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  return `"${t.length > max ? `${t.slice(0, max - 1)}…` : t}"`;
}
