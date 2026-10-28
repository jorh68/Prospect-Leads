import { describe, expect, it } from "vitest";
import { buildSignals } from "@/lib/analysis/collect";
import { interpret } from "@/lib/analysis/interpret";
import { FINDINGS, OPPORTUNITY_TYPES } from "@/lib/analysis/catalog";
import { SCORE_WEIGHTS } from "@/lib/analysis/score";
import { analysisSignalsSchema } from "@/lib/analysis/signals";
import { findingInputSchema, opportunityInputSchema, scoreBreakdownSchema } from "@/lib/domain/types";
import { SERVICE_KEYS } from "@/lib/domain/constants";
import { nameTokens } from "@/lib/analysis/identity";
import { context, crawlOf, dentalCrawl, fisioCrawl, page } from "./helpers";

const NOW = new Date("2026-10-28T12:00:00Z");

function run(ctx = context(), crawl: ReturnType<typeof dentalCrawl> | null = dentalCrawl()) {
  const signals = buildSignals(ctx, { crawl, pageSpeed: null, pageSpeedError: null });
  return { signals, ...interpret(ctx, signals, NOW) };
}

const fisioCtx = context({
  name: "Fisioterapia Ejemplo",
  niche: "Fisioterapeutas",
  website: "https://fisio-ejemplo.test/",
  city: "Valencia",
  rating: 4.8,
  reviewCount: 212,
  ratingSource: "google_places",
});

describe("interpretation of a clinic that books by phone", () => {
  const r = run();
  const keys = r.findings.map((f) => f.key);
  const types = r.opportunities.map((o) => o.type);

  it("produces signals that match the stored schema", () => {
    expect(analysisSignalsSchema.safeParse(r.signals).success).toBe(true);
  });

  it("detects the real gaps with literal evidence", () => {
    expect(keys).toEqual(
      expect.arrayContaining(["phone_only_booking", "no_online_booking", "no_whatsapp", "no_clear_cta", "long_form", "unclear_value_proposition", "outdated_site"]),
    );
    const phoneOnly = r.findings.find((f) => f.key === "phone_only_booking")!;
    expect(phoneOnly.evidence).toContain("Para pedir cita llámenos al 912 345 678");
    expect(phoneOnly.interpretation).toBeTruthy();
  });

  it("does not claim what it cannot see", () => {
    expect(keys).not.toContain("no_https");
    expect(keys).not.toContain("not_mobile_friendly");
    expect(keys).not.toContain("low_rating"); // no review data at all
    expect(keys).toContain("no_review_data");
    expect(types).not.toContain("review_generation");
  });

  it("turns findings into opportunities for the right services", () => {
    expect(types).toEqual(expect.arrayContaining(["manual_phone_booking", "missing_online_booking", "paid_traffic_leak", "missing_whatsapp"]));
    const booking = r.opportunities.find((o) => o.type === "missing_online_booking")!;
    expect(booking.serviceKey).toBe("online_booking");
    expect(booking.impact).toBe("high");
    // A tag manager could inject a widget we can't see: confidence is lowered.
    expect(booking.confidence).toBeLessThan(0.7);
  });

  it("orders opportunities by impact × confidence", () => {
    const w = r.opportunities.map((o) => ({ high: 1, medium: 0.6, low: 0.3 })[o.impact] * o.confidence);
    expect([...w].sort((a, b) => b - a)).toEqual(w);
  });

  it("writes a summary based on the facts", () => {
    expect(r.summary).toContain("Clínica Dental Ejemplo");
    expect(r.summary).toContain("WordPress");
    expect(r.summary).toMatch(/No se detecta reserva online, WhatsApp, chat ni una llamada a la acción clara/);
    expect(r.summary).toContain(`${r.score.total}/100`);
  });
});

describe("interpretation of a well-equipped clinic", () => {
  const r = run(fisioCtx, fisioCrawl());
  const keys = r.findings.map((f) => f.key);

  it("recognises the tools it already uses", () => {
    expect(keys).toEqual(
      expect.arrayContaining(["has_online_booking", "has_whatsapp", "has_crm_marketing", "has_clear_cta", "good_rating", "many_reviews", "has_review_widget"]),
    );
    expect(keys).not.toContain("no_online_booking");
    expect(keys).not.toContain("no_contact_form"); // books through Doctoralia, HubSpot can render forms
  });

  it("finds few opportunities and scores lower than the clinic with gaps", () => {
    expect(r.opportunities.length).toBeLessThanOrEqual(1);
    expect(r.score.total).toBeLessThan(run().score.total);
  });
});

