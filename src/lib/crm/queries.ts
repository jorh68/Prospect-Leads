import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import {
  CRM_STATUSES,
  SERVICE_KEYS,
  type CrmStatus,
  type ImpactLevel,
  type ServiceKey,
} from "../domain/constants";
import { todayKey } from "./dates";
import { scoreHistogram } from "./stats";
import { PAGE_SIZE, companyOrderBy, companyWhere, type CompanyFilters } from "./filters";

/** Closed statuses: excluded from priorities and follow-up reminders. */
export const CLOSED_STATUSES: CrmStatus[] = ["won", "lost"];

/** Score at or above which a company is considered a priority (same band as ScoreBadge). */
export const PRIORITY_SCORE = 70;

// ── Current analysis ─────────────────────────────────────────────

/**
 * Id of each company's latest completed analysis. Findings and opportunities
 * are only "current" when they belong to one of these.
 */
export async function currentAnalysisIds(companyIds?: string[]): Promise<string[]> {
  const rows = await db.analysis.findMany({
    where: { status: "completed", ...(companyIds && { companyId: { in: companyIds } }) },
    orderBy: [{ finishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: { id: true, companyId: true },
  });
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const r of rows) {
    if (seen.has(r.companyId)) continue;
    seen.add(r.companyId);
    ids.push(r.id);
  }
  return ids;
}

const IMPACT_RANK: Record<ImpactLevel, number> = { high: 3, medium: 2, low: 1 };

export interface OpportunitySummary {
  id: string;
  title: string;
  serviceKey: string;
  impact: string;
  confidence: number;
}

function rankOpportunities<T extends { impact: string; confidence: number }>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      (IMPACT_RANK[b.impact as ImpactLevel] ?? 0) - (IMPACT_RANK[a.impact as ImpactLevel] ?? 0) ||
      b.confidence - a.confidence,
  );
}

/** Best current (non-dismissed) opportunity per company, by impact then confidence. */
async function topOpportunityByCompany(companyIds: string[]): Promise<Map<string, OpportunitySummary>> {
  if (companyIds.length === 0) return new Map();
  const analysisIds = await currentAnalysisIds(companyIds);
  const opps = await db.opportunity.findMany({
    where: { analysisId: { in: analysisIds }, status: { not: "dismissed" } },
    select: { id: true, companyId: true, title: true, serviceKey: true, impact: true, confidence: true },
  });
  const byCompany = new Map<string, OpportunitySummary[]>();
  for (const o of opps) byCompany.set(o.companyId, [...(byCompany.get(o.companyId) ?? []), o]);
  return new Map([...byCompany].map(([id, list]) => [id, rankOpportunities(list)[0]]));
}

// ── Companies list ───────────────────────────────────────────────

const listSelect = {
  id: true,
  name: true,
  niche: true,
  city: true,
  website: true,
  rating: true,
  reviewCount: true,
  crmStatus: true,
  score: true,
  opportunityCount: true,
  analysisStatus: true,
  followUpAt: true,
  owner: true,
} satisfies Prisma.CompanySelect;

export type CompanyListRow = Prisma.CompanyGetPayload<{ select: typeof listSelect }> & {
  topOpportunity: OpportunitySummary | null;
};

export async function listCompanies(f: CompanyFilters) {
  const current = f.problem || f.service ? await currentAnalysisIds() : [];
  const where = companyWhere(f, current);
  const total = await db.company.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, pageCount);
  const rows = await db.company.findMany({
    where,
    orderBy: companyOrderBy(f),
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: listSelect,
  });
  const top = await topOpportunityByCompany(rows.map((r) => r.id));
  return {
    rows: rows.map((r): CompanyListRow => ({ ...r, topOpportunity: top.get(r.id) ?? null })),
    total,
    page,
    pageCount,
  };
}

export interface OptionCount {
  value: string;
  label: string;
  count: number;
}

