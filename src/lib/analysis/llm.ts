import "server-only";
import { z } from "zod";
import { SERVICE_KEYS, type ServiceKey } from "../domain/constants";
import type { OpportunityInput } from "../domain/types";
import { generateObject, isLlmAvailable } from "../llm";
import { normalizeText } from "../text";
import type { CompanyContext } from "./collect";
import type { Interpretation } from "./interpret";
import type { AnalysisSignals } from "./signals";

/**
 * Optional AI layer. The rules path already produces complete output; the
 * model may only (a) rewrite the summary and the wording of existing
 * opportunities, and (b) propose a few extra opportunities whose evidence is
 * a literal quote that we verify against the crawled text. Anything that
 * fails verification is dropped, so the model cannot introduce facts.
 */

const outputSchema = z.object({
  summary: z.string(),
  rewrites: z.array(
    z.object({
      type: z.string(),
      problem: z.string(),
      consequence: z.string(),
      solution: z.string(),
    }),
  ),
  extra: z.array(
    z.object({
      title: z.string(),
      problem: z.string(),
      evidenceQuote: z.string(),
      consequence: z.string(),
      solution: z.string(),
      serviceKey: z.string(),
      impact: z.enum(["low", "medium", "high"]),
    }),
  ),
});
export type LlmOutput = z.infer<typeof outputSchema>;

const SYSTEM = `Eres analista comercial de una consultora de IA y automatización que prospecta negocios locales en España.
Recibes los datos reales de una empresa y el análisis automático de su web. Reglas estrictas:
- No inventes datos. Usa solo lo que aparece en el JSON. Si algo no está, no lo afirmes.
- Escribe en español de España, claro y concreto, sin jerga ni exageraciones, sin cifras que no estén en los datos.
- "summary": 3–5 frases que expliquen la situación del negocio y dónde parece perder oportunidades, citando hechos concretos.
- "rewrites": para cada oportunidad existente (mismo "type") puedes mejorar la redacción de problem/consequence/solution manteniendo el sentido. No cambies la evidencia.
- "extra": como máximo 2 oportunidades adicionales SOLO si el texto de la web lo justifica. "evidenceQuote" debe ser una cita literal (copiada tal cual, 5–25 palabras) del campo pageText. "serviceKey" debe ser uno de: ${SERVICE_KEYS.join(", ")}. Si no hay nada sólido, devuelve una lista vacía.`;

export function verifyQuote(quote: string, corpus: string): boolean {
  const q = normalizeText(quote);
  return q.split(" ").length >= 4 && normalizeText(corpus).includes(q);
}

/** Apply a model answer to the rules result, dropping anything unverifiable. */
export function applyLlmOutput(
  base: Interpretation,
  out: LlmOutput,
  corpus: string,
): { summary: string; opportunities: OpportunityInput[]; dropped: number } {
  const byType = new Map(out.rewrites.map((r) => [r.type, r]));
  const opportunities = base.opportunities.map((o) => {
    const r = byType.get(o.type);
    if (!r || !r.problem.trim() || !r.consequence.trim() || !r.solution.trim()) return o;
    return { ...o, problem: r.problem.trim(), consequence: r.consequence.trim(), solution: r.solution.trim() };
  });
  let dropped = 0;
  for (const x of out.extra.slice(0, 2)) {
    const known = (SERVICE_KEYS as string[]).includes(x.serviceKey);
    if (!known || !verifyQuote(x.evidenceQuote, corpus)) {
      dropped++;
      continue;
    }
    const slug = normalizeText(x.title).replace(/\s+/g, "_").slice(0, 40) || "otra";
    opportunities.push({
      type: `ai_${slug}`,
      title: x.title.trim(),
      problem: x.problem.trim(),
      evidence: `Texto de la web: "${x.evidenceQuote.trim()}"`,
      consequence: x.consequence.trim(),
      solution: x.solution.trim(),
      serviceKey: x.serviceKey as ServiceKey,
      impact: x.impact,
      impactNote: "Detectada por IA a partir del texto de la web; revisar.",
      confidence: 0.5,
    });
  }
  return { summary: out.summary.trim() || base.summary, opportunities, dropped };
}

export async function refineWithLlm(
  ctx: CompanyContext,
  signals: AnalysisSignals,
  base: Interpretation,
  corpus: string,
): Promise<{ summary: string; opportunities: OpportunityInput[] } | null> {
  if (!isLlmAvailable()) return null;
  const input = {
    company: {
      name: ctx.name,
      niche: ctx.niche,
      category: ctx.category,
      city: ctx.city,
      rating: ctx.rating,
      reviewCount: ctx.reviewCount,
      openingHours: ctx.openingHours,
    },
    signals: { ...signals, pages: signals.pages.map((p) => ({ url: p.url, kind: p.kind, status: p.status })) },
    findings: base.findings.map((f) => ({ key: f.key, kind: f.kind, severity: f.severity, evidence: f.evidence })),
    opportunities: base.opportunities.map((o) => ({
      type: o.type,
      title: o.title,
      problem: o.problem,
      evidence: o.evidence,
      consequence: o.consequence,
      solution: o.solution,
    })),
    pageText: corpus.slice(0, 12_000),
  };
  const out = await generateObject({
    system: SYSTEM,
    prompt: JSON.stringify(input),
    schema: outputSchema,
    maxTokens: 6000,
    effort: "low",
  });
  if (!out) return null;
  const applied = applyLlmOutput(base, out, corpus);
  if (applied.dropped) console.info(`[analysis] IA: ${applied.dropped} oportunidad(es) extra descartadas por evidencia no verificable`);
  return applied;
}
