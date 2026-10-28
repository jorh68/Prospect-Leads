import "server-only";
import type { Job } from "@prisma/client";
import { db } from "../db";
import { NotImplementedError } from "../jobs/errors";

/**
 * Website analysis, opportunity detection and scoring — OWNED BY THREAD A.
 *
 * Contract (see ARCHITECTURE.md § Module A):
 * - Input: a Company id. Read the company and its sources from the database.
 * - Create an Analysis row, then Finding, Opportunity and Score rows linked to it.
 * - Update the company's denormalised fields: score, opportunityCount,
 *   analyzedAt, analysisStatus ("completed" | "failed"), and email/socials
 *   found on the website (with fieldSources[field] = "website").
 * - Log "analysis_completed" / "analysis_failed" activities.
 * - Never invent findings: every Finding/Opportunity carries real evidence.
 *
 * This placeholder fails the job honestly until the module lands.
 */
/** Discovery only queues analyses when this is true. Thread A sets it to true. */
export const analysisAvailable = false;

export async function runAnalysisJob(job: Job): Promise<void> {
  const { companyId } = job.payload as { companyId: string };
  await db.company.update({ where: { id: companyId }, data: { analysisStatus: "none" } });
  throw new NotImplementedError("El análisis de empresas");
}
