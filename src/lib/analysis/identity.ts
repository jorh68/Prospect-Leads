/**
 * Does the website on record actually belong to this business? Directory
 * data goes stale: a listing can point at a domain that now hosts another
 * business. Analysing that site would attribute someone else's website,
 * emails and gaps to the company, so the analysis checks identity first.
 *
 * Deliberately conservative: any one match (phone, email domain, a
 * distinctive word of the name, or a niche keyword) counts as "same
 * business", and pages with too little text are never judged.
 */
import { matchNiche } from "../discovery/niches";
import { extractDomain, normalizeText, phoneKey } from "../text";
import type { CompanyContext } from "./collect";
import type { PageExtract } from "./extract";

const MIN_WORDS = 80;

/** Words that say nothing about which business it is. */
const GENERIC_NAME_WORDS = new Set(
  (
    "clinica clinicas centro centros grupo dental dentales dentista dentistas odontologia odontologica integral " +
    "salud medica medico medical doctor doctora espana spain servicios servicio estudio estetica " +
    "the and los las del para con calle avenida plaza"
  ).split(" "),
);

export function nameTokens(name: string, city: string | null): string[] {
  const cityWords = new Set(normalizeText(city ?? "").split(" "));
  return [
    ...new Set(
      normalizeText(name)
        .split(" ")
        .filter((w) => w.length >= 4 && !/^\d+$/.test(w) && !GENERIC_NAME_WORDS.has(w) && !cityWords.has(w)),
    ),
  ];
}

/**
 * Returns the evidence of a mismatch ("the site shows X and never mentions
 * the business"), or null when the site plausibly belongs to the company or
 * there is not enough text to tell.
 */
export function siteIdentityMismatch(ctx: CompanyContext, extracts: PageExtract[]): string | null {
  const home = extracts[0];
  if (!home) return null;
  const words = extracts.reduce((n, p) => n + p.wordCount, 0);
  if (words < MIN_WORDS) return null;

  const text = ` ${normalizeText(extracts.map((p) => [p.title ?? "", ...p.h1, p.metaDescription ?? "", p.text].join(" ")).join(" "))} `;

  const phone = phoneKey(ctx.phone);
  if (phone) {
    const sitePhones = extracts.flatMap((p) => [...p.telLinks, ...p.phones]).map(phoneKey);
    if (sitePhones.includes(phone) || text.replace(/\s/g, "").includes(phone)) return null;
  }

  const emailDomain = ctx.email?.split("@")[1]?.toLowerCase();
  if (emailDomain && !/^(gmail|hotmail|outlook|yahoo|icloud|live|msn)\./.test(emailDomain)) {
    const siteEmails = extracts.flatMap((p) => [...p.emails, ...p.mailtoLinks]);
    if (siteEmails.some((e) => e.endsWith(`@${emailDomain}`))) return null;
    if (extractDomain(home.url) === extractDomain(`https://${emailDomain}`)) return null;
  }

  const tokens = nameTokens(ctx.name, ctx.city);
  if (tokens.some((t) => text.includes(` ${t}`))) return null;

  const niche = matchNiche([ctx.niche, ctx.category].filter(Boolean).join(" ")).niche;
  if (niche?.keywords.some((k) => text.includes(normalizeText(k)))) return null;
  // Unknown niche and no distinctive name words: nothing to compare against.
  if (!niche && tokens.length === 0) return null;

  const shown = (home.title || home.h1[0] || home.heroText || "").replace(/\s+/g, " ").trim().slice(0, 100);
  const checked = ["el nombre", ctx.phone ? "el teléfono" : null, emailDomain ? "el dominio del email" : null, niche ? `términos del sector (${niche.label.toLowerCase()})` : null]
    .filter(Boolean)
    .join(", ");
  return `${shown ? `La web muestra «${shown}» y` : "La web"} no menciona ${checked} de «${ctx.name}» en ${extracts.length} página(s) revisada(s).`;
}
