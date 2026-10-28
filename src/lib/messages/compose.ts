import type { MessageBasis } from "../domain/types";
import { displayUrl, formatNumber, formatRating } from "../format";
import { sortOpportunities } from "../reports/priority";
import { buildFacts, GOOD_REPUTATION, type Fact, type OutreachInput } from "./facts";

/**
 * Rules-based outreach composer. It never writes a claim that is not in the
 * input: the observation is the opportunity's own problem statement, the
 * compliment is the real rating, and the question is chosen by the service
 * the opportunity points to. Used when no LLM is configured and as the
 * fallback when the LLM fails.
 */

export interface ComposedMessages {
  email: { subject: string; body: string };
  linkedin: { body: string };
  whatsapp: { body: string };
  basis: MessageBasis;
}

export interface Sender {
  name: string | null;
  company: string | null;
}

/** Shown where the sender's name goes when OUTREACH_SENDER_NAME is not set. */
export const SENDER_PLACEHOLDER = "[Tu nombre]";

/** One open question per service: starts a conversation instead of pitching. */
const QUESTIONS: Record<string, string> = {
  ai_receptionist: "¿Cómo gestionáis ahora las llamadas que entran cuando estáis ocupados o fuera de horario?",
  whatsapp_automation: "¿Os escriben muchos clientes por WhatsApp o casi todo entra por teléfono?",
  online_booking: "¿Las citas se siguen cerrando sobre todo por teléfono?",
  lead_capture: "¿Tenéis idea de cuántas consultas os llegan al mes desde la web?",
  lead_followup: "¿Qué pasa ahora con las personas que piden información pero no llegan a reservar?",
  lead_reactivation: "¿Hacéis algo con los clientes que hace tiempo que no vuelven?",
  crm_setup: "¿Dónde lleváis ahora los contactos y el seguimiento de cada cliente?",
  review_management: "¿Pedís reseñas a los clientes o responderlas se hace a mano cuando hay tiempo?",
  chatbot: "¿Quién atiende las dudas que llegan por la web fuera de horario?",
  website_improvement: "¿La web os trae clientes ahora mismo o funciona más como tarjeta de visita?",
  process_automation: "¿Qué tareas repetitivas os quitan más tiempo en el día a día?",
};
const DEFAULT_QUESTION = "¿Es algo que ya tengáis en el radar?";

const SUBJECTS: Record<string, (name: string) => string> = {
  ai_receptionist: (n) => `Llamadas fuera de horario en ${n}`,
  whatsapp_automation: (n) => `WhatsApp en ${n}`,
  online_booking: (n) => `Reservas online en ${n}`,
  lead_capture: (n) => `Consultas desde la web de ${n}`,
  lead_followup: (n) => `Seguimiento de consultas en ${n}`,
  lead_reactivation: (n) => `Clientes antiguos de ${n}`,
  crm_setup: (n) => `Seguimiento de clientes en ${n}`,
  review_management: (n) => `Las reseñas de ${n}`,
  chatbot: (n) => `Consultas en la web de ${n}`,
  website_improvement: (n) => `Una idea sobre la web de ${n}`,
  process_automation: (n) => `Tareas manuales en ${n}`,
};

const SOFT_CLOSE = "Si os interesa, os cuento en una llamada corta cómo lo plantearía en vuestro caso.";

export class NotEnoughEvidenceError extends Error {
  constructor() {
    super(
      "No hay oportunidades con evidencia suficiente para escribir un mensaje personalizado. Analiza la empresa (o revisa el análisis) antes de generar mensajes.",
    );
    this.name = "NotEnoughEvidenceError";
  }
}

/** "Clínica Dental Ejemplo S.L." → "Clínica Dental Ejemplo" */
export function shortName(name: string): string {
  return name.replace(/[,\s]+(s\.?\s?l\.?\s?u?\.?|s\.?\s?a\.?\s?u?\.?|s\.?\s?c\.?|s\.?\s?l\.?\s?p\.?)$/i, "").trim() || name;
}

