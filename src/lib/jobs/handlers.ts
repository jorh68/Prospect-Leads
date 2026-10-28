import "server-only";
import type { Job } from "@prisma/client";
import type { JobType } from "../domain/constants";
import { runDiscoveryJob } from "../discovery/pipeline";
import { runAnalysisJob } from "../analysis";

export type JobHandler = (job: Job) => Promise<void>;

/** One handler per job type. Modules own their handler; the worker only dispatches. */
export const handlers: Record<JobType, JobHandler> = {
  discovery: runDiscoveryJob,
  analysis: runAnalysisJob,
};

/** Max jobs of each type running at the same time. */
export const typeConcurrency: Record<JobType, number> = {
  discovery: 1,
  analysis: 3,
};