describe("score", () => {
  it("is explainable: six factors whose weights sum to 1 and whose points add up to the total", () => {
    for (const r of [run(), run(fisioCtx, fisioCrawl()), run(context({ website: null }), null)]) {
      expect(scoreBreakdownSchema.safeParse(r.score.breakdown).success).toBe(true);
      const weights = r.score.breakdown.reduce((n, f) => n + f.weight, 0);
      expect(weights).toBeCloseTo(1, 5);
      expect(r.score.breakdown.map((f) => f.factor)).toEqual(Object.keys(SCORE_WEIGHTS));
      const points = r.score.breakdown.reduce((n, f) => n + f.points, 0);
      expect(Math.abs(points - r.score.total)).toBeLessThanOrEqual(1);
      expect(r.score.total).toBeGreaterThanOrEqual(0);
      expect(r.score.total).toBeLessThanOrEqual(100);
      for (const f of r.score.breakdown) expect(f.explanation.length).toBeGreaterThan(10);
    }
  });

  it("drops to zero for a permanently closed business, with the reason in the breakdown", () => {
    const r = run(context({ businessStatus: "closed_permanently" }));
    expect(r.score.total).toBe(0);
    expect(r.opportunities).toEqual([]);
    expect(r.score.breakdown.at(-1)).toMatchObject({ factor: "business_status", weight: 0 });
  });
});

describe("companies without a usable website", () => {
  it("analyses a company with no website from source data", () => {
    const r = run(context({ website: null, rating: 4.1, reviewCount: 9, ratingSource: "google_places" }), null);
    expect(r.findings.map((f) => f.key)).toEqual(expect.arrayContaining(["no_website", "few_reviews"]));
    expect(r.opportunities.map((o) => o.type)).toEqual(expect.arrayContaining(["no_website", "review_generation"]));
    expect(r.signals.limitations[0]).toMatch(/no tiene web propia/);
  });

  it("only asks for a Google Places key when none is configured", () => {
    const missing = (configured: boolean) =>
      run(context({ website: null, rating: null, reviewCount: null, ratingProviderConfigured: configured }), null).signals.limitations.join(" ");
    expect(missing(false)).toMatch(/requiere GOOGLE_PLACES_API_KEY/);
    expect(missing(true)).not.toMatch(/requiere GOOGLE_PLACES_API_KEY/);
    expect(missing(true)).toMatch(/Google Places no tiene reseñas de esta empresa/);
  });

  it("treats a Facebook page as 'no own website'", () => {
    const r = run(context({ website: "https://www.facebook.com/dentalejemplo" }), null);
    expect(r.findings.map((f) => f.key)).toContain("website_social_only");
  });

  it("reports an unreachable site without inventing content findings", () => {
    const crawl = crawlOf([page("https://dental-ejemplo.test/", null, "home")], null);
    const r = run(context(), crawl);
    const keys = r.findings.map((f) => f.key);
    expect(keys).toContain("website_unreachable");
    expect(keys).not.toContain("no_whatsapp");
    expect(keys).not.toContain("no_contact_form");
    const down = r.opportunities.find((o) => o.type === "website_down")!;
    expect(down.impactNote).toMatch(/temporal/);
  });

  it("treats a server error (5xx) as possibly temporary, but a 404 as a real problem", () => {
    const at = (status: number) =>
      run(context(), crawlOf([page("https://dental-ejemplo.test/", null, "home", { status, error: `HTTP ${status}`, networkError: false })], null));
    const e500 = at(500).opportunities.find((o) => o.type === "website_down")!;
    expect(e500.impactNote).toMatch(/temporal/);
    expect(e500.confidence).toBeLessThan(0.7);
    const e404 = at(404).opportunities.find((o) => o.type === "website_down")!;
    expect(e404.impactNote).toBeNull();
    expect(e404.confidence).toBeGreaterThan(0.8);
  });

  it("does not blame the company when its site blocks bots", () => {
    const blocked = { ...page("https://dental-ejemplo.test/", null, "home", { status: 403, error: "HTTP 403", networkError: false }) };
    const r = run(context(), { ...crawlOf([blocked], null), blocked: true });
    const keys = r.findings.map((f) => f.key);
    expect(keys).toContain("website_blocked");
    expect(r.findings.find((f) => f.key === "website_blocked")!.kind).toBe("neutral");
    expect(r.opportunities.map((o) => o.type)).not.toContain("website_down");
  });
});

