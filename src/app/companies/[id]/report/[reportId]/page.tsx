import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { loadReport } from "@/lib/reports/generate";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { ReportView } from "@/components/company/report-view";
import { GenerateReportButton } from "@/components/company/report-button";
import { formatDateTime } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/companies/[id]/report/[reportId]">): Promise<Metadata> {
  const { reportId } = await props.params;
  const r = await db.report.findUnique({ where: { id: reportId }, select: { title: true } });
  return { title: r?.title ?? "Informe" };
}

export default async function ReportPage(props: PageProps<"/companies/[id]/report/[reportId]">) {
  const { id, reportId } = await props.params;
  const loaded = await loadReport(id, reportId);
  if (!loaded) notFound();
  const { report, content } = loaded;
  const company = await db.company.findUnique({ where: { id }, select: { name: true } });
  const pdfHref = `/companies/${id}/report/${reportId}/pdf`;

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-1.5">
            <Link href="/companies" className="hover:text-ink">
              Empresas
            </Link>
            <span aria-hidden>/</span>
            <Link href={`/companies/${id}`} className="hover:text-ink">
              {company?.name ?? "Empresa"}
            </Link>
          </span>
        }
        title="Informe comercial"
        description={`Instantánea del ${formatDateTime(report.createdAt)}. Si el análisis cambia, genera una versión nueva.`}
        actions={
          content ? (
            <>
              <GenerateReportButton companyId={id} label="Nueva versión" />
              <a href={`${pdfHref}?inline=1`} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm")}>
                <FileText aria-hidden />
                Ver PDF
              </a>
              <a href={pdfHref} className={buttonClasses("primary", "sm")}>
                <Download aria-hidden />
                Descargar PDF
              </a>
            </>
          ) : undefined
        }
      />
      <PageBody>
        {content ? (
          <ReportView content={content} />
        ) : (
          <Alert tone="danger" title="No se puede mostrar este informe">
            Su contenido no tiene el formato esperado. Genera una versión nueva desde la ficha de la empresa.
          </Alert>
        )}
      </PageBody>
    </>
  );
}
