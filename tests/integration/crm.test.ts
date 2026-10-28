/**
 * CRM mutations and list/dashboard queries against a throwaway SQLite
 * database. All companies are obviously fictional ("… Ejemplo").
 */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DB_FILE = "prisma/test-crm.db";
process.env.DATABASE_URL = "file:./test-crm.db";

type Db = typeof import("@/lib/db").db;
let db: Db;
let m: typeof import("@/lib/crm/mutations");
let q: typeof import("@/lib/crm/queries");
let parse: typeof import("@/lib/crm/filters").parseCompanyFilters;

const ids = { a: "", b: "", c: "" };

async function company(name: string, data: Record<string, unknown> = {}) {
  const c = await db.company.create({
    data: { name, normalizedName: name.toLowerCase(), niche: "Clínicas dentales", city: "Ciudad Ejemplo", ...data },
  });
  return c.id;
}

async function analysis(companyId: string, finishedAt: Date, issues: string[], services: [string, string][]) {
  const a = await db.analysis.create({ data: { companyId, status: "completed", version: "test", finishedAt } });
  for (const key of issues) {
    await db.finding.create({
      data: { analysisId: a.id, companyId, category: "contact", key, label: `Etiqueta ${key}`, kind: "issue", severity: "medium", evidence: "prueba" },
    });
  }
  for (const [serviceKey, impact] of services) {
    await db.opportunity.create({
      data: {
        companyId,
        analysisId: a.id,
        type: serviceKey,
        title: `Oportunidad ${serviceKey}`,
        problem: "p",
        evidence: "e",
        consequence: "c",
        solution: "s",
        serviceKey,
        impact,
        confidence: 0.7,
      },
    });
  }
  return a.id;
}

beforeAll(async () => {
  rmSync(DB_FILE, { force: true });
  execSync("npx prisma migrate deploy", { env: { ...process.env }, stdio: "ignore" });
  db = (await import("@/lib/db")).db;
  m = await import("@/lib/crm/mutations");
  q = await import("@/lib/crm/queries");
  parse = (await import("@/lib/crm/filters")).parseCompanyFilters;

  ids.a = await company("Clínica Ejemplo Alfa", { score: 82, opportunityCount: 2, analysisStatus: "completed", website: "https://alfa.example" });
  ids.b = await company("Clínica Ejemplo Beta", { score: 45, opportunityCount: 1, analysisStatus: "completed", rating: 4.6, reviewCount: 120 });
  ids.c = await company("Clínica Ejemplo Gamma", { city: "Otra Ciudad Ejemplo" });

  // Alfa was analysed twice: only the latest run must count.
  await analysis(ids.a, new Date("2026-10-01T10:00:00Z"), ["no_whatsapp", "no_booking"], [["online_booking", "high"]]);
  await analysis(ids.a, new Date("2026-10-20T10:00:00Z"), ["no_whatsapp"], [["whatsapp_automation", "high"], ["review_management", "low"]]);
  await analysis(ids.b, new Date("2026-10-15T10:00:00Z"), ["no_whatsapp", "slow_site"], [["whatsapp_automation", "medium"]]);
}, 60_000);

afterAll(async () => {
  await db?.$disconnect();
  rmSync(DB_FILE, { force: true });
  rmSync(`${DB_FILE}-journal`, { force: true });
});

describe("CRM mutations", () => {
  it("changes status once and logs the change", async () => {
    expect(await m.setCrmStatus(ids.a, "priority")).toBe(true);
    expect(await m.setCrmStatus(ids.a, "priority")).toBe(false);
    const c = await db.company.findUniqueOrThrow({ where: { id: ids.a } });
    expect(c.crmStatus).toBe("priority");
    const log = await db.activity.findMany({ where: { companyId: ids.a, type: "status_changed" } });
    expect(log).toHaveLength(1);
    expect(log[0].message).toBe("Estado cambiado de Nueva a Prioritaria");
  });

  it("rejects unknown companies", async () => {
    await expect(m.setCrmStatus("missing", "won")).rejects.toBeInstanceOf(m.CrmNotFoundError);
  });

  it("bulk-updates and skips companies already in the status", async () => {
    expect(await m.setCrmStatusBulk([ids.a, ids.b, "missing"], "contacted")).toBe(2);
    expect(await m.setCrmStatusBulk([ids.a, ids.b], "contacted")).toBe(0);
  });

  it("saves owner and follow-up with one activity per change", async () => {
    const followUpAt = new Date("2026-10-30T12:00:00Z");
    expect(await m.updateCrmDetails(ids.b, { owner: "Ana", nextAction: "Llamar", followUpAt })).toEqual({ changed: true });
    expect(await m.updateCrmDetails(ids.b, { owner: "Ana", nextAction: "Llamar", followUpAt })).toEqual({ changed: false });
    const types = (await db.activity.findMany({ where: { companyId: ids.b }, orderBy: { createdAt: "asc" } })).map((a) => a.type);
    expect(types.filter((t) => t === "owner_changed")).toHaveLength(1);
    expect(types.filter((t) => t === "followup_set")).toHaveLength(1);
    const c = await db.company.findUniqueOrThrow({ where: { id: ids.b } });
    expect([c.owner, c.nextAction, c.followUpAt?.toISOString()]).toEqual(["Ana", "Llamar", followUpAt.toISOString()]);
  });

  it("adds, edits and deletes notes", async () => {
    const note = await m.addNote(ids.c, "Primera llamada sin respuesta");
    await m.updateNote(note.id, "Primera llamada: buzón de voz");
    expect((await db.note.findUniqueOrThrow({ where: { id: note.id } })).body).toBe("Primera llamada: buzón de voz");
    await m.deleteNote(note.id);
    expect(await db.note.count({ where: { companyId: ids.c } })).toBe(0);
    const types = (await db.activity.findMany({ where: { companyId: ids.c } })).map((a) => a.type).sort();
    expect(types).toEqual(["note_added", "note_deleted", "note_updated"]);
    await expect(m.deleteNote(note.id)).rejects.toBeInstanceOf(m.CrmNotFoundError);
  });
});

