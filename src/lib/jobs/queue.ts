import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import type { JobType } from "../domain/constants";

declare global {
  // Set by the worker so enqueue() can wake it without an import cycle.
  var __prospectWorkerKick: (() => void) | undefined;
}

export interface EnqueueOptions {
  searchId?: string;
  companyId?: string;
}

/** Persist a job and wake the in-process worker. */
export async function enqueueJob(type: JobType, payload: Prisma.InputJsonValue, opts: EnqueueOptions = {}) {
  const job = await db.job.create({
    data: { type, payload, searchId: opts.searchId, companyId: opts.companyId },
  });
  globalThis.__prospectWorkerKick?.();
  return job;
}

export async function setJobProgress(jobId: string, progress: Prisma.InputJsonValue) {
  await db.job.update({ where: { id: jobId }, data: { progress } });
}

/** Queue an analysis for a company unless one is already pending. */
export async function enqueueAnalysis(companyId: string) {
  const pending = await db.job.findFirst({
    where: { type: "analysis", companyId, status: { in: ["queued", "running"] } },
    select: { id: true },
  });
  if (pending) return null;
  await db.company.update({ where: { id: companyId }, data: { analysisStatus: "queued" } });
  return enqueueJob("analysis", { companyId }, { companyId });
}
