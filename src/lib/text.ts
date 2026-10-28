import type { SocialPlatform } from "./domain/constants";

/** Lowercase, accent-free, punctuation-free; used for matching and search. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NAME_NOISE = /\b(s\.?l\.?u?|s\.?a\.?|sociedad limitada|clinica|clinic|centro|the|el|la|los|las|de|del|y)\b/g;

/** Name key for de-duplication: drops legal suffixes and filler words. */
export function nameKey(value: string): string {
  return normalizeText(value).replace(NAME_NOISE, " ").replace(/\s+/g, " ").trim();
}

/** Adds a scheme when missing and validates; returns null for junk. */
export function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v.replace(/^\/+/, "")}`;
  try {
    const url = new URL(v);
    if (!url.hostname.includes(".")) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** Host without "www.", lowercase. */
export function extractDomain(value: string | null | undefined): string | null {
  const url = normalizeUrl(value);
  if (!url) return null;
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

/** Hosts that are listings or social networks, not the company's own site. */
const NOT_OWN_SITE = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "google.com",
  "goo.gl",
  "wa.me",
  "whatsapp.com",
  "doctoralia.es",
  "doctoralia.com",
  "tripadvisor.com",
  "tripadvisor.es",
  "booking.com",
  "linktr.ee",
];

export function isOwnWebsite(url: string | null | undefined): boolean {
  const domain = extractDomain(url);
  if (!domain) return false;
  return !NOT_OWN_SITE.some((d) => domain === d || domain.endsWith(`.${d}`));
}

export function socialPlatformFromUrl(url: string): SocialPlatform | null {
  const domain = extractDomain(url);
  if (!domain) return null;
  const is = (d: string) => domain === d || domain.endsWith(`.${d}`);
  if (is("facebook.com") || is("fb.com")) return "facebook";
  if (is("instagram.com")) return "instagram";
  if (is("linkedin.com")) return "linkedin";
  if (is("twitter.com") || is("x.com")) return "x";
  if (is("tiktok.com")) return "tiktok";
  if (is("youtube.com") || is("youtu.be")) return "youtube";
  if (is("wa.me") || is("whatsapp.com")) return "whatsapp";
  return null;
}

/** Keeps digits and a leading "+"; first number when several are listed. */
export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(/[;,/]| o /)[0] ?? "";
  const cleaned = first.replace(/[^\d+]/g, "");
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return cleaned.startsWith("+") ? `+${digits}` : digits;
}

/** Digits-only phone key for matching across providers (last 9 digits). */
export function phoneKey(value: string | null | undefined): string | null {
  const p = normalizePhone(value);
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  return digits.slice(-9);
}

export function normalizeEmail(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().replace(/^mailto:/i, "").split(/[;,\s]/)[0]?.toLowerCase() ?? "";
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(v) ? v : null;
}

/** Great-circle distance in metres. */
export function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
