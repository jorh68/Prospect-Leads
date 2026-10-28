import "server-only";
import { db } from "../db";
import { env } from "../env";
import { logActivity } from "../activity";
import { normalizeText } from "../text";
import { toOutreachInput } from "../messages/generate";
import { loadCompanyDossier } from "./dossier";
import { buildReportContent, ReportNotReadyError } from "./snapshot";
import { reportContentSchema, type ReportContent } from "./schema";

/** Freezes the current state of a company into a new Report row. */
export async function createReportForCompany(companyId: string) {
  const dossier = await loadCompanyDossier(companyId);
  if (!dossier) throw new Error("La empresa no existe");
  if (!dossier.analysis) throw new ReportNotReadyError();

  const c = dossier.company;
  const content = buildReportContent({
    ...toOutreachInput(dossier),
    details: { category: c.category, address: c.address },
    analysis: {
      summary: dossier.analysis.summary,
      finishedAt: dossier.analysis.finishedAt ?? dossier.analysis.createdAt,
      generator: dossier.analysis.generator,
    },
    providers: [...new Set(c.sources.map((s) => s.provider))],
    preparedBy: env().OUTREACH_SENDER_COMPANY ?? env().OUTREACH_SENDER_NAME ?? null,
  });

  return db.$transaction(async (tx) => {
    const report = await tx.report.create({
      data: { companyId, title: `Informe comercial · ${c.name}`, content },
    });
    await logActivity(
      { type: "report_generated", message: "Informe comercial generado", companyId, meta: { reportId: report.id } },
      tx,
    );
    return report;
  });
}

/** Loads a report and validates its snapshot; null when missing or unreadable. */
export async function loadReport(companyId: string, reportId: string) {
  const report = await db.report.findFirst({ where: { id: reportId, companyId } });
  if (!report) return null;
  const parsed = reportContentSchema.safeParse(report.content);
  if (!parsed.success) {
    console.error(`[reports] contenido no válido en ${reportId}:`, parsed.error.issues.slice(0, 3));
    return { report, content: null };
  }
  return { report, content: parsed.data as ReportContent };
}

export function reportFileName(companyName: string, createdAt: Date): string {
  const slug = normalizeText(companyName).replace(/ñ/g, "n").replace(/\s+/g, "-").slice(0, 60) || "empresa";
  return `informe-${slug}-${createdAt.toISOString().slice(0, 10)}.pdf`;
}
