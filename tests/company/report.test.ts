import { describe, expect, it } from "vitest";
import { buildReportContent, readableEvidence, ReportNotReadyError, type ReportInput } from "@/lib/reports/snapshot";
import { reportContentSchema } from "@/lib/reports/schema";
import { recommendServices } from "@/lib/reports/services";
import { deriveNextActions, isSpanishMobile, type NextActionInput } from "@/lib/reports/next-actions";
import { outreachInput } from "./fixtures";

function reportInput(overrides: Partial<ReportInput> = {}): ReportInput {
  return {
    ...outreachInput(),
    details: { category: "Clínica dental", address: "Calle Ejemplo 1, Madrid" },
    analysis: { summary: "Resumen de prueba.", finishedAt: new Date("2026-10-01T10:00:00Z"), generator: "rules" },
    providers: ["osm", "google_places", "website"],
    preparedBy: "Consultora Ejemplo",
    now: new Date("2026-10-02T09:00:00Z"),
    ...overrides,
  };
}

describe("buildReportContent", () => {
  it("produces a valid snapshot with problems, opportunities by priority and qualitative impact", () => {
    const content = buildReportContent(reportInput());
    expect(reportContentSchema.safeParse(content).success).toBe(true);
    expect(content.situation.summary).toBe("Resumen de prueba.");
    expect(content.problems.map((p) => p.title)).toEqual(["Sin WhatsApp"]);
    expect(content.strengths.map((p) => p.title)).toEqual(["Teléfono visible en la cabecera"]);
    expect(content.opportunities.map((o) => o.id)).toEqual(["o-high", "o-low"]);
    expect(content.opportunities[0].service).toBe("WhatsApp Business automatizado");
    expect(content.recommendations[0]).toEqual({
      title: "Sin canal de WhatsApp",
      detail: "Activar WhatsApp Business con respuesta automática y derivación al equipo.",
    });
    expect(content.impact.overall).toContain("2 oportunidades (1 de impacto alto, 1 de impacto bajo)");
    expect(content.impact.overall).toContain("heurísticos");
    expect(content.impact.notes).toHaveLength(1);
    expect(content.sources).toEqual([
      "OpenStreetMap",
      "Google Places",
      "Web de la empresa (dental-ejemplo.test), revisada el 01 oct 2026",
    ]);
  });

  it("attributes the rating to its source", () => {
    const facts = Object.fromEntries(buildReportContent(reportInput()).situation.facts.map((f) => [f.label, f.value]));
    expect(facts["Valoración"]).toMatch(/^4,7 \/ 5 \(\d+ reseñas\) · Fuente: Google Places$/);
  });

  it("states missing data instead of inventing it", () => {
    const base = reportInput();
    const content = buildReportContent({ ...base, company: { ...base.company, rating: null, reviewCount: null, email: null }, socials: [] });
    const facts = Object.fromEntries(content.situation.facts.map((f) => [f.label, f.value]));
    expect(facts["Valoración"]).toBe("No disponible en las fuentes consultadas");
    expect(facts["Email"]).toBe("No disponible");
    expect(facts["Redes sociales"]).toBe("No se han encontrado perfiles enlazados");
  });

  it("requires a completed analysis", () => {
    expect(() => buildReportContent(reportInput({ analysis: null }))).toThrow(ReportNotReadyError);
  });
});

describe("readableEvidence", () => {
  it("replaces raw code snippets with the tool name, or the page link it points to", () => {
    expect(readableEvidence("Joinchat: …nt-size--huge) !important;} :where(.wp-block-joinchat-button.is-layout-flex){gap: 10px;}…")).toBe(
      "Joinchat (detectado en el código de la web)",
    );
    expect(
      readableEvidence('Doctoralia: …id="zl-url" class="zl-url" href="https://www.doctoralia.es/lucia-gil-raga/dentista/valencia" rel="nofollow"…'),
    ).toBe("Doctoralia: https://www.doctoralia.es/lucia-gil-raga/dentista/valencia");
    expect(readableEvidence('Trustindex (Google reviews): …<img src="https://cdn.trustindex.io/assets/platform/Google/star/f.svg" alt="Goog…')).toBe(
      "Trustindex (Google reviews) (detectado en el código de la web)",
    );
  });

  it("keeps plain evidence untouched", () => {
    const plain = "Formulario en https://ejemplo.es/: Nombre *, Teléfono * (botón \"Enviar\") · https://wa.me/34600000000";
    expect(readableEvidence(plain)).toBe(plain);
    expect(readableEvidence("Valoración 4,9/5 con 494 reseñas en Google Places.")).toBe("Valoración 4,9/5 con 494 reseñas en Google Places.");
  });
});

describe("recommendServices", () => {
  it("groups opportunities by service, strongest first", () => {
    const services = recommendServices(outreachInput().opportunities);
    expect(services.map((s) => s.key)).toEqual(["whatsapp_automation", "review_management"]);
    expect(services[0]).toMatchObject({ impact: "high", confidence: 0.85, opportunities: [{ id: "o-high", title: "Sin canal de WhatsApp" }] });
  });
});

describe("deriveNextActions", () => {
  const base: NextActionInput = {
    crmStatus: "analyzed",
    nextAction: null,
    followUpAt: null,
    analysisStatus: "completed",
    hasAnalysis: true,
    opportunityCount: 2,
    hasMessages: false,
    hasReport: false,
    email: "hola@dental-ejemplo.test",
    phone: null,
    hasLinkedin: false,
    businessStatus: "operational",
    now: new Date("2026-10-10T00:00:00Z"),
  };
  const labels = (i: Partial<NextActionInput>) => deriveNextActions({ ...base, ...i }).map((a) => a.label);

  it("walks the company through analyse → message → contact → report", () => {
    expect(labels({ hasAnalysis: false, analysisStatus: "none", opportunityCount: 0 })).toEqual(["Analizar la web y la presencia digital"]);
    expect(labels({})).toEqual(["Preparar el mensaje de contacto"]);
    expect(labels({ hasMessages: true })).toEqual(["Enviar el primer contacto por email"]);
    expect(labels({ hasMessages: true, email: null, phone: "+34 612 34 56 78" })).toEqual(["Enviar el primer contacto por WhatsApp"]);
    expect(labels({ hasMessages: true, crmStatus: "meeting" })).toEqual(["Generar el informe para la reunión"]);
  });

  it("flags overdue follow-ups, closed businesses and missing contact data", () => {
    const actions = deriveNextActions({
      ...base,
      nextAction: "Llamar a la directora",
      followUpAt: new Date("2026-10-01T00:00:00Z"),
      businessStatus: "closed_permanently",
      email: null,
      phone: null,
    });
    expect(actions[0]).toMatchObject({ tone: "warning", label: "La fuente indica cierre definitivo" });
    expect(actions[1]).toMatchObject({ tone: "warning", label: "Llamar a la directora", detail: "Seguimiento vencido desde el 01 oct 2026" });
    expect(actions.at(-1)?.label).toBe("Buscar un contacto directo");
  });

  it("recognises Spanish mobile numbers", () => {
    expect(isSpanishMobile("+34612345678")).toBe(true);
    expect(isSpanishMobile("712345678")).toBe(true);
    expect(isSpanishMobile("+34910000001")).toBe(false);
    expect(isSpanishMobile(null)).toBe(false);
  });
});
