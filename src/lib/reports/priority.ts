/** Ordering helpers shared by the company page, messages and reports. */

const IMPACT_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
const SEVERITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1, info: 0 };

/** Expected value first: impact weighted by how sure we are. */
export function opportunityPriority(o: { impact: string; confidence: number }): number {
  return (IMPACT_RANK[o.impact] ?? 0) * o.confidence;
}

export function sortOpportunities<T extends { impact: string; confidence: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => opportunityPriority(b) - opportunityPriority(a));
}

export function severityRank(severity: string): number {
  return SEVERITY_RANK[severity] ?? 0;
}

export function impactRank(impact: string): number {
  return IMPACT_RANK[impact] ?? 0;
}

/** Confidence 0..1 as a word, so it is not read as a precise probability. */
export function confidenceLabel(confidence: number): "Alta" | "Media" | "Baja" {
  return confidence >= 0.75 ? "Alta" : confidence >= 0.5 ? "Media" : "Baja";
}
