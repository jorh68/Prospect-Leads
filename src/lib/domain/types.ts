/**
 * Cross-module contracts. Shapes stored in Json columns are defined as zod
 * schemas so readers can parse them safely (`schema.parse(row.breakdown)`).
 * Owners: see ARCHITECTURE.md.
 */
import { z } from "zod";
import {
  FINDING_CATEGORIES,
  FINDING_KINDS,
  IMPACT_LEVELS,
  MESSAGE_CHANNELS,
  PROVIDERS,
  SEVERITIES,
  SOCIAL_PLATFORMS,
  type ServiceKey,
} from "./constants";

// ── Discovery (owner: foundation) ────────────────────────────────

/** Normalised business record produced by any discovery provider. */
export interface DiscoveredBusiness {
  provider: (typeof PROVIDERS)[number];
  /** Stable id inside the provider, e.g. "node/123" (OSM) or a Place id */
  externalId: string;
  name: string;
  category: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Opening hours as given by the source (OSM syntax or weekday lines) */
  openingHours: string | string[] | null;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  description: string | null;
  businessStatus: "operational" | "closed_temporarily" | "closed_permanently" | "unknown";
  socials: { platform: (typeof SOCIAL_PLATFORMS)[number]; url: string }[];
  /** Untouched provider payload, stored in CompanySource.payload */
  raw: unknown;
}

export const searchAreaSchema = z.object({
  displayName: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  /** [south, north, west, east] */
  boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  osmType: z.string().nullable(),
  osmId: z.number().nullable(),
  countryCode: z.string().nullable(),
});
export type SearchArea = z.infer<typeof searchAreaSchema>;

/** Company.fieldSources: which provider supplied each field. */
export const fieldSourcesSchema = z.record(z.string(), z.enum(PROVIDERS));
export type FieldSources = z.infer<typeof fieldSourcesSchema>;

// ── Analysis (owner: thread A) ───────────────────────────────────

export const findingInputSchema = z.object({
  category: z.enum(FINDING_CATEGORIES),
  key: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(FINDING_KINDS),
  severity: z.enum(SEVERITIES),
  evidence: z.string().min(1),
  evidenceUrl: z.string().url().nullable().optional(),
  interpretation: z.string().nullable().optional(),
});
export type FindingInput = z.infer<typeof findingInputSchema>;

export const opportunityInputSchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  problem: z.string().min(1),
  evidence: z.string().min(1),
  consequence: z.string().min(1),
  solution: z.string().min(1),
  serviceKey: z.string().min(1) as z.ZodType<ServiceKey>,
  impact: z.enum(IMPACT_LEVELS),
  impactNote: z.string().nullable().optional(),
  /** 0..1 */
  confidence: z.number().min(0).max(1),
});
export type OpportunityInput = z.infer<typeof opportunityInputSchema>;

/** One line of Score.breakdown — what makes the score explainable. */
export const scoreFactorSchema = z.object({
  factor: z.string(),
  label: z.string(),
  /** relative weight of this factor, 0..1 (weights sum to 1) */
  weight: z.number(),
  /** normalised value of the factor, 0..1 */
  value: z.number(),
  /** contribution to the 0..100 total */
  points: z.number(),
  explanation: z.string(),
});
export const scoreBreakdownSchema = z.array(scoreFactorSchema);
export type ScoreFactor = z.infer<typeof scoreFactorSchema>;

// ── Outreach (owner: thread B) ───────────────────────────────────

export const messageBasisSchema = z.object({
  /** Real facts the message cites, each with where it came from */
  facts: z.array(z.object({ text: z.string(), source: z.string() })),
  opportunityIds: z.array(z.string()),
});
export type MessageBasis = z.infer<typeof messageBasisSchema>;

export const messageChannelSchema = z.enum(MESSAGE_CHANNELS);