describe("CRM queries", () => {
  it("filters by problem and service using only the latest analysis", async () => {
    const booking = await q.listCompanies(parse({ problem: "no_booking" }));
    expect(booking.total).toBe(0); // only in Alfa's superseded analysis
    const whatsapp = await q.listCompanies(parse({ problem: "no_whatsapp" }));
    expect(whatsapp.rows.map((r) => r.name)).toEqual(["Clínica Ejemplo Alfa", "Clínica Ejemplo Beta"]);
    const svc = await q.listCompanies(parse({ service: "online_booking" }));
    expect(svc.total).toBe(0);
  });

  it("sorts by score with unscored companies last and picks the top opportunity", async () => {
    const all = await q.listCompanies(parse({}));
    expect(all.rows.map((r) => r.name)).toEqual(["Clínica Ejemplo Alfa", "Clínica Ejemplo Beta", "Clínica Ejemplo Gamma"]);
    expect(all.rows[0].topOpportunity?.serviceKey).toBe("whatsapp_automation");
    expect(all.rows[2].topOpportunity).toBeNull();
  });

  it("filters by rating, reviews, city and website", async () => {
    expect((await q.listCompanies(parse({ ratingMin: "4.5", reviewsMin: "100" }))).rows.map((r) => r.name)).toEqual(["Clínica Ejemplo Beta"]);
    expect((await q.listCompanies(parse({ city: "Otra Ciudad Ejemplo" }))).total).toBe(1);
    expect((await q.listCompanies(parse({ web: "yes" }))).rows.map((r) => r.name)).toEqual(["Clínica Ejemplo Alfa"]);
  });

  it("builds filter options from current data", async () => {
    const o = await q.companyFilterOptions();
    expect(o.problems).toEqual([
      { value: "no_whatsapp", label: "Etiqueta no_whatsapp", count: 2 },
      { value: "slow_site", label: "Etiqueta slow_site", count: 1 },
    ]);
    expect(o.services[0]).toEqual({ key: "whatsapp_automation", companies: 2, highImpact: 1 });
    expect(o.cities.map((c) => c.value)).toEqual(["Ciudad Ejemplo", "Otra Ciudad Ejemplo"]);
  });

  it("summarises the dashboard", async () => {
    const d = await q.dashboardData();
    expect(d.totals).toMatchObject({ total: 3, analyzed: 2, priorityCount: 1, activePipeline: 2 });
    expect(d.histogram.find((b) => b.from === 80)?.count).toBe(1);
    expect(d.pipeline.find((p) => p.status === "contacted")?.count).toBe(2);
    expect(d.problems[0]).toMatchObject({ value: "no_whatsapp", count: 2 });
    expect(d.activity.length).toBeGreaterThan(0);
  });

  it("returns the pipeline board and CRM panel data", async () => {
    const p = await q.pipelineData({ owner: null });
    expect(p.columns).toHaveLength(9);
    expect(p.columns.find((c) => c.status === "contacted")?.cards.map((c) => c.name)).toEqual([
      "Clínica Ejemplo Alfa",
      "Clínica Ejemplo Beta",
    ]);
    expect(p.followUps.map((c) => c.name)).toEqual(["Clínica Ejemplo Beta"]);
    expect((await q.pipelineData({ owner: "Ana" })).columns.reduce((n, c) => n + c.count, 0)).toBe(1);

    const panel = await q.crmPanelData(ids.b);
    expect(panel?.company.owner).toBe("Ana");
    expect(panel?.owners).toEqual(["Ana"]);
    expect(panel?.history.length).toBeGreaterThan(0);
    expect(await q.crmPanelData("missing")).toBeNull();
  });
});
