import "server-only";
import { z } from "zod";
import { db } from "../db";
import { env } from "../env";
import { errorMessage } from "../http";
import { logActivity } from "../activity";
import { generateObject, isLlmAvailable } from "../llm";
import { SERVICES, type Generator, type MessageChannel } from "../domain/constants";
import { loadCompanyDossier, type CompanyDossier } from "../reports/dossier";
import { composeMessages, NotEnoughEvidenceError, sentence, type ComposedMessages, type Sender } from "./compose";
import { buildFacts, type OutreachInput } from "./facts";

export function toOutreachInput(d: CompanyDossier): OutreachInput {
  const c = d.company;
  return {
    company: {
      name: c.name,
      niche: c.niche,
      category: c.category,
      city: c.city,
      website: c.website,
      phone: c.phone,
      email: c.email,
      rating: c.rating,
      reviewCount: c.reviewCount,
      mapsUrl: c.mapsUrl,
      fieldSources: d.fieldSources,
    },
    socials: c.socialProfiles.map((s) => ({ platform: s.platform, url: s.url })),
    findings: d.findings,
    opportunities: d.opportunities,
    analyzedUrl: d.analysis?.finalUrl ?? d.analysis?.url ?? null,
  };
}

export function outreachSender(): Sender {
  return { name: env().OUTREACH_SENDER_NAME ?? null, company: env().OUTREACH_SENDER_COMPANY ?? null };
}

// ── LLM path ─────────────────────────────────────────────────────

const llmOutputSchema = z.object({
  email: z.object({ subject: z.string().min(3).max(90), body: z.string().min(40).max(1400) }),
  linkedin: z.object({ body: z.string().min(40).max(900) }),
  whatsapp: z.object({ body: z.string().min(20).max(600) }),
  usedFactIds: z.array(z.string()).min(1),
});

const SYSTEM = `Escribes primeros mensajes comerciales en español de España para una consultora de IA y automatización.
Reglas estrictas:
- Usa SOLO los hechos de la lista. No inventes datos, cifras, nombres de personas, clientes, resultados ni casos de éxito.
- Menciona algo concreto y real del negocio y una posible oportunidad basada en la evidencia.
- No vendas: el objetivo es abrir una conversación. Termina con una pregunta abierta y sencilla.
- Breve y natural, tuteando al equipo ("vosotros"). Nada de frases hechas de marketing, emojis ni signos de exclamación en exceso.
- No pongas enlaces ni corchetes salvo el marcador de firma indicado.
- Email: asunto corto (menos de 60 caracteres, sin mayúsculas innecesarias) y cuerpo de 60 a 120 palabras con saludo y firma.
- LinkedIn: 40 a 80 palabras, sin firma.
- WhatsApp: 25 a 50 palabras, presentándote con el nombre del remitente.
- usedFactIds: los ids de los hechos que has citado.`;

async function composeWithLlm(input: OutreachInput, sender: Sender): Promise<ComposedMessages | null> {
  const facts = buildFacts(input);
  const top = input.opportunities.slice(0, 3).map((o) => ({
    factId: `opportunity:${o.id}`,
    problem: sentence(o.problem),
    evidence: o.evidence,
    consequence: o.consequence,
    service: SERVICES[o.serviceKey as keyof typeof SERVICES]?.label ?? o.serviceKey,
  }));
  const prompt = [
    `Empresa: ${input.company.name}${input.company.category ? ` (${input.company.category})` : ""}${
      input.company.city ? `, ${input.company.city}` : ""
    }`,
    `Remitente: ${sender.name ?? "[Tu nombre]"}${sender.company ? `, de ${sender.company}` : ""}`,
    "",
    "Hechos verificados (id — hecho — fuente):",
    ...facts.map((f) => `- ${f.id} — ${f.text} — ${f.source}`),
    "",
    "Oportunidades priorizadas (usa sobre todo la primera):",
    JSON.stringify(top, null, 2),
  ].join("\n");

  const out = await generateObject({ system: SYSTEM, prompt, schema: llmOutputSchema, maxTokens: 3000, effort: "low" });
  if (!out) return null;

  const known = new Map(facts.map((f) => [f.id, f]));
  const used = out.usedFactIds.map((id) => known.get(id)).filter((f) => f != null);
  if (used.length === 0) throw new Error("La IA no indicó en qué hechos se basa el mensaje");
  return {
    email: out.email,
    linkedin: out.linkedin,
    whatsapp: out.whatsapp,
    basis: {
      facts: used.map((f) => ({ text: f.text, source: f.source })),
      opportunityIds: used.flatMap((f) => (f.opportunityId ? [f.opportunityId] : [])),
    },
  };
}

// ── Entry point ──────────────────────────────────────────────────

export interface GenerateMessagesResult {
  generator: Generator;
  /** Set when the LLM was tried and failed, so the UI can say why rules were used. */
  warning: string | null;
}

/**
 * Writes a fresh email / LinkedIn / WhatsApp set for a company and stores it.
 * Earlier versions stay in the table as history. Throws NotEnoughEvidenceError
 * when there is no evidence-backed opportunity to talk about.
 */
export async function generateMessagesForCompany(companyId: string): Promise<GenerateMessagesResult> {
  const dossier = await loadCompanyDossier(companyId);
  if (!dossier) throw new Error("La empresa no existe");
  const input = toOutreachInput(dossier);
  if (input.opportunities.length === 0) throw new NotEnoughEvidenceError();

  const sender = outreachSender();
  let composed: ComposedMessages | null = null;
  let generator: Generator = "rules";
  let warning: string | null = null;

  if (isLlmAvailable()) {
    try {
      composed = await composeWithLlm(input, sender);
      if (composed) generator = "llm";
    } catch (e) {
      warning = `La IA no pudo redactar los mensajes (${errorMessage(e)}); se han generado con reglas.`;
      console.error(`[messages] fallo de la IA para ${companyId}:`, e);
    }
  }
  composed ??= composeMessages(input, sender);

  const rows: { channel: MessageChannel; subject: string | null; body: string }[] = [
    { channel: "email", subject: composed.email.subject, body: composed.email.body },
    { channel: "linkedin", subject: null, body: composed.linkedin.body },
    { channel: "whatsapp", subject: null, body: composed.whatsapp.body },
  ];

  await db.$transaction(async (tx) => {
    for (const r of rows) {
      await tx.message.create({ data: { companyId, ...r, generator, basis: composed.basis } });
    }
    await logActivity(
      {
        type: "message_generated",
        message: `Mensajes de contacto generados (email, LinkedIn y WhatsApp)${generator === "llm" ? " con IA" : ""}`,
        companyId,
        meta: { generator },
      },
      tx,
    );
  });

  return { generator, warning };
}

/** Latest message per channel plus how many earlier versions exist. */
export async function latestMessages(companyId: string) {
  const all = await db.message.findMany({ where: { companyId }, orderBy: { createdAt: "desc" } });
  const latest = new Map<string, (typeof all)[number]>();
  for (const m of all) if (!latest.has(m.channel)) latest.set(m.channel, m);
  return { latest, versions: all.length };
}
