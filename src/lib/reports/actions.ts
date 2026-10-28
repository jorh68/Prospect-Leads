"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorMessage } from "../http";
import { createReportForCompany } from "./generate";
import { ReportNotReadyError } from "./snapshot";

export interface ReportActionState {
  error: string | null;
}

export async function createReportAction(companyId: string, _prev: ReportActionState): Promise<ReportActionState> {
  let reportId: string;
  try {
    reportId = (await createReportForCompany(companyId)).id;
  } catch (e) {
    if (!(e instanceof ReportNotReadyError)) console.error(`[reports] no se pudo generar para ${companyId}:`, e);
    return { error: errorMessage(e) };
  }
  revalidatePath(`/companies/${companyId}`);
  redirect(`/companies/${companyId}/report/${reportId}`);
}
