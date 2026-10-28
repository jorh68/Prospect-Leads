import { describe, expect, it } from "vitest";
import { afterColon, composeMessages, NotEnoughEvidenceError, SENDER_PLACEHOLDER, shortName } from "@/lib/messages/compose";
import { buildFacts } from "@/lib/messages/facts";
import { outreachInput } from "./fixtures";

const sender = { name: "Laura", company: "Consultora Ejemplo" };

describe("composeMessages", () => {
  it("builds three channel versions around the strongest opportunity and real reputation", () => {
    const m = composeMessages(outreachInput(), sender);

    expect(m.email.subject).toBe("WhatsApp en Clínica Dental Ejemplo");
    expect(m.email.body).toContain("Hola, equipo de Clínica Dental Ejemplo:");
    expect(m.email.body).toContain("un 4,7 con 312 reseñas en Google");
    expect(m.email.body).toContain("me fijé en un detalle: la web no ofrece WhatsApp como canal de contacto.");
    expect(m.email.body).toContain("¿Os escriben muchos clientes por WhatsApp");
    expect(m.email.body).toMatch(/Un saludo,\nLaura\nConsultora Ejemplo$/);

    for (const body of [m.linkedin.body, m.whatsapp.body]) {
      expect(body).toContain("WhatsApp como canal de contacto");
      expect(body.trim().endsWith("?")).toBe(true);
    }
    expect(m.whatsapp.body.startsWith("Hola, soy Laura de Consultora Ejemplo.")).toBe(true);
    // Short channels stay short
    expect(m.whatsapp.body.split(/\s+/).length).toBeLessThan(60);
    expect(m.linkedin.body.split(/\s+/).length).toBeLessThan(90);
  });

  it("records the facts it cites as the basis", () => {
    const m = composeMessages(outreachInput(), sender);
    expect(m.basis.opportunityIds).toEqual(["o-high"]);
    expect(m.basis.facts.map((f) => f.source)).toEqual(["Google Places", "Análisis de la web"]);
  });

  it("does not compliment a weak or unsourced rating, and says 'en Google' only when it came from Google", () => {
    const base = outreachInput();
    const weak = composeMessages({ ...base, company: { ...base.company, rating: 3.1 } }, sender);
    expect(weak.email.body).not.toContain("reseñas");
    expect(weak.email.body).toContain("Estuve revisando vuestra web (dental-ejemplo.test) y me fijé en un detalle:");

    const osm = composeMessages({ ...base, company: { ...base.company, fieldSources: {} } }, sender);
    expect(osm.email.body).toContain("312 reseñas,");
    expect(osm.email.body).not.toContain("en Google");
  });

  it("handles companies without a website", () => {
    const base = outreachInput();
    const m = composeMessages({ ...base, company: { ...base.company, website: null, rating: null, reviewCount: null }, analyzedUrl: null }, sender);
    expect(m.email.body).toContain("Estuve buscando Clínica Dental Ejemplo en internet y me fijé en un detalle:");
    expect(m.whatsapp.body).toContain("la información pública de Clínica Dental Ejemplo");
  });

  it("uses a visible placeholder when the sender is not configured", () => {
    const m = composeMessages(outreachInput(), { name: null, company: null });
    expect(m.email.body.endsWith(SENDER_PLACEHOLDER)).toBe(true);
    expect(m.whatsapp.body.startsWith(`Hola, soy ${SENDER_PLACEHOLDER}.`)).toBe(true);
  });

  it("refuses to write a generic message without an opportunity", () => {
    expect(() => composeMessages(outreachInput({ opportunities: [] }), sender)).toThrow(NotEnoughEvidenceError);
  });
});

describe("buildFacts", () => {
  it("lists only data present in the input, opportunities by priority", () => {
    const facts = buildFacts(outreachInput());
    expect(facts.map((f) => f.id)).toEqual(["rating", "website", "opportunity:o-high", "opportunity:o-low", "finding:f1", "finding:f2"]);
    const noRating = buildFacts(outreachInput({ company: { ...outreachInput().company, rating: null } }));
    expect(noRating.some((f) => f.id === "rating")).toBe(false);
  });
});

describe("afterColon", () => {
  it("lowercases ordinary sentences but keeps names and acronyms", () => {
    expect(afterColon("La web no tiene WhatsApp.")).toBe("la web no tiene WhatsApp.");
    expect(afterColon("WhatsApp no aparece en la web.")).toBe("WhatsApp no aparece en la web.");
    expect(afterColon("CRM sin integrar.")).toBe("CRM sin integrar.");
    expect(afterColon("Google muestra 3 reseñas sin respuesta.")).toBe("Google muestra 3 reseñas sin respuesta.");
  });
});

describe("shortName", () => {
  it("drops legal suffixes", () => {
    expect(shortName("Clínica Dental Ejemplo S.L.")).toBe("Clínica Dental Ejemplo");
    expect(shortName("Ejemplo, S.A.")).toBe("Ejemplo");
    expect(shortName("Ejemplo Salud")).toBe("Ejemplo Salud");
  });
});