/** Distinct companies per issue key in current analyses, most frequent first. */
async function issueCounts(current: string[]): Promise<OptionCount[]> {
  const findings = await db.finding.findMany({
    where: { kind: "issue", analysisId: { in: current } },
    select: { key: true, label: true, companyId: true },
  });
  const byKey = new Map<string, { label: string; companies: Set<string> }>();
  for (const f of findings) {
    const entry = byKey.get(f.key) ?? { label: f.label, companies: new Set<string>() };
    entry.companies.add(f.companyId);
    byKey.set(f.key, entry);
  }
  return [...byKey]
    .map(([value, e]) => ({ value, label: e.label, count: e.companies.size }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
}

export interface ServiceCount {
  key: ServiceKey;
  /** Companies with at least one current opportunity for this service */
  companies: number;
  /** …of which have a high-impact one */
  highImpact: number;
}

async function serviceCounts(current: string[]): Promise<ServiceCount[]> {
  const opps = await db.opportunity.findMany({
    where: { analysisId: { in: current }, status: { not: "dismissed" } },
    select: { serviceKey: true, companyId: true, impact: true },
  });
  const map = new Map<string, { all: Set<string>; high: Set<string> }>();
  for (const o of opps) {
    const e = map.get(o.serviceKey) ?? { all: new Set<string>(), high: new Set<string>() };
    e.all.add(o.companyId);
    if (o.impact === "high") e.high.add(o.companyId);
    map.set(o.serviceKey, e);
  }
  return [...map]
    .filter(([k]) => (SERVICE_KEYS as string[]).includes(k))
    .map(([k, e]) => ({ key: k as ServiceKey, companies: e.all.size, highImpact: e.high.size }))
    .sort((a, b) => b.companies - a.companies || b.highImpact - a.highImpact);
}

/** Values for the filter dropdowns, taken from the data actually stored. */
export async function companyFilterOptions() {
  const current = await currentAnalysisIds();
  const [niches, cities, problems, services] = await Promise.all([
    db.company.groupBy({ by: ["niche"], where: { niche: { not: null } }, _count: { _all: true } }),
    db.company.groupBy({ by: ["city"], where: { city: { not: null } }, _count: { _all: true } }),
    issueCounts(current),
    serviceCounts(current),
  ]);
  const toOptions = (rows: { value: string | null; count: number }[]): OptionCount[] =>
    rows
      .filter((r): r is { value: string; count: number } => r.value != null)
      .map((r) => ({ value: r.value, label: r.value, count: r.count }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  return {
    niches: toOptions(niches.map((n) => ({ value: n.niche, count: n._count._all }))),
    cities: toOptions(cities.map((c) => ({ value: c.city, count: c._count._all }))),
    problems,
    services,
  };
}

// ── Pipeline ─────────────────────────────────────────────────────

export const BOARD_COLUMN_LIMIT = 50;

const cardSelect = {
  id: true,
  name: true,
  city: true,
  niche: true,
  score: true,
  opportunityCount: true,
  owner: true,
  nextAction: true,
  followUpAt: true,
  crmStatus: true,
} satisfies Prisma.CompanySelect;

export type PipelineCard = Prisma.CompanyGetPayload<{ select: typeof cardSelect }>;

/** Start of today as stored follow-ups compare: anything before is overdue. */
function startOfTodayUtc(now = new Date()): Date {
  return new Date(`${todayKey(now)}T00:00:00Z`);
}

export async function pipelineData(opts: { owner: string | null }) {
  const ownerWhere: Prisma.CompanyWhereInput = opts.owner ? { owner: opts.owner } : {};
  const [groups, owners, followUps, overdue] = await Promise.all([
    db.company.groupBy({ by: ["crmStatus"], where: ownerWhere, _count: { _all: true } }),
    db.company.groupBy({ by: ["owner"], where: { owner: { not: null } }, _count: { _all: true } }),
    db.company.findMany({
      where: { ...ownerWhere, followUpAt: { not: null }, crmStatus: { notIn: CLOSED_STATUSES } },
      orderBy: [{ followUpAt: "asc" }, { name: "asc" }],
      take: 25,
      select: cardSelect,
    }),
    db.company.count({
      where: { ...ownerWhere, followUpAt: { lt: startOfTodayUtc() }, crmStatus: { notIn: CLOSED_STATUSES } },
    }),
  ]);
  const counts = new Map(groups.map((g) => [g.crmStatus, g._count._all]));
  const columns = await Promise.all(
    CRM_STATUSES.map(async (status) => ({
      status,
      count: counts.get(status) ?? 0,
      cards: await db.company.findMany({
        where: { ...ownerWhere, crmStatus: status },
        orderBy: [{ score: { sort: "desc", nulls: "last" } }, { followUpAt: { sort: "asc", nulls: "last" } }, { name: "asc" }],
        take: BOARD_COLUMN_LIMIT,
        select: cardSelect,
      }),
    })),
  );
  return {
    columns,
    owners: owners
      .filter((o): o is typeof o & { owner: string } => o.owner != null)
      .map((o) => ({ value: o.owner, label: o.owner, count: o._count._all }))
      .sort((a, b) => a.label.localeCompare(b.label, "es")),
    followUps,
    overdue,
  };
}

/** Owners already used, for the CRM panel's suggestions. */
export async function knownOwners(): Promise<string[]> {
  const rows = await db.company.groupBy({ by: ["owner"], where: { owner: { not: null } } });
  return rows.map((r) => r.owner!).sort((a, b) => a.localeCompare(b, "es"));
}

// ── Dashboard ────────────────────────────────────────────────────

export async function dashboardData() {
  const current = await currentAnalysisIds();
  const activeStatuses: CrmStatus[] = ["contacted", "replied", "meeting", "proposal"];
  const [
    total,
    analyzed,
    analysisPending,
    analysisFailed,
    priorityCount,
    activePipeline,
    overdue,
    scoreRows,
    statusGroups,
    problems,
    services,
    priorityRows,
    upcoming,
    activity,
    lastSearch,
  ] = await Promise.all([
    db.company.count(),
    db.company.count({ where: { analysisStatus: "completed" } }),
    db.company.count({ where: { analysisStatus: { in: ["queued", "running"] } } }),
    db.company.count({ where: { analysisStatus: "failed" } }),
    db.company.count({ where: { score: { gte: PRIORITY_SCORE }, crmStatus: { notIn: CLOSED_STATUSES } } }),
    db.company.count({ where: { crmStatus: { in: activeStatuses } } }),
    db.company.count({ where: { followUpAt: { lt: startOfTodayUtc() }, crmStatus: { notIn: CLOSED_STATUSES } } }),
    db.company.findMany({ where: { score: { not: null } }, select: { score: true } }),
    db.company.groupBy({ by: ["crmStatus"], _count: { _all: true } }),
    issueCounts(current),
    serviceCounts(current),
    db.company.findMany({
      where: { score: { not: null }, crmStatus: { notIn: CLOSED_STATUSES } },
      orderBy: [{ score: "desc" }, { opportunityCount: "desc" }, { name: "asc" }],
      take: 8,
      select: { id: true, name: true, city: true, niche: true, score: true, opportunityCount: true, crmStatus: true },
    }),
    db.company.findMany({
      where: { followUpAt: { not: null }, crmStatus: { notIn: CLOSED_STATUSES } },
      orderBy: [{ followUpAt: "asc" }, { name: "asc" }],
      take: 6,
      select: { id: true, name: true, followUpAt: true, nextAction: true, owner: true },
    }),
    db.activity.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { company: { select: { id: true, name: true } }, search: { select: { id: true, query: true } } },
    }),
    db.search.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);
  const top = await topOpportunityByCompany(priorityRows.map((r) => r.id));
  const statusCounts = new Map(statusGroups.map((g) => [g.crmStatus, g._count._all]));

  return {
    totals: { total, analyzed, analysisPending, analysisFailed, priorityCount, activePipeline, overdue },
    hasSearches: lastSearch != null,
    histogram: scoreHistogram(scoreRows.map((r) => r.score!)),
    scoredCount: scoreRows.length,
    problems: problems.slice(0, 8),
    services: services.slice(0, 8),
    pipeline: CRM_STATUSES.map((s) => ({ status: s, count: statusCounts.get(s) ?? 0 })),
    priority: priorityRows.map((r) => ({ ...r, topOpportunity: top.get(r.id) ?? null })),
    upcoming,
    activity,
  };
}

// ── CRM panel ────────────────────────────────────────────────────

const CRM_ACTIVITY_TYPES = ["status_changed", "owner_changed", "followup_set", "note_added", "note_updated", "note_deleted"];

export async function crmPanelData(companyId: string) {
  const [company, notes, history, owners] = await Promise.all([
    db.company.findUnique({
      where: { id: companyId },
      select: { id: true, crmStatus: true, owner: true, nextAction: true, followUpAt: true },
    }),
    db.note.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } }),
    db.activity.findMany({
      where: { companyId, type: { in: CRM_ACTIVITY_TYPES } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    knownOwners(),
  ]);
  return company ? { company, notes, history, owners } : null;
}
