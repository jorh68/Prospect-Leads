import { loadReport, reportFileName } from "@/lib/reports/generate";
import { renderReportPdf } from "@/lib/reports/pdf";

/** Downloads a report snapshot as PDF (rendered on the server). */
export async function GET(request: Request, ctx: RouteContext<"/companies/[id]/report/[reportId]/pdf">) {
  const { id, reportId } = await ctx.params;
  const loaded = await loadReport(id, reportId);
  if (!loaded) return new Response("Informe no encontrado", { status: 404 });
  if (!loaded.content) return new Response("El contenido del informe no es válido", { status: 500 });

  try {
    const pdf = await renderReportPdf(loaded.content);
    const fileName = reportFileName(loaded.content.company.name, loaded.report.createdAt);
    const inline = new URL(request.url).searchParams.has("inline");
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error(`[reports] error al generar el PDF ${reportId}:`, e);
    return new Response("No se pudo generar el PDF. Revisa los logs del servidor.", { status: 500 });
  }
}
