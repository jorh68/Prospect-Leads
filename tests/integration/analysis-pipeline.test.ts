/**
 * End-to-end analysis job against a throwaway SQLite database. The company's
 * website is served from saved HTML fixtures (fictional business) through a
 * stubbed fetch, so no network and no real data are involved.
 */
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const DB_FILE = "prisma/test-analysis.db";
process.env.DATABASE_URL = "file:./test-analysis.db";
process.env.ANALYSIS_ALLOW_PRIVATE_HOSTS = "true"; // skip DNS lookups of the fictional .test domains
delete process.env.ANTHROPIC_API_KEY;
delete process.env.PAGESPEED_API_KEY;

const fx = (name: string) => readFileSync(new URL(`../analysis/fixtures/${name}`, import.meta.url), "utf8");

let mod: {
  db: typeof import("@/lib/db").db;
  runAnalysisJob: typeof import("@/lib/analysis").runAnalysisJob;
  enqueueAnalysis: typeof import("@/lib/jobs/queue").enqueueAnalysis;
};

const html = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });

function siteFetch() {
  return vi.fn(async (input: string | URL) => {
    const url = String(input);
    switch (url) {
      case "https://dental-ejemplo.test/":
        return html(fx("dental-home.html"));
      case "https://dental-ejemplo.test/contacto/":
        return html(fx("dental-contacto.html"));
      case "https://dental-ejemplo.test/tratamientos/":
        return new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
      case "http://dental-ejemplo.test/":
        return new Response(null, { status: 301, headers: { location: "https://dental-ejemplo.test/" } });
      default:
        throw new Error(`unexpected fetch ${url}`);
    }
  });
}

const offline = () =>
  vi.fn(async () => {
    throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
  });

async function createCompany(data: { name: string; website: string | null; phone?: string | null; crmStatus?: string }) {
  return mod.db.company.create({
    data: {
      name: data.name,
      normalizedName: data.name.toLowerCase(),
      niche: "Clínicas dentales",
      category: "dentist",
      city: "Madrid",
      website: data.website,
      domain: data.website ? new URL(data.website).hostname : null,
      phone: data.phone ?? "+34912345678",
      crmStatus: data.crmStatus ?? "new",
      fieldSources: { name: "osm", website: "osm", phone: "osm" },
    },
  });
}

async function runFor(companyId: string) {
  const job = await mod.enqueueAnalysis(companyId);
  expect(job).not.toBeNull();
  await mod.runAnalysisJob(job!);
  // The worker marks the job done after the handler returns.
  await mod.db.job.update({ where: { id: job!.id }, data: { status: "completed" } });
}

beforeAll(async () => {
  rmSync(DB_FILE, { force: true });
  execSync("npx prisma migrate deploy", { env: { ...process.env }, stdio: "ignore" });
  const { db } = await import("@/lib/db");
  const { runAnalysisJob } = await import("@/lib/analysis");
  const { enqueueAnalysis } = await import("@/lib/jobs/queue");
  mod = { db, runAnalysisJob, enqueueAnalysis };
}, 60_000);

afterAll(async () => {
  await mod?.db.$disconnect();
  rmSync(DB_FILE, { force: true });
  rmSync(`${DB_FILE}-journal`, { force: true });
  vi.unstubAllGlobals();
});

