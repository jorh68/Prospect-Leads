import { z } from "zod";

/**
 * Report.content — a frozen snapshot of what the report shows. Versioned so
 * old reports keep rendering when the layout evolves. Everything in it comes
 * from the company dossier at generation time; nothing is computed later.
 */
export const REPORT_VERSION = "1";

const item = z.object({
  title: z.string(),
  evidence: z.string(),
  evidenceUrl: z.string().nullable(),
  interpretation: z.string().nullable(),
  severity: z.string(),
  category: z.string(),
});

export const reportContentSchema = z.object({
  version: z.literal(REPORT_VERSION),
  generatedAt: z.string(),
  preparedBy: z.string().nullable(),
  company: z.object({
    name: z.string(),
    category: z.string().nullable(),
    niche: z.string().nullable(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    website: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    rating: z.number().nullable(),
    reviewCount: z.number().nullable(),
    socials: z.array(z.object({ platform: z.string(), url: z.string() })),
  }),
  analysis: z.object({
    analyzedAt: z.string().nullable(),
    url: z.string().nullable(),
    generator: z.string().nullable(),
  }),
  /** "Situación actual": interpreted summary + key facts as label/value */
  situation: z.object({
    summary: z.string(),
    facts: z.array(z.object({ label: z.string(), value: z.string() })),
  }),
  strengths: z.array(item),
  problems: z.array(item),
  opportunities: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      problem: z.string(),
      evidence: z.string(),
      consequence: z.string(),
      solution: z.string(),
      service: z.string(),
      impact: z.string(),
      impactNote: z.string().nullable(),
      confidence: z.number(),
    }),
  ),
  /** Ordered: what we would do first */
  recommendations: z.array(z.object({ title: z.string(), detail: z.string() })),
  /** Systems we could implement, one per recommended service */
  systems: z.array(z.object({ label: z.string(), description: z.string(), addresses: z.array(z.string()) })),
  impact: z.object({
    overall: z.string(),
    notes: z.array(z.object({ title: z.string(), impact: z.string(), note: z.string() })),
  }),
  sources: z.array(z.string()),
});

export type ReportContent = z.infer<typeof reportContentSchema>;
