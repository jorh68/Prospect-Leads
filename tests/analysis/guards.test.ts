import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "file:./unused.db";

const { assertPublicUrl, isPrivateAddress } = await import("@/lib/analysis/net-guard");
const { applyLlmOutput, verifyQuote } = await import("@/lib/analysis/llm");
const { parsePageSpeed } = await import("@/lib/analysis/pagespeed");
const { buildSignals } = await import("@/lib/analysis/collect");
const { interpret } = await import("@/lib/analysis/interpret");
const { context, dentalCrawl } = await import("./helpers");

describe("SSRF guard", () => {
  it("recognises private and loopback addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.1.10", "172.20.0.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "151.101.1.69", "2a00:1450:4003:80e::200e"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("refuses local hosts, private IPs, odd ports and non-http schemes", async () => {
    for (const url of [
      "http://localhost:3000/",
      "http://127.0.0.1/",
      "http://169.254.169.254/latest/meta-data/",
      "https://10.0.0.5/",
      "https://example.com:22/",
      "file:///etc/passwd",
      "https://user:pass@example.com/",
      "http://router.local/",
    ]) {
      await expect(assertPublicUrl(url), url).rejects.toThrow(/URL no permitida/);
    }
    await expect(assertPublicUrl("https://93.184.216.34/")).resolves.toBeUndefined();
  });
});

describe("optional AI layer", () => {
  const ctx = context();
  const crawl = dentalCrawl();
  const base = interpret(ctx, buildSignals(ctx, { crawl, pageSpeed: null, pageSpeedError: null }));
  const corpus = crawl.extracts.map((e) => e.text).join("\n");

  it("verifies quotes literally (accent and case-insensitive) against the crawled text", () => {
    expect(verifyQuote("para pedir cita LLAMENOS al 912 345 678", corpus)).toBe(true);
    expect(verifyQuote("ofrecemos financiación sin intereses", corpus)).toBe(false);
    expect(verifyQuote("cita", corpus)).toBe(false); // too short to count as evidence
  });

  it("keeps rules evidence, applies rewrites and drops unverifiable extras", () => {
    const type = base.opportunities[0]!.type;
    const out = applyLlmOutput(
      base,
      {
        summary: "Resumen IA.",
        rewrites: [{ type, problem: "Problema reescrito", consequence: "Consecuencia", solution: "Solución" }],
        extra: [
          { title: "Odontopediatría", problem: "p", evidenceQuote: "Implantes Ortodoncia invisible Blanqueamiento Odontopediatría", consequence: "c", solution: "s", serviceKey: "process_automation", impact: "low" },
          { title: "Inventada", problem: "p", evidenceQuote: "abrimos los domingos por la tarde", consequence: "c", solution: "s", serviceKey: "chatbot", impact: "high" },
        ],
      },
      corpus,
    );
    expect(out.summary).toBe("Resumen IA.");
    const rewritten = out.opportunities.find((o) => o.type === type)!;
    expect(rewritten.problem).toBe("Problema reescrito");
    expect(rewritten.evidence).toBe(base.opportunities[0]!.evidence);
    expect(out.dropped).toBe(1);
    const extra = out.opportunities.filter((o) => o.type.startsWith("ai_"));
    expect(extra).toHaveLength(1);
    expect(extra[0]!.confidence).toBe(0.5);
    expect(extra[0]!.evidence).toContain("Odontopediatría");

    const unknownService = applyLlmOutput(
      base,
      {
        summary: "",
        rewrites: [],
        extra: [{ title: "Servicio raro", problem: "p", evidenceQuote: "Para pedir cita llámenos al 912 345 678", consequence: "c", solution: "s", serviceKey: "teleportation", impact: "high" }],
      },
      corpus,
    );
    expect(unknownService.dropped).toBe(1);
    expect(unknownService.summary).toBe(base.summary);
  });
});

describe("PageSpeed Insights parsing", () => {
  it("converts Lighthouse scores to 0–100 and keeps core metrics", () => {
    const r = parsePageSpeed(
      {
        lighthouseResult: {
          categories: { performance: { score: 0.34 }, accessibility: { score: 0.81 }, seo: { score: 0.9 }, "best-practices": { score: null } },
          audits: { "largest-contentful-paint": { numericValue: 6234.5 }, "cumulative-layout-shift": { numericValue: 0.12 }, "total-blocking-time": { numericValue: 810 } },
        },
      },
      new Date("2026-10-28T00:00:00Z"),
    );
    expect(r).toMatchObject({ performance: 34, accessibility: 81, seo: 90, bestPractices: null, lcpMs: 6234.5, cls: 0.12, tbtMs: 810 });
  });
});

