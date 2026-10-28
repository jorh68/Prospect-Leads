import { PROVIDER_LABELS, type Provider } from "../domain/constants";
import { formatNumber, formatRating, displayUrl } from "../format";
import { severityRank, sortOpportunities } from "../reports/priority";

/**
 * Plain input for outreach writing: only what was really found about the
 * company. Built from the dossier (see toOutreachInput in ./generate.ts) and
 * kept free of Prisma types so the composer is easy to test.
 */
export interface OutreachInput {
  company: {
    name: string;
    niche: string | null;
    category: string | null;
    city: string | null;
    website: string | null;
    phone: string | null;
    email: string | null;
    rating: number | null;
    reviewCount: number | null;
    mapsUrl: string | null;
    fieldSources: Record<string, string>;
  };
  socials: { platform: string; url: string }[];
  findings: {
    id: string;
    category: string;
    key: string;
    label: string;
    kind: string;
    severity: string;
    evidence: string;
    evidenceUrl: string | null;
    interpretation: string | null;
  }[];
  opportunities: {
    id: string;
    type: string;
    title: string;
    problem: string;
    evidence: string;
    consequence: string;
    solution: string;
    serviceKey: string;
    impact: string;
    impactNote?: string | null;
    confidence: number;
  }[];
  /** URL that the analysis actually fetched, when there was one */
  analyzedUrl: string | null;
}

/** A verifiable fact a message may cite, with where it came from. */
export interface Fact {
  id: string;
  kind: "reputation" | "presence" | "issue" | "strength" | "opportunity";
  text: string;
  source: string;
  opportunityId?: string;
}

function sourceLabel(provider: string | undefined): string {
  return provider ? (PROVIDER_LABELS[provider as Provider] ?? provider) : "Datos de la empresa";
}

/** Minimum volume for a rating to be worth mentioning as a compliment. */
export const GOOD_REPUTATION = { rating: 4.3, reviews: 20 };

export function buildFacts(input: OutreachInput): Fact[] {
  const { company } = input;
  const facts: Fact[] = [];

  if (company.rating != null && company.reviewCount != null && company.reviewCount > 0) {
    facts.push({
      id: "rating",
      kind: "reputation",
      text: `Valoración de ${formatRating(company.rating)} sobre 5 con ${formatNumber(company.reviewCount)} reseñas`,
      source: sourceLabel(company.fieldSources.rating),
    });
  }

  if (company.website) {
    facts.push({
      id: "website",
      kind: "presence",
      text: `Web propia: ${displayUrl(company.website)}`,
      source: sourceLabel(company.fieldSources.website),
    });
  } else {
    facts.push({
      id: "no_website",
      kind: "presence",
      text: "No consta página web propia en las fuentes consultadas",
      source: "Fuentes de descubrimiento",
    });
  }

  for (const o of sortOpportunities(input.opportunities)) {
    facts.push({
      id: `opportunity:${o.id}`,
      kind: "opportunity",
      text: `${o.problem.trim().replace(/([^.!?…])$/, "$1.")} Evidencia: ${o.evidence}`,
      source: "Análisis de la web",
      opportunityId: o.id,
    });
  }

  const issues = input.findings
    .filter((f) => f.kind === "issue" && severityRank(f.severity) >= 2)
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  for (const f of issues) {
    facts.push({ id: `finding:${f.id}`, kind: "issue", text: `${f.label}: ${f.evidence}`, source: "Análisis de la web" });
  }

  for (const f of input.findings.filter((f) => f.kind === "positive")) {
    facts.push({ id: `finding:${f.id}`, kind: "strength", text: `${f.label}: ${f.evidence}`, source: "Análisis de la web" });
  }

  return facts;
}
