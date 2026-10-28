"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { enqueueAnalysis } from "../jobs/queue";

const idSchema = z.string().min(1).max(64);

/**
 * Queue a (re)analysis of one company. Usable directly as a form action:
 * `<form action={analyzeCompanyAction.bind(null, company.id)}>`.
 * Does nothing if an analysis is already queued or running.
 */
export async function analyzeCompanyAction(companyId: string): Promise<void> {
  const id = idSchema.parse(companyId);
  const exists = await db.company.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new Error("La empresa no existe");
  await enqueueAnalysis(id);
  revalidatePath(`/companies/${id}`);
}
