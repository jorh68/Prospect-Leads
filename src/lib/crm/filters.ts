/**
 * Companies list filters. The URL is the single source of truth: pages parse
 * `searchParams` into `CompanyFilters`, build the Prisma query from them and
 * build links (sorting, pagination, removing a filter) back from them.
 * Pure module — no database access — so it is unit-tested directly.
 */
import type { Prisma } from "@prisma/client";
import {
  ANALYSIS_STATUS_LABELS,
  ANALYSIS_STATUSES,
  CRM_STATUS_LABELS,
  CRM_STATUSES,
  SERVICE_KEYS,
  SERVICES,
  type AnalysisStatus,
  type CrmStatus,
  type ServiceKey,
} from "../domain/constants";
import { normalizeText } from "../text";

export const COMPANY_SORTS = {
  score: "Puntuación",
  name: "Nombre",
  rating: "Valoración",
  reviews: "Reseñas",
  opportunities: "Oportunidades",
  followUp: "Seguimiento",
  created: "Fecha de alta",
} as const;
export type CompanySort = keyof typeof COMPANY_SORTS;

export const PAGE_SIZE = 50;

export interface CompanyFilters {
  q: string;
  niche: string | null;
  city: string | null;
  status: CrmStatus | null;
  analysis: AnalysisStatus | null;
  scoreMin: number | null;
  scoreMax: number | null;
  oppMin: number | null;
  /** Finding.key of an issue found in the current analysis */
  problem: string | null;
  service: ServiceKey | null;
  ratingMin: number | null;
  reviewsMin: number | null;
  /** "yes" = has a website, "no" = none */
  web: "yes" | "no" | null;
  sort: CompanySort;
  dir: "asc" | "desc";
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

function intIn(v: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
}

function decimalIn(v: string, min: number, max: number): number | null {
  if (!/^\d+([.,]\d+)?$/.test(v)) return null;
  const n = Number(v.replace(",", "."));
  return n >= min && n <= max ? n : null;
}

function oneOf<T extends string>(v: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/** Defaults for the sort direction when only `sort` is given. */
const DEFAULT_DIR: Record<CompanySort, "asc" | "desc"> = {
  score: "desc",
  name: "asc",
  rating: "desc",
  reviews: "desc",
  opportunities: "desc",
  followUp: "asc",
  created: "desc",
};

/** Invalid or out-of-range values are dropped, never thrown. */
export function parseCompanyFilters(sp: RawParams): CompanyFilters {
  const sort = oneOf(first(sp.sort), Object.keys(COMPANY_SORTS) as CompanySort[]) ?? "score";
  const problem = first(sp.problem);
  let scoreMin = intIn(first(sp.scoreMin), 0, 100);
  let scoreMax = intIn(first(sp.scoreMax), 0, 100);
  if (scoreMin != null && scoreMax != null && scoreMin > scoreMax) [scoreMin, scoreMax] = [scoreMax, scoreMin];
  return {
    q: first(sp.q).slice(0, 100),
    niche: first(sp.niche).slice(0, 120) || null,
    city: first(sp.city).slice(0, 120) || null,
    status: oneOf(first(sp.status), CRM_STATUSES),
    analysis: oneOf(first(sp.analysis), ANALYSIS_STATUSES),
    scoreMin,
    scoreMax,
    oppMin: intIn(first(sp.oppMin), 0, 1000),
    problem: /^[a-z0-9_]{1,64}$/.test(problem) ? problem : null,
    service: oneOf(first(sp.service), SERVICE_KEYS),
    ratingMin: decimalIn(first(sp.ratingMin), 0, 5),
    reviewsMin: intIn(first(sp.reviewsMin), 0, 10_000_000),
    web: oneOf(first(sp.web), ["yes", "no"] as const),
    sort,
    dir: oneOf(first(sp.dir), ["asc", "desc"] as const) ?? DEFAULT_DIR[sort],
    page: intIn(first(sp.page), 1, 100_000) ?? 1,
  };
}

/**
 * Prisma `where` for the filters. `currentAnalysisIds` are the ids of each
 * company's latest completed analysis; problem/service filters only look at
 * findings and opportunities from those, so re-analyses never double-count.
 */
export function companyWhere(f: CompanyFilters, currentAnalysisIds: string[] = []): Prisma.CompanyWhereInput {
  const and: Prisma.CompanyWhereInput[] = [];
  if (f.q) and.push({ normalizedName: { contains: normalizeText(f.q) } });
  if (f.niche) and.push({ niche: f.niche });
  if (f.city) and.push({ city: f.city });
  if (f.status) and.push({ crmStatus: f.status });
  if (f.analysis) and.push({ analysisStatus: f.analysis });
  if (f.scoreMin != null || f.scoreMax != null) {
    and.push({ score: { ...(f.scoreMin != null && { gte: f.scoreMin }), ...(f.scoreMax != null && { lte: f.scoreMax }) } });
  }
  if (f.oppMin != null) and.push({ opportunityCount: { gte: f.oppMin } });
  if (f.ratingMin != null) and.push({ rating: { gte: f.ratingMin } });
  if (f.reviewsMin != null) and.push({ reviewCount: { gte: f.reviewsMin } });
  if (f.web === "yes") and.push({ website: { not: null } });
  if (f.web === "no") and.push({ website: null });
  if (f.problem) {
    and.push({ findings: { some: { key: f.problem, kind: "issue", analysisId: { in: currentAnalysisIds } } } });
  }
  if (f.service) {
    and.push({
      opportunities: {
        some: { serviceKey: f.service, status: { not: "dismissed" }, analysisId: { in: currentAnalysisIds } },
      },
    });
  }
  return and.length ? { AND: and } : {};
}

export function companyOrderBy(f: CompanyFilters): Prisma.CompanyOrderByWithRelationInput[] {
  const dir = f.dir;
  const tie: Prisma.CompanyOrderByWithRelationInput[] = [{ normalizedName: "asc" }, { id: "asc" }];
  switch (f.sort) {
    case "name":
      return [{ normalizedName: dir }, { id: "asc" }];
    case "rating":
      return [{ rating: { sort: dir, nulls: "last" } }, { reviewCount: { sort: "desc", nulls: "last" } }, ...tie];
    case "reviews":
      return [{ reviewCount: { sort: dir, nulls: "last" } }, ...tie];
    case "opportunities":
      return [{ opportunityCount: dir }, { score: { sort: "desc", nulls: "last" } }, ...tie];
    case "followUp":
      return [{ followUpAt: { sort: dir, nulls: "last" } }, ...tie];
    case "created":
      return [{ createdAt: dir }, { id: "asc" }];
    case "score":
    default:
      return [{ score: { sort: dir, nulls: "last" } }, { opportunityCount: "desc" }, ...tie];
  }
}

/** Filters that narrow the list (everything except sort and paging). */
const FILTER_KEYS = [
  "q",
  "niche",
  "city",
  "status",
  "analysis",
  "scoreMin",
  "scoreMax",
  "oppMin",
  "problem",
  "service",
  "ratingMin",
  "reviewsMin",
  "web",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export function hasActiveFilters(f: CompanyFilters): boolean {
  return FILTER_KEYS.some((k) => f[k] != null && f[k] !== "");
}

/**
 * Query string for `f` with `overrides` applied. Defaults are omitted so URLs
 * stay short; any filter change resets to page 1 unless `page` is given.
 */
export function companyFiltersQuery(f: CompanyFilters, overrides: Partial<CompanyFilters> = {}): string {
  const next = { ...f, ...overrides };
  if (!("page" in overrides)) next.page = 1;
  const params = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = next[k];
    if (v != null && v !== "") params.set(k, String(v));
  }
  if (next.sort !== "score") params.set("sort", next.sort);
  if (next.dir !== DEFAULT_DIR[next.sort]) params.set("dir", next.dir);
  if (next.page > 1) params.set("page", String(next.page));
  const s = params.toString();
  return s ? `?${s}` : "";
}

export interface FilterChip {
  key: FilterKey;
  label: string;
}

/** Human-readable list of active filters, for removable chips. */
export function activeFilterChips(f: CompanyFilters, problemLabels: Record<string, string> = {}): FilterChip[] {
  const chips: FilterChip[] = [];
  const num = (n: number) => n.toLocaleString("es-ES");
  if (f.q) chips.push({ key: "q", label: `Nombre: “${f.q}”` });
  if (f.niche) chips.push({ key: "niche", label: `Nicho: ${f.niche}` });
  if (f.city) chips.push({ key: "city", label: `Ubicación: ${f.city}` });
  if (f.status) chips.push({ key: "status", label: `Estado: ${CRM_STATUS_LABELS[f.status]}` });
  if (f.analysis) chips.push({ key: "analysis", label: `Análisis: ${ANALYSIS_STATUS_LABELS[f.analysis]}` });
  if (f.scoreMin != null) chips.push({ key: "scoreMin", label: `Puntuación ≥ ${f.scoreMin}` });
  if (f.scoreMax != null) chips.push({ key: "scoreMax", label: `Puntuación ≤ ${f.scoreMax}` });
  if (f.oppMin != null) chips.push({ key: "oppMin", label: `Oportunidades ≥ ${f.oppMin}` });
  if (f.problem) chips.push({ key: "problem", label: `Problema: ${problemLabels[f.problem] ?? f.problem}` });
  if (f.service) chips.push({ key: "service", label: `Servicio: ${SERVICES[f.service].label}` });
  if (f.ratingMin != null) chips.push({ key: "ratingMin", label: `Valoración ≥ ${num(f.ratingMin)}` });
  if (f.reviewsMin != null) chips.push({ key: "reviewsMin", label: `Reseñas ≥ ${num(f.reviewsMin)}` });
  if (f.web) chips.push({ key: "web", label: f.web === "yes" ? "Con web" : "Sin web" });
  return chips;
}
