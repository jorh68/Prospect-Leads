import "server-only";
import { db } from "../db";
import { sortOpportunities } from "./priority";
import { fieldSourcesSchema, scoreBreakdownSchema, type FieldSources, type ScoreFactor } from "../domain/types";

/**
 * Everything module B shows about one company, loaded in one place so the
 * company page, the message composer and the report snapshot read the same
 * data. Findings, opportunities and the score always come from the latest
 * *completed* analysis, so a failed re-run never hides earlier results.
 */
export async function loadCompanyDossier(companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      sources: { orderBy: { fetchedAt: "desc" } },
      socialProfiles: { orderBy: { platform: "asc" } },
      searchResults: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { search: { select: { id: true, query: true, createdAt: true } } },
      },
    },
  });
  if (!company) return null;

  const [latestAnalysis, analysis] = await Promise.all([
    db.analysis.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" } }),
    db.analysis.findFirst({
      where: { companyId, status: "completed" },
      orderBy: { createdAt: "desc" },
      include: {
        findings: { orderBy: { createdAt: "asc" } },
        opportunities: { where: { status: "open" }, orderBy: { createdAt: "asc" } },
        scores: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
  ]);

  const scoreRow =
    analysis?.scores[0] ??
    (await db.score.findFirst({ where: { companyId }, orderBy: { createdAt: "desc" } }));
  const breakdown = scoreRow ? scoreBreakdownSchema.safeParse(scoreRow.breakdown) : null;

  const fieldSources = fieldSourcesSchema.safeParse(company.fieldSources);

  return {
    company,
    fieldSources: (fieldSources.success ? fieldSources.data : {}) as FieldSources,
    /** Most recent run, whatever its status (to show progress or errors). */
    latestAnalysis,
    /** Most recent completed run with its findings and open opportunities. */
    analysis,
    findings: analysis?.findings ?? [],
    opportunities: sortOpportunities(analysis?.opportunities ?? []),
    score: scoreRow
      ? {
          total: scoreRow.total,
          version: scoreRow.version,
          createdAt: scoreRow.createdAt,
          breakdown: (breakdown?.success ? breakdown.data : []) as ScoreFactor[],
        }
      : null,
  };
}

export type CompanyDossier = NonNullable<Awaited<ReturnType<typeof loadCompanyDossier>>>;
export type DossierOpportunity = CompanyDossier["opportunities"][number];
export type DossierFinding = CompanyDossier["findings"][number];
