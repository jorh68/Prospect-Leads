import { describe, expect, it } from "vitest";
import { classifyPage, decodeCfEmail, extractPage } from "@/lib/analysis/extract";
import { charsetOf, decodeHtml, pickSubpages } from "@/lib/analysis/crawl";
import { detectVendors } from "@/lib/analysis/vendors";
import { fixture } from "./helpers";

describe("extractPage", () => {
  const home = extractPage(fixture("dental-home.html"), "https://dental-ejemplo.test/");
  const contact = extractPage(fixture("dental-contacto.html"), "https://dental-ejemplo.test/contacto/");
  const fisio = extractPage(fixture("fisio-home.html"), "https://fisio-ejemplo.test/");

  it("reads title, headline, viewport and language", () => {
    expect(home.title).toBe("Clínica Dental Ejemplo | Dentistas en Madrid");
    expect(home.h1).toEqual(["Bienvenidos a Clínica Dental Ejemplo"]);
    expect(home.viewport).toContain("device-width");
    expect(home.lang).toBe("es-ES");
    expect(home.metaDescription).toBeNull();
  });

  it("finds phones in text, decodes Cloudflare-protected e-mails and skips share links", () => {
    expect(home.phones).toEqual(["912345678"]);
    expect(home.telLinks).toEqual([]);
    expect(home.emails).toEqual(["info@dental-ejemplo.test"]);
    expect(home.socials).toEqual([{ platform: "instagram", url: "https://www.instagram.com/dentalejemplo/" }]);
  });

  it("quotes the sentence that sends appointments to the phone, without crossing blocks", () => {
    expect(home.hints.phoneOnlyHints).toEqual(["Para pedir cita llámenos al 912 345 678 de lunes a viernes"]);
    expect(fisio.hints.phoneOnlyHints).toEqual([]);
  });

  it("reads footer facts: copyright year and legal links", () => {
    expect(home.hints.copyrightYear).toBe(2019);
    expect(home.hints.legal).toEqual({ privacy: true, legalNotice: true, cookies: true });
  });

  it("describes forms field by field", () => {
    expect(contact.forms).toHaveLength(1);
    const form = contact.forms[0]!;
    expect(form.purpose).toBe("contact"); // "Fecha de nacimiento" is not an appointment date
    expect(form.fieldCount).toBe(9);
    expect(form.requiredCount).toBe(4);
    expect(form.fields.slice(0, 3)).toEqual(["Nombre", "Apellidos", "Email"]);
    expect(form).toMatchObject({ hasEmail: true, hasPhone: true, hasMessage: true, hasConsent: true, hasCaptcha: true, submitText: "Enviar" });
  });

  it("classifies calls to action and marks button-styled ones as prominent", () => {
    const kinds = fisio.ctas.map((c) => [c.text, c.kind, c.prominent]);
    expect(kinds).toContainEqual(["Pide tu cita online", "booking", true]);
    expect(kinds).toContainEqual(["Llámanos: 961 23 45 67", "call", false]);
    expect(kinds).toContainEqual(["Escríbenos por WhatsApp", "whatsapp", false]);
    expect(home.ctas.map((c) => [c.text, c.kind, c.prominent])).toEqual([["Contacto", "contact", false]]);
  });

  it("deduplicates the same phone written as link and as text", () => {
    expect(fisio.phones).toEqual(["+34961234567"]);
    expect(fisio.whatsappLinks).toEqual(["https://wa.me/34612345678"]);
  });

  it("handles legacy pages: no viewport, http resources, windows-1252 text", () => {
    const bytes = new Uint8Array(Buffer.from(fixture("restaurante-home.html", "latin1"), "latin1"));
    const html = decodeHtml(bytes, charsetOf(null, bytes));
    const p = extractPage(html, "https://restaurante-ejemplo.test/");
    expect(p.viewport).toBeNull();
    expect(p.mixedContent).toEqual(["http://restaurante-ejemplo.test/cabecera.gif"]);
    expect(p.text).toContain("Menú del día 14 €");
    expect(p.hints.phoneOnlyHints).toEqual(["Reservas por teléfono: 954 11 22 33"]);
    expect(p.hints.copyrightYear).toBe(2014);
    expect(p.hints.hasPrices).toBe(true);
  });
});

describe("vendor fingerprints", () => {
  it("detects tools from script hosts and keeps the snippet as evidence", () => {
    const names = detectVendors(fixture("fisio-home.html")).map((m) => m.vendor.name);
    expect(names).toEqual(
      expect.arrayContaining(["Google Analytics 4", "HubSpot", "Joinchat", "Trustindex (Google reviews)", "Cookiebot", "WordPress"]),
    );
    const booking = detectVendors(fixture("fisio-reservar.html")).find((m) => m.vendor.group === "booking");
    expect(booking?.vendor.name).toBe("Doctoralia");
    expect(booking?.evidence).toContain("doctoralia");
  });

  it("does not report tools that are not there", () => {
    const names = detectVendors(fixture("dental-home.html")).map((m) => m.vendor.group);
    expect(names).not.toContain("chat");
    expect(names).not.toContain("booking");
    expect(names).not.toContain("whatsapp");
  });
});

describe("crawl helpers", () => {
  it("classifies pages by path and link text", () => {
    expect(classifyPage("https://x.test/")).toBe("home");
    expect(classifyPage("https://x.test/pide-cita")).toBe("booking");
    expect(classifyPage("https://x.test/contacto/")).toBe("contact");
    expect(classifyPage("https://x.test/tratamientos/")).toBe("services");
    expect(classifyPage("https://x.test/blog/")).toBe("other");
  });

  it("picks booking and contact pages before services, skipping the home page", () => {
    const fisio = extractPage(fixture("fisio-home.html"), "https://fisio-ejemplo.test/");
    expect(pickSubpages(fisio, "https://fisio-ejemplo.test/", 4)).toEqual([
      { url: "https://fisio-ejemplo.test/reservar-cita", kind: "booking" },
      { url: "https://fisio-ejemplo.test/servicios", kind: "services" },
    ]);
  });

  it("decodes Cloudflare e-mail obfuscation and rejects junk", () => {
    expect(decodeCfEmail("9df4f3fbf2ddf9f8f3e9fcf1b0f8f7f8f0edf1f2b3e9f8eee9")).toBe("info@dental-ejemplo.test");
    expect(decodeCfEmail("zz")).toBeNull();
  });
});
