/**
 * Messages and reports against a throwaway SQLite database seeded with an
 * obviously fictional company and analysis (no network, no real data).
 */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { outreachInput } from "../company/fixtures";

const DB_FILE = "prisma/test-outreach.db";
process.env.DATABASE_URL = "file:./test-outreach.db";
delete process.env.ANTHROPIC_API_KEY;
process.env.OUTREACH_SENDER_NAME = "Laura";

let db: typeof import("@/lib/db").db;
let messages: typeof import("@/lib/messages/generate");
let reports: typeof import("@/lib/reports/generate");
let pdf: typeof import("@/lib/reports/pdf");

async function seedCompany({ analysed }: { analysed: boolean }) {
  const f = outreachInput();
  const company = await db.company.create({
    data: {
      name: f.company.name,
      normalizedName: "clinica dental ejemplo",
      niche: f.company.niche,
      category: f.company.category,
      city: f.company.city,
      website: f.company.website,
      domain: "dental-ejemplo.test",
      phone: f.company.phone,
      email: f.company.email,
      rating: f.company.rating,
      reviewCount: f.company.reviewCount,
      fieldSources: f.company.fieldSources,
      analysisStatus: analysed ? "completed" : "none",
      sources: { create: [{ provider: "osm", externalId: `node/${Math.random()}`, payload: {} }] },
    },
  });
  if (!analysed) return company;
  const analysis = await db.analysis.create({
    data: {
      companyId: company.id,
      status: "completed",
      version: "test",
      url: f.analyzedUrl,
      finalUrl: f.analyzedUrl,
      summary: "Resumen de prueba.",
      generator: "rules",
      finishedAt: new Date("2026-10-01T10:00:00Z"),
    },
  });
  for (const { id: _id, ...finding } of f.findings) {
    await db.finding.create({ data: { ...finding, companyId: company.id, analysisId: analysis.id } });
  }
  for (const { id: _id, ...o } of f.opportunities) {
    await db.opportunity.create({ data: { ...o, companyId: company.id, analysisId: analysis.id } });
  }
  // A dismissed opportunity must never reach messages or reports.
  await db.opportunity.create({
    data: { ...f.opportunities[1], id: undefined, title: "Descartada", impact: "high", confidence: 1, status: "dismissed", companyId: company.id, analysisId: analysis.id },
  });
  await db.score.create({
    data: {
      companyId: company.id,
      analysisId: analysis.id,
      total: 72,
      version: "test",
      breakdown: [{ factor: "issues", label: "Problemas", weight: 1, value: 0.72, points: 72, explanation: "Prueba" }],
    },
  });
  return company;
}

beforeAll(async () => {
  rmSync(DB_FILE, { force: true });
  execSync("npx prisma migrate deploy", { env: { ...process.env }, stdio: "ignore" });
  db = (await import("@/lib/db")).db;
  messages = await import("@/lib/messages/generate");
  reports = await import("@/lib/reports/generate");
  pdf = await import("@/lib/reports/pdf");
}, 60_000);

afterAll(async () => {
  await db?.$disconnect();
  rmSync(DB_FILE, { force: true });
  rmSync(`${DB_FILE}-journal`, { force: true });
});

describe("outreach messages", () => {
  it("generates and stores one message per channel with its basis, and logs activity", async () => {
    const company = await seedCompany({ analysed: true });
    const result = await messages.generateMessagesForCompany(company.id);
    expect(result).toEqual({ generator: "rules", warning: null });

    const { latest, versions } = await messages.latestMessages(company.id);
    expect(versions).toBe(3);
    expect([...latest.keys()].sort()).toEqual(["email", "linkedin", "whatsapp"]);
    const email = latest.get("email")!;
    expect(email.subject).toBe("WhatsApp en Clínica Dental Ejemplo");
    expect(email.body).toContain("Un saludo,\nLaura");
    expect(email.body).not.toContain("Descartada");
    expect((email.basis as { opportunityIds: string[] }).opportunityIds).toHaveLength(1);

    await messages.generateMessagesForCompany(company.id);
    expect((await messages.latestMessages(company.id)).versions).toBe(6);

    const activity = await db.activity.findMany({ where: { companyId: company.id, type: "message_generated" } });
    expect(activity).toHaveLength(2);
  });

  it("refuses without an analysis", async () => {
    const company = await seedCompany({ analysed: false });
    await expect(messages.generateMessagesForCompany(company.id)).rejects.toThrow(/evidencia suficiente/);
    expect(await db.message.count({ where: { companyId: company.id } })).toBe(0);
  });
});

describe("reports", () => {
  it("freezes a snapshot, reloads it and renders a PDF", async () => {
    const company = await seedCompany({ analysed: true });
    const report = await reports.createReportForCompany(company.id);
    const loaded = await reports.loadReport(company.id, report.id);
    expect(loaded?.content?.opportunities.map((o) => o.title)).toEqual(["Sin canal de WhatsApp", "Reseñas sin respuesta"]);
    expect(loaded?.content?.preparedBy).toBe("Laura");

    // Wrong company id never leaks another company's report.
    expect(await reports.loadReport("otra", report.id)).toBeNull();

    const buffer = await pdf.renderReportPdf(loaded!.content!);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(3000);

    expect(reports.reportFileName("Clínica Dental Ejemplo, S.L.", report.createdAt)).toMatch(/^informe-clinica-dental-ejemplo-s-l-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(await db.activity.count({ where: { companyId: company.id, type: "report_generated" } })).toBe(1);
  });

  it("requires a completed analysis", async () => {
    const company = await seedCompany({ analysed: false });
    await expect(reports.createReportForCompany(company.id)).rejects.toThrow(/tiene que estar analizada/);
  });
});
