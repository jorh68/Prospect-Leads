import { SERVICES, type ServiceKey } from "../domain/constants";
import { impactRank, opportunityPriority } from "./priority";

export interface ServiceOpportunityRef {
  id: string;
  title: string;
  serviceKey: string;
  impact: string;
  confidence: number;
}

export interface RecommendedService {
  key: string;
  label: string;
  description: string;
  /** Highest impact among the opportunities that point to this service */
  impact: string;
  /** Highest confidence among them, 0..1 */
  confidence: number;
  opportunities: { id: string; title: string }[];
}

/**
 * Services worth offering, derived only from detected opportunities: one row
 * per service, ordered by the strongest opportunity behind it.
 */
export function recommendServices(opportunities: ServiceOpportunityRef[]): RecommendedService[] {
  const byKey = new Map<string, { rows: ServiceOpportunityRef[] }>();
  for (const o of opportunities) {
    const entry = byKey.get(o.serviceKey) ?? { rows: [] };
    entry.rows.push(o);
    byKey.set(o.serviceKey, entry);
  }

  return [...byKey.entries()]
    .map(([key, { rows }]) => {
      const catalog = SERVICES[key as ServiceKey];
      const best = rows.reduce((a, b) => (opportunityPriority(b) > opportunityPriority(a) ? b : a));
      return {
        key,
        label: catalog?.label ?? key,
        description: catalog?.description ?? "",
        impact: rows.reduce((a, b) => (impactRank(b.impact) > impactRank(a) ? b.impact : a), rows[0].impact),
        confidence: Math.max(...rows.map((r) => r.confidence)),
        opportunities: rows.map((r) => ({ id: r.id, title: r.title })),
        priority: opportunityPriority(best) + rows.length * 0.01,
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .map(({ priority: _priority, ...service }) => service);
}

export function serviceLabel(key: string): string {
  return SERVICES[key as ServiceKey]?.label ?? key;
}