describe("problems that only showed up with real listings", () => {
  // Fictional party-planning site, as found behind a stale clinic listing.
  const partyHtml = `<html lang="es"><head><title>Fiestas Ejemplo | Cumpleaños infantiles</title></head><body>
    <h1>El cumpleaños de tu peque sin caos</h1>
    <p>${"Organizamos fiestas infantiles con animadores, castillos hinchables, decoración temática, tartas y meriendas para que tú solo disfrutes del día. ".repeat(5)}</p>
    <a href="https://wa.me/34600000000">Reservar fecha</a> <a href="mailto:fiestasejemplo@gmail.com">Escríbenos</a>
    <a href="https://instagram.com/fiestasejemplo">Instagram</a></body></html>`;
  const otherBusinessSite = () => crawlOf([page("https://otro-negocio.test/", partyHtml, "home")]);

  it("does not analyse a website that belongs to another business", () => {
    const ctx = context({ name: "Clínica Dental Dra. Marta Ejemplar", website: "https://otro-negocio.test/", email: "info@dentalmarta.test" });
    const r = run(ctx, otherBusinessSite());
    const keys = r.findings.map((f) => f.key);
    expect(r.signals.website.mismatch).toMatch(/no menciona/);
    expect(r.signals.website.reachable).toBe(false);
    expect(keys).toContain("website_mismatch");
    // Nothing from the other business's site is attributed to the clinic.
    expect(keys).not.toEqual(expect.arrayContaining(["no_online_booking", "has_whatsapp", "free_email_domain"]));
    expect(r.signals.socials).toEqual([]);
    expect(r.signals.contact.emails).toEqual([]);
    expect(r.opportunities.map((o) => o.type)).not.toContain("website_down");
    expect(r.summary).toMatch(/parece de otro negocio/);
    expect(analysisSignalsSchema.safeParse(r.signals).success).toBe(true);
  });

  it("keeps a site that shows the company's name, phone or sector", () => {
    expect(run().signals.website.mismatch).toBeNull();
    expect(nameTokens("Clínica Dental Reyes 9", "Madrid")).toEqual(["reyes"]);
    const sameName = context({ name: "Fiestas Ejemplo", niche: "Clínicas dentales", website: "https://otro-negocio.test/" });
    expect(run(sameName, otherBusinessSite()).signals.website.mismatch).toBeNull();
  });

  it("reports a dead listing link but analyses the working home page", () => {
    const crawl = { ...dentalCrawl(), listedUrlError: { url: "https://dental-ejemplo.test/sede-centro.jsp", status: 404 } };
    const r = run(context(), crawl);
    const keys = r.findings.map((f) => f.key);
    expect(keys).toContain("listed_url_broken");
    expect(keys).not.toContain("website_http_error");
    expect(r.opportunities.map((o) => o.type)).not.toContain("website_down");
    expect(r.signals.website.reachable).toBe(true);
  });

  it("reports a parked domain without auditing the parking page as if it were the clinic's site", () => {
    const html = `<!doctype html><html><head><script>window.LANDER_SYSTEM="PW"</script></head><body><div id="root"></div></body></html>`;
    const r = run(context(), crawlOf([page("https://dental-ejemplo.test/lander", html, "home")]));
    const keys = r.findings.map((f) => f.key);
    expect(keys).toContain("website_parked");
    expect(keys).not.toEqual(expect.arrayContaining(["no_clear_cta"]));
    expect(keys).not.toContain("not_mobile_friendly");
    expect(keys).not.toContain("no_online_booking");
    expect(r.opportunities.map((o) => o.type)).toContain("website_down");
    expect(r.summary).toMatch(/aparcado/);
  });

  it("names an invalid HTTPS certificate instead of saying the site is down", () => {
    const home = page("https://dental-ejemplo.test/", null, "home", { error: "certificado HTTPS no válido" });
    const r = run(context(), crawlOf([home], null));
    const keys = r.findings.map((f) => f.key);
    expect(keys).toContain("website_invalid_certificate");
    expect(keys).not.toContain("website_unreachable");
    const down = r.opportunities.find((o) => o.type === "website_down")!;
    expect(down.problem).toMatch(/aviso de seguridad/);
    expect(down.impactNote).toBeNull();
  });
});

describe("contracts with other modules", () => {
  const all = [run(), run(fisioCtx, fisioCrawl()), run(context({ website: null, reviewCount: 3, rating: 3.2 }), null)];

  it("every finding and opportunity matches the shared zod schemas and the catalog", () => {
    for (const r of all) {
      for (const f of r.findings) {
        expect(findingInputSchema.safeParse(f).success).toBe(true);
        expect(f.label).toBe(FINDINGS[f.key as keyof typeof FINDINGS].label);
        expect(f.evidence.length).toBeGreaterThan(5);
      }
      for (const o of r.opportunities) {
        expect(opportunityInputSchema.safeParse(o).success).toBe(true);
        expect(SERVICE_KEYS).toContain(o.serviceKey);
        expect(OPPORTUNITY_TYPES[o.type as keyof typeof OPPORTUNITY_TYPES].serviceKey).toBeDefined();
        expect(o.evidence.length).toBeGreaterThan(5);
      }
    }
  });
});