export function sentence(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

/**
 * Lowercases the first letter so a sentence reads well after a colon, unless
 * the first word is a name or acronym ("WhatsApp", "CRM", "Google").
 */
export function afterColon(text: string): string {
  const first = text.split(/\s/)[0] ?? "";
  if (/^\p{Lu}.*\p{Lu}/u.test(first) || /^(Google|Instagram|Facebook|LinkedIn|TikTok|YouTube)/.test(first)) return text;
  return text.charAt(0).toLocaleLowerCase("es-ES") + text.slice(1);
}

export function composeMessages(input: OutreachInput, sender: Sender): ComposedMessages {
  const top = sortOpportunities(input.opportunities)[0];
  if (!top) throw new NotEnoughEvidenceError();

  const facts = buildFacts(input);
  const used: Fact[] = [];
  const cite = (id: string) => {
    const f = facts.find((x) => x.id === id);
    if (f && !used.includes(f)) used.push(f);
  };

  const { company } = input;
  const name = shortName(company.name);
  const site = company.website ? displayUrl(input.analyzedUrl ?? company.website).split("/")[0] : null;
  const ratingSource = company.fieldSources.rating === "google_places" ? " en Google" : "";
  const goodReputation =
    company.rating != null &&
    company.reviewCount != null &&
    company.rating >= GOOD_REPUTATION.rating &&
    company.reviewCount >= GOOD_REPUTATION.reviews;

  cite(`opportunity:${top.id}`);
  const problem = afterColon(sentence(top.problem));
  const consequence = sentence(top.consequence);
  const detail = `${problem}${problem.length + consequence.length <= 320 ? ` ${consequence}` : ""}`;
  const question = QUESTIONS[top.serviceKey] ?? DEFAULT_QUESTION;
  const signature = sender.name ?? SENDER_PLACEHOLDER;
  const where = site ? `vuestra web (${site})` : `la información pública de ${name}`;

  // Specific detail about the business: real reputation, else where we looked.
  const emailParts = [`Hola, equipo de ${name}:`];
  let hookShort: string | null = null;
  if (goodReputation) {
    cite("rating");
    const r = `un ${formatRating(company.rating)} con ${formatNumber(company.reviewCount)} reseñas${ratingSource}`;
    hookShort = `Tenéis ${r}, muy buena señal.`;
    emailParts.push(
      `He visto que tenéis ${r}, una reputación que cuesta mucho construir.`,
      `${site ? `Revisando ${site} me fijé` : "Me fijé"} en un detalle: ${detail}`,
    );
  } else if (site) {
    cite("website");
    emailParts.push(`Estuve revisando vuestra web (${site}) y me fijé en un detalle: ${detail}`);
  } else {
    cite("no_website");
    emailParts.push(`Estuve buscando ${name} en internet y me fijé en un detalle: ${detail}`);
  }
  emailParts.push(`${question} ${SOFT_CLOSE}`, `Un saludo,\n${signature}${sender.company ? `\n${sender.company}` : ""}`);

  const linkedin = [
    `Hola, he estado mirando ${where}.`,
    hookShort,
    `Me llamó la atención un detalle: ${problem}`,
    question,
  ]
    .filter(Boolean)
    .join(" ");

  const whatsapp = [
    sender.name ? `Hola, soy ${sender.name}${sender.company ? ` de ${sender.company}` : ""}.` : `Hola, soy ${SENDER_PLACEHOLDER}.`,
    `Estuve viendo ${where} y me fijé en algo: ${problem}`,
    question,
  ].join(" ");

  return {
    email: {
      subject: (SUBJECTS[top.serviceKey] ?? ((n: string) => `Una pregunta para ${n}`))(name),
      body: emailParts.join("\n\n"),
    },
    linkedin: { body: linkedin },
    whatsapp: { body: whatsapp },
    basis: {
      facts: facts.filter((f) => used.includes(f)).map((f) => ({ text: f.text, source: f.source })),
      opportunityIds: used.flatMap((f) => (f.opportunityId ? [f.opportunityId] : [])),
    },
  };
}
