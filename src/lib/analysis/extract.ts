/**
 * Turns one HTML page into structured observations. Pure: no network, no
 * database, so it is unit-tested against saved HTML.
 */
import { load, type CheerioAPI } from "cheerio/slim";
import type { AnyNode, Element } from "domhandler";
import type { SocialPlatform } from "../domain/constants";
import { normalizeEmail, normalizePhone, phoneKey, socialPlatformFromUrl } from "../text";
import type { Cta, CtaKind, FormPurpose, FormSignal, PageKind } from "./signals";
import { detectVendors, snippetAround, type VendorMatch } from "./vendors";

export interface LinkInfo {
  href: string;
  text: string;
}

export interface PageExtract {
  url: string;
  title: string | null;
  metaDescription: string | null;
  lang: string | null;
  viewport: string | null;
  h1: string[];
  /** Short hero-like text when there is no usable h1 */
  heroText: string | null;
  text: string;
  wordCount: number;
  internalLinks: LinkInfo[];
  ctas: Cta[];
  forms: FormSignal[];
  telLinks: string[];
  mailtoLinks: string[];
  phones: string[];
  emails: string[];
  whatsappLinks: string[];
  socials: { platform: SocialPlatform; url: string }[];
  bookingLinks: LinkInfo[];
  imageCount: number;
  imagesWithoutAlt: number;
  scriptCount: number;
  mixedContent: string[];
  vendors: VendorMatch[];
  hasCaptcha: boolean;
  hints: {
    hasPrices: boolean;
    testimonials: string | null;
    hasFaq: boolean;
    copyrightYear: number | null;
    underConstruction: string | null;
    parked: string | null;
    phoneOnlyHints: string[];
    leadMagnets: string[];
    newsletter: boolean;
    legal: { privacy: boolean; legalNotice: boolean; cookies: boolean };
  };
}

const MAX_TEXT = 40_000;

const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

function absolute(href: string | undefined, base: string): string | null {
  if (!href) return null;
  const h = href.trim();
  if (!h || h.startsWith("#") || /^javascript:/i.test(h)) return null;
  try {
    return new URL(h, base).toString();
  } catch {
    return null;
  }
}

function sameSite(a: string, b: string): boolean {
  try {
    const ha = new URL(a).hostname.replace(/^www\./, "");
    const hb = new URL(b).hostname.replace(/^www\./, "");
    return ha === hb;
  } catch {
    return false;
  }
}

// ── Text patterns (Spanish first, English as fallback) ──