describe("analysis job", () => {
  it("crawls the site, persists analysis, findings, opportunities and score, and updates the company", async () => {
    const fetchMock = siteFetch();
    vi.stubGlobal("fetch", fetchMock);
    const company = await createCompany({ name: "Clínica Dental Ejemplo", website: "https://dental-ejemplo.test/" });
    await runFor(company.id);

    const c = await mod.db.company.findUniqueOrThrow({
      where: { id: company.id },
      include: { analyses: true, findings: true, opportunities: true, scores: true, sources: true, socialProfiles: true },
    });
    expect(c.analysisStatus).toBe("completed");
    expect(c.crmStatus).toBe("analyzed");
    expect(c.analyzedAt).not.toBeNull();
    expect(c.score).toBe(c.scores[0]!.total);
    expect(c.opportunityCount).toBe(c.opportunities.length);
    expect(c.opportunities.length).toBeGreaterThan(3);

    // e-mail found on the website fills the gap, with provenance
    expect(c.email).toBe("info@dental-ejemplo.test");
    expect((c.fieldSources as Record<string, string>).email).toBe("website");
    expect((c.fieldSources as Record<string, string>).phone).toBe("osm");
    expect(c.socialProfiles).toEqual([expect.objectContaining({ platform: "instagram", source: "website" })]);
    expect(c.sources).toEqual([expect.objectContaining({ provider: "website", url: "https://dental-ejemplo.test/" })]);

    const a = c.analyses[0]!;
    expect(a).toMatchObject({ status: "completed", generator: "rules", httpStatus: 200, finalUrl: "https://dental-ejemplo.test/", error: null });
    expect(a.finishedAt).not.toBeNull();
    expect(a.summary).toContain("Clínica Dental Ejemplo");
    expect(c.findings.every((f) => f.analysisId === a.id)).toBe(true);
    expect(c.opportunities.every((o) => o.analysisId === a.id && o.status === "open")).toBe(true);

    const signals = a.signals as { website: { redirectsToHttps: boolean }; technical: { brokenPages: unknown[] } };
    expect(signals.website.redirectsToHttps).toBe(true);
    expect(signals.technical.brokenPages).toEqual([{ url: "https://dental-ejemplo.test/tratamientos/", status: 404 }]);
    expect(c.findings.map((f) => f.key)).toContain("broken_pages");

    const activity = await mod.db.activity.findFirstOrThrow({ where: { companyId: company.id } });
    expect(activity.type).toBe("analysis_completed");
    expect(activity.message).toContain(`${c.score}/100`);

    const requested = fetchMock.mock.calls.map(([u]) => String(u));
    expect(requested).not.toContain("https://dental-ejemplo.test/equipo/"); // only commercially relevant pages
  }, 30_000);

  it("re-analysis keeps history, preserves dismissed opportunities and doesn't touch an advanced CRM status", async () => {
    vi.stubGlobal("fetch", siteFetch());
    const company = await mod.db.company.findFirstOrThrow({ where: { name: "Clínica Dental Ejemplo" } });
    const dismissed = await mod.db.opportunity.findFirstOrThrow({ where: { companyId: company.id, type: "missing_whatsapp" } });
    await mod.db.opportunity.update({ where: { id: dismissed.id }, data: { status: "dismissed" } });
    await mod.db.company.update({ where: { id: company.id }, data: { crmStatus: "contacted" } });

    await runFor(company.id);

    const analyses = await mod.db.analysis.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" } });
    expect(analyses).toHaveLength(2);
    const latest = await mod.db.opportunity.findMany({ where: { analysisId: analyses[0]!.id } });
    expect(latest.find((o) => o.type === "missing_whatsapp")!.status).toBe("dismissed");
    const c = await mod.db.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(c.crmStatus).toBe("contacted");
    expect(c.opportunityCount).toBe(latest.filter((o) => o.status === "open").length);
  }, 30_000);

  it("analyses a company without a website from its source data", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const company = await createCompany({ name: "Dentista Sin Web Ejemplo", website: null });
    await runFor(company.id);
    expect(fetchMock).not.toHaveBeenCalled();
    const findings = await mod.db.finding.findMany({ where: { companyId: company.id } });
    expect(findings.map((f) => f.key)).toContain("no_website");
    const c = await mod.db.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(c.analysisStatus).toBe("completed");
  });

  it("fails honestly when the server itself has no internet, without blaming the company", async () => {
    vi.stubGlobal("fetch", offline());
    const company = await createCompany({ name: "Clínica Offline Ejemplo", website: "https://offline-ejemplo.test/" });
    const job = await mod.enqueueAnalysis(company.id);
    await expect(mod.runAnalysisJob(job!)).rejects.toThrow(/no tiene acceso a internet/);

    const c = await mod.db.company.findUniqueOrThrow({ where: { id: company.id }, include: { analyses: true, findings: true } });
    expect(c.analysisStatus).toBe("failed");
    expect(c.score).toBeNull();
    expect(c.findings).toEqual([]);
    expect(c.analyses[0]).toMatchObject({ status: "failed" });
    expect(c.analyses[0]!.error).toMatch(/acceso a internet/);
    const activity = await mod.db.activity.findFirstOrThrow({ where: { companyId: company.id } });
    expect(activity.type).toBe("analysis_failed");
  }, 30_000);

  it("does not report a proxy refusal as the company's site blocking visits", async () => {
    // HTTPS: the proxy refuses the CONNECT tunnel. HTTP: the proxy answers 403 itself.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        if (String(input).startsWith("https:")) {
          const tunnel = new Error("Proxy response (403) !== 200 when HTTP Tunneling");
          throw new TypeError("fetch failed", { cause: new Error("Request was cancelled.", { cause: tunnel }) });
        }
        return new Response("request blocked", { status: 403, headers: { "x-proxy-error": "request blocked" } });
      }),
    );
    const company = await createCompany({ name: "Clínica Proxy Ejemplo", website: "https://proxy-ejemplo.test/" });
    const job = await mod.enqueueAnalysis(company.id);
    await expect(mod.runAnalysisJob(job!)).rejects.toThrow(/no permite conectar con proxy-ejemplo\.test/);

    const c = await mod.db.company.findUniqueOrThrow({ where: { id: company.id }, include: { analyses: true, findings: true } });
    expect(c.analysisStatus).toBe("failed");
    expect(c.findings).toEqual([]);
    expect(c.analyses[0]!.error).toMatch(/No es un fallo de la empresa/);
  }, 30_000);
});
