import "server-only";
import { z } from "zod";

/**
 * Server-side configuration. Every integration that needs a credential is
 * optional: the app runs without it and reports the missing key in
 * /settings and in the affected feature instead of failing.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),

  // Google Places API (New). Adds ratings, review counts and better coverage.
  GOOGLE_PLACES_API_KEY: z.string().trim().optional(),

  // OpenStreetMap (keyless). Nominatim's usage policy asks for a contact.
  OSM_CONTACT_EMAIL: z.string().trim().optional(),
  NOMINATIM_URL: z.string().url().default("https://nominatim.openstreetmap.org"),
  /** Comma-separated list of Overpass endpoints, tried in order. */
  OVERPASS_URLS: z
    .string()
    .default("https://overpass-api.de/api/interpreter,https://overpass.private.coffee/api/interpreter"),

  // Optional LLM for interpretation and message writing.
  ANTHROPIC_API_KEY: z.string().trim().optional(),
  ANTHROPIC_MODEL: z.string().trim().default("claude-opus-5-5"),

  // Website analysis (module A)
  /** Google PageSpeed Insights API key: adds real mobile performance metrics (Lighthouse). */
  PAGESPEED_API_KEY: z.string().trim().optional(),
  /** Development/testing only: allow crawling localhost and private networks. */
  ANALYSIS_ALLOW_PRIVATE_HOSTS: z.stringbool().default(false),
  // Outreach: how messages are signed and who reports are "prepared by".
  OUTREACH_SENDER_NAME: z.string().trim().optional(),
  OUTREACH_SENDER_COMPANY: z.string().trim().optional(),

  // Worker tuning
  JOB_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(
    Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v])),
  );
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuración inválida: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function overpassUrls(): string[] {
  return env()
    .OVERPASS_URLS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const integrations = {
  googlePlaces: () => Boolean(env().GOOGLE_PLACES_API_KEY),
  anthropic: () => Boolean(env().ANTHROPIC_API_KEY),
  pageSpeed: () => Boolean(env().PAGESPEED_API_KEY),
};
