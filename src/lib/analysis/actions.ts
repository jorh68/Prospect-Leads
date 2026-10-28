"use server";

import { revalidatePath } from "next/cache";
import { enqueueAnalysis } from "../jobs/queue";

/*
 * PLACEHOLDER added by module B so the company page builds before module A
 * lands. Module A owns this file (ARCHITECTURE.md § 8) and replaces it
 * wholesale; keep the signature: (companyId: string) => Promise<void>.
 */
export async function analyzeCompanyAction(companyId: string): Promise<void> {
  await enqueueAnalysis(companyId);
  revalidatePath(`/companies/${companyId}`);
}