const RE = {
  booking:
    /\b(reserv\w*|pide (?:tu |una )?cita|pedir cita|solicit\w* (?:tu |una )?cita|cita (?:online|previa)|agend\w* (?:tu |una )?cita|concert\w* (?:tu |una )?cita|book(?: now| online)?|primera (?:visita|consulta)|appointment)\b/i,
  call: /\b(ll[aá]m\w*|llamar|call us|call now)\b/i,
  whatsapp: /whats ?app/i,
  contact: /\b(contact\w*|escr[ií]be\w*|env[ií]a\w* (?:un )?mensaje|hablemos|get in touch)\b/i,
  quote: /\b(presupuesto|cotiza\w*|valoraci[oó]n gratuita|consulta gratuita|diagn[oó]stico gratuito|asesor[ií]a gratuita|quote)\b/i,
  prices: /\d+(?:[.,]\d{1,2})?\s?€|€\s?\d+/,
  testimonials: /(testimonios|opiniones de (?:nuestros )?(?:clientes|pacientes)|lo que dicen (?:nuestros )?(?:clientes|pacientes)|rese[nñ]as de (?:clientes|pacientes)|testimonials)/i,
  faq: /(preguntas frecuentes|\bfaqs?\b)/i,
  copyright: /(?:©|\(c\)|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})/gi,
  underConstruction:
    /(en construcci[oó]n|under construction|pr[oó]ximamente nueva web|coming soon|sitio en mantenimiento|web en mantenimiento|estamos trabajando en nuestra (?:nueva )?(?:web|p[aá]gina))/i,
  parked:
    /(this domain (?:is|may be) for sale|domain (?:is )?for sale|este dominio (?:est[aá] )?en venta|buy this domain|parked (?:free|domain)|dominio aparcado)/i,
  phoneOnly:
    /[^.!?\n]{0,90}(?:(?:cita|reserva)\w*[^.!?\n]{0,70}(?:ll[aá]m\w+|llamando|por tel[eé]fono|telef[oó]nicamente)|(?:ll[aá]m\w+|llamando|por tel[eé]fono|telef[oó]nicamente)[^.!?\n]{0,70}(?:cita|reserv\w*))[^.!?\n]{0,60}/gi,
  leadMagnet:
    /(descarg\w* (?:gratis|nuestr[oa] gu[ií]a|el ebook|la gu[ií]a)|gu[ií]a gratuita|e-?book gratuito|primera (?:visita|consulta) gratis|consulta gratuita|valoraci[oó]n gratuita|diagn[oó]stico gratuito|revisi[oó]n gratuita|\d{1,2}\s?% de descuento)/gi,
  newsletter: /(newsletter|suscr[ií]be\w*|bolet[ií]n|subscribe)/i,
  privacy: /(pol[ií]tica de privacidad|privacidad|privacy)/i,
  legalNotice: /(aviso legal|nota legal|legal notice|t[eé]rminos legales)/i,
  cookies: /(pol[ií]tica de cookies|cookies)/i,
  captcha: /(g-recaptcha|recaptcha\/api|hcaptcha|challenges\.cloudflare\.com\/turnstile|grecaptcha)/i,
  phoneText: /(?:\+34|0034)?[\s.-]?\b[6789](?:[\s.-]?\d){8}\b/g,
  emailText: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi,
};

const EMAIL_NOISE = /(\.(png|jpe?g|gif|svg|webp)$|sentry|wixpress|example\.|domain\.com|tudominio|tuemail|email@|correo@|your@|name@|@2x|@3x)/i;

export function classifyPage(url: string, linkText = ""): PageKind {
  let path = "";
  try {
    path = decodeURIComponent(new URL(url).pathname).toLowerCase();
  } catch {
    path = url.toLowerCase();
  }
  if (path === "/" || path === "") return "home";
  const s = `${path} ${linkText.toLowerCase()}`;
  if (/(cita|reserv|booking|appointment|agenda)/.test(s)) return "booking";
  if (/(contact|donde-estamos|ubicaci|localizaci|como-llegar)/.test(s)) return "contact";
  if (/(servicio|tratamiento|especialidad|services|carta|menu|precios|tarifas)/.test(s)) return "services";
  return "other";
}

/** Decodes Cloudflare's obfuscated e-mail ("/cdn-cgi/l/email-protection#…"). */
export function decodeCfEmail(hex: string): string | null {
  if (!/^[0-9a-f]{4,}$/i.test(hex) || hex.length % 2) return null;
  const key = parseInt(hex.slice(0, 2), 16);
  let out = "";
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return normalizeEmail(out);
}

function ctaKind(text: string, href: string | null): CtaKind | null {
  const h = (href ?? "").toLowerCase();
  if (/wa\.me|api\.whatsapp\.com|whatsapp:\/\//.test(h) || RE.whatsapp.test(text)) return "whatsapp";
  if (h.startsWith("tel:") || RE.call.test(text)) return "call";
  if (RE.booking.test(text)) return "booking";
  if (RE.quote.test(text)) return "quote";
  if (RE.contact.test(text) || h.startsWith("mailto:")) return "contact";
  return null;
}

function labelFor($: CheerioAPI, el: Element): string {
  const id = $(el).attr("id");
  const byFor = id ? clean($(`label[for="${id.replace(/"/g, '\\"')}"]`).first().text()) : "";
  const wrapped = clean($(el).closest("label").text());
  return (
    byFor ||
    wrapped ||
    clean($(el).attr("aria-label")) ||
    clean($(el).attr("placeholder")) ||
    clean($(el).attr("name")) ||
    clean($(el).attr("type")) ||
    el.tagName
  ).slice(0, 60);
}

function extractForms($: CheerioAPI, pageUrl: string, pageHasCaptcha: boolean): FormSignal[] {
  const forms: FormSignal[] = [];
  $("form").each((_, form) => {
    const $f = $(form);
    const fields = $f
      .find("input, select, textarea")
      .toArray()
      .filter((el) => {
        const type = ($(el).attr("type") ?? "text").toLowerCase();
        return !["hidden", "submit", "button", "reset", "image"].includes(type);
      });
    if (fields.length === 0) return;

    const types = fields.map((el) => ($(el).attr("type") ?? el.tagName).toLowerCase());
    const names = fields.map((el) => `${$(el).attr("name") ?? ""} ${$(el).attr("placeholder") ?? ""} ${$(el).attr("id") ?? ""}`.toLowerCase());
    const labels = fields.map((el) => labelFor($, el));
    const formText = clean($f.text()).toLowerCase();
    const hasEmail = types.includes("email") || names.some((n) => /e-?mail|correo/.test(n));
    const hasPhone = types.includes("tel") || names.some((n) => /tel|phone|m[oó]vil|movil/.test(n));
    const hasMessage = fields.some((el) => el.tagName === "textarea") || names.some((n) => /mensaje|message|comentario|consulta/.test(n));
    const checkboxes = fields.filter((el) => ($(el).attr("type") ?? "").toLowerCase() === "checkbox");
    const hasConsent =
      checkboxes.length > 0 && /(privacidad|acepto|rgpd|gdpr|consent|t[eé]rminos|aviso legal)/.test(formText);
    const html = $.html(form) ?? "";
    const hasCaptcha = RE.captcha.test(html) || pageHasCaptcha;

    let purpose: FormPurpose = "other";
    if (types.includes("password")) purpose = "login";
    else if (types.includes("search") || (fields.length === 1 && names.some((n) => /^\s*(s|q|search|buscar)\b/.test(n))))
      purpose = "search";
    else if (fields.length <= 3 && hasEmail && !hasMessage && RE.newsletter.test(formText)) purpose = "newsletter";
    else if (
      types.includes("date") ||
      types.includes("datetime-local") ||
      names.some((n) => /(cita|reserva|appointment|booking|fecha|date|hora)/.test(n) && !/(nacimiento|birth)/.test(n))
    )
      purpose = "booking";
    else if (hasEmail || hasPhone || hasMessage) purpose = "contact";

    const submit = $f.find('button, input[type="submit"]').first();
    const submitText = clean(submit.is("input") ? submit.attr("value") : submit.text()) || null;

    forms.push({
      page: pageUrl,
      purpose,
      fieldCount: fields.length,
      requiredCount: fields.filter((el) => $(el).attr("required") != null || $(el).attr("aria-required") === "true").length,
      fields: labels,
      hasEmail,
      hasPhone,
      hasMessage,
      hasConsent,
      hasCaptcha,
      submitText: submitText?.slice(0, 60) ?? null,
    });
  });
  return forms;
}

const BLOCK_TAGS = new Set([
  "p", "div", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "header", "footer",
  "nav", "main", "aside", "td", "th", "tr", "table", "br", "form", "label", "blockquote", "dd", "dt", "button", "a",
]);

/** Visible text with one line per block element, so sentences don't run together. */
function visibleText($: CheerioAPI): string {
  // load() always wraps documents and fragments in <html><body>.
  const clone = $("body").clone();
  clone.find("script, style, noscript, svg, template, iframe").remove();
  clone.find("*").each((_, el) => {
    $(el).append(BLOCK_TAGS.has((el as Element).tagName) ? "\n" : " ");
  });
  return clone
    .text()
    .replace(/[ \t\r\f\v\u00a0]+/g, " ")
    .replace(/ ?\n[\s]*/g, "\n")
    .trim()
    .slice(0, MAX_TEXT);
}

/** The line of `text` containing `index`, trimmed to `max` characters. */
function lineAround(text: string, index: number, length: number, max = 200): string {
  const start = text.lastIndexOf("\n", index) + 1;
  const endNl = text.indexOf("\n", index + length);
  const line = text.slice(start, endNl === -1 ? undefined : endNl).trim();
  if (line.length <= max) return line;
  return snippetAround(line, index - start, length, Math.floor((max - length) / 2));
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/** One entry per number (last 9 digits), keeping the first spelling seen. */
export function dedupePhones(phones: string[]): string[] {
  const seen = new Set<string>();
  return phones.filter((p) => {
    const key = phoneKey(p);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractPage(html: string, pageUrl: string): PageExtract {
  const $ = load(html);
  const https = pageUrl.startsWith("https:");

  const title = clean($("title").first().text()) || null;
  const metaDescription = clean($('meta[name="description" i]').attr("content")) || null;
  const viewport = clean($('meta[name="viewport" i]').attr("content")) || null;
  const lang = clean($("html").attr("lang")) || null;
  const h1 = $("h1")
    .toArray()
    .map((el) => clean($(el).text()))
    .filter((t) => t.length > 0)
    .slice(0, 5);
  const heroText =
    clean($('[class*="hero" i] h2, [class*="hero" i] p, [class*="banner" i] h2, header h2').first().text()).slice(0, 200) ||
    clean($('meta[property="og:description"]').attr("content")).slice(0, 200) ||
    null;

  const pageHasCaptcha = RE.captcha.test(html);
  const forms = extractForms($, pageUrl, pageHasCaptcha);

  // Links
  const internalLinks: LinkInfo[] = [];
  const telLinks: string[] = [];
  const mailtoLinks: string[] = [];
  const whatsappLinks: string[] = [];
  const socials: { platform: SocialPlatform; url: string }[] = [];
  const bookingLinks: LinkInfo[] = [];
  const emails: string[] = [];
  const ctas: Cta[] = [];

  const ctaElements = $("a[href], button, [role='button'], input[type='button']").toArray() as Element[];
  for (const el of ctaElements) {
    const $el = $(el);
    const rawHref = $el.attr("href");
    const text = clean($el.text() || $el.attr("value") || $el.attr("aria-label") || $el.attr("title")).slice(0, 80);
    const lowerHref = (rawHref ?? "").trim().toLowerCase();

    if (lowerHref.startsWith("tel:")) {
      const p = normalizePhone(decodeURIComponent(rawHref!.trim().slice(4)));
      if (p) telLinks.push(p);
    } else if (lowerHref.startsWith("mailto:")) {
      const e = normalizeEmail(decodeURIComponent(rawHref!.trim().slice(7).split("?")[0] ?? ""));
      if (e) mailtoLinks.push(e);
    } else if (lowerHref.includes("/cdn-cgi/l/email-protection#")) {
      const e = decodeCfEmail(lowerHref.split("#")[1] ?? "");
      if (e) emails.push(e);
    }

    const href = absolute(rawHref, pageUrl);
    if (href && /^https?:/i.test(href)) {
      const platform = socialPlatformFromUrl(href);
      if (platform === "whatsapp") whatsappLinks.push(href);
      else if (platform && !/(sharer|share\?|intent\/tweet|sharearticle|\/share\b)/i.test(href)) {
        socials.push({ platform, url: href.split("?")[0]! });
      }
      if (sameSite(href, pageUrl)) internalLinks.push({ href: href.split("#")[0]!, text });
      else if (RE.booking.test(text) || detectVendors(href).some((v) => v.vendor.group === "booking")) {
        bookingLinks.push({ href, text: text || href });
      }
    } else if (lowerHref.startsWith("whatsapp://")) {
      whatsappLinks.push(rawHref!.trim());
    }

    if (text.length > 0 && text.length <= 60) {
      const kind = ctaKind(text, rawHref ?? null);
      if (kind) {
        const cls = `${$el.attr("class") ?? ""} ${$el.attr("id") ?? ""}`.toLowerCase();
        const prominent = el.tagName === "button" || $el.attr("role") === "button" || /(btn|button|boton|cta)/.test(cls);
        ctas.push({ text, href: href ?? (rawHref?.trim() || null), kind, prominent, page: pageUrl });
      }
    }
  }
  $("[data-cfemail]").each((_, el) => {
    const e = decodeCfEmail($(el).attr("data-cfemail") ?? "");
    if (e) emails.push(e);
  });

  // Media and technical
  const imgs = $("img").toArray();
  const imagesWithoutAlt = imgs.filter((el) => $(el).attr("alt") == null).length;
  const scriptCount = $("script[src]").length;
  const mixedContent = https
    ? uniq(
        $("img[src], script[src], iframe[src], link[rel='stylesheet'][href], source[src], video[src], audio[src]")
          .toArray()
          .map((el) => ($(el).attr("src") ?? $(el).attr("href") ?? "").trim())
          .filter((u) => /^http:\/\//i.test(u)),
      ).slice(0, 5)
    : [];

  const text = visibleText($);
  const phones = [...text.matchAll(RE.phoneText)].map((m) => normalizePhone(m[0])).filter((p): p is string => p != null);
  for (const m of text.matchAll(RE.emailText)) {
    const e = normalizeEmail(m[0]);
    if (e && !EMAIL_NOISE.test(e)) emails.push(e);
  }

  // Footer/legal links are usually links; text search covers both.
  const linkTexts = $("a").toArray().map((el: AnyNode) => clean($(el).text())).join(" | ");
  const legalHaystack = `${linkTexts} ${text.slice(-4000)}`;

  const years = [...text.matchAll(RE.copyright)].map((m) => Number(m[1]));
  const firstMatch = (re: RegExp) => {
    const m = re.exec(text);
    return m ? lineAround(text, m.index, m[0].length) : null;
  };

  return {
    url: pageUrl,
    title,
    metaDescription,
    lang,
    viewport,
    h1,
    heroText,
    text,
    wordCount: text ? text.split(/\s+/).length : 0,
    internalLinks,
    ctas,
    forms,
    telLinks: uniq(telLinks),
    mailtoLinks: uniq(mailtoLinks),
    phones: dedupePhones([...telLinks, ...phones]).slice(0, 5),
    emails: uniq(emails.filter((e) => !EMAIL_NOISE.test(e))),
    whatsappLinks: uniq(whatsappLinks),
    socials: uniq(socials.map((s) => JSON.stringify(s))).map((s) => JSON.parse(s) as { platform: SocialPlatform; url: string }),
    bookingLinks,
    imageCount: imgs.length,
    imagesWithoutAlt,
    scriptCount,
    mixedContent,
    vendors: detectVendors(html),
    hasCaptcha: pageHasCaptcha,
    hints: {
      hasPrices: RE.prices.test(text),
      testimonials: firstMatch(RE.testimonials),
      hasFaq: RE.faq.test(text),
      copyrightYear: years.length ? Math.max(...years) : null,
      underConstruction: firstMatch(RE.underConstruction),
      parked: firstMatch(RE.parked),
      phoneOnlyHints: uniq([...text.matchAll(RE.phoneOnly)].map((m) => clean(m[0]))).slice(0, 3),
      leadMagnets: uniq([...text.matchAll(RE.leadMagnet)].map((m) => clean(m[0]).toLowerCase())).slice(0, 5),
      newsletter: forms.some((f) => f.purpose === "newsletter") || RE.newsletter.test(text),
      legal: {
        privacy: RE.privacy.test(legalHaystack),
        legalNotice: RE.legalNotice.test(legalHaystack),
        cookies: RE.cookies.test(legalHaystack),
      },
    },
  };
}
