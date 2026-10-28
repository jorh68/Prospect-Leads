/**
 * Pure interpretation: company + signals → findings, opportunities, score and
 * a written summary. This is the complete rules path; the optional LLM step
 * (llm.ts) only rewrites wording on top of it.
 */
import type { FindingInput, OpportunityInput, ScoreFactor } from "../domain/types";
import { SERVICES } from "../domain/constants";
import type { CompanyContext } from "./collect";
import { deriveFacts, listEs, type Facts } from "./facts";
import { buildFindings } from "./findings";
import { buildOpportunities } from "./opportunities";
import { computeScore } from "./score";
import type { AnalysisSignals } from "./signals";

export interface Interpretation {
  facts: Facts;
  findings: FindingInput[];
  opportunities: OpportunityInput[];
  score: { total: number; breakdown: ScoreFactor[] };
  summary: string;
}

export function interpret(ctx: CompanyContext, signals: AnalysisSignals, now = new Date()): Interpretation {
  const facts = deriveFacts(ctx, signals);
  const findings = buildFindings(ctx, signals, facts, now);
  const opportunities = buildOpportunities(ctx, signals, facts, findings);
  const score = computeScore(ctx, signals, facts, opportunities);
  const summary = writeSummary(ctx, signals, facts, findings, opportunities, score.total);
  return { facts, findings, opportunities, score, summary };
}

function writeSummary(
  ctx: CompanyContext,
  s: AnalysisSignals,
  f: Facts,
  findings: FindingInput[],
  opportunities: OpportunityInput[],
  total: number,
): string {
  const parts: string[] = [];
  const where = [ctx.niche ?? ctx.category, ctx.city].filter(Boolean).join(", ");
  const subject = `${ctx.name}${where ? ` (${where})` : ""}`;

  if (f.closed === "permanently") parts.push(`${subject} figura como cerrado permanentemente en las fuentes.`);

  if (!f.hasOwnSite) {
    parts.push(`${subject} no tiene web propia registrada; el análisis se basa en los datos públicos de su ficha.`);
  } else if (!f.reachable) {
    parts.push(
      f.blocked
        ? `${subject} tiene web (${f.siteLabel}), pero bloquea las visitas automáticas y su contenido no se pudo revisar.`
        : `${subject} tiene web registrada (${f.siteLabel}), pero no respondía durante el análisis (${s.website.error ?? `HTTP ${s.website.httpStatus}`}).`,
    );
  } else {
    const platform = s.website.platform ? ` hecha con ${s.website.platform.name}` : "";
    parts.push(`${subject} tiene web${platform} (${f.siteLabel}); se revisaron ${f.pagesChecked} página(s): ${f.pagesDescription}.`);

    const has: string[] = [];
    if (f.hasBooking) has.push(s.booking.vendors[0] ? `reserva online con ${s.booking.vendors[0].name}` : "solicitud de cita online");
    if (f.hasWhatsapp) has.push("WhatsApp");
    if (f.hasChat) has.push(`chat (${s.chat.vendors[0]!.name})`);
    if (f.leadForms.length) has.push("formulario de contacto");
    if (s.contact.telLinks > 0) has.push("teléfono clicable");
    if (s.tracking.crmMarketing.length) has.push(listEs(s.tracking.crmMarketing.map((v) => v.name)));
    if (has.length) parts.push(`Cuenta con ${listEs(has)}.`);

    const missing: string[] = [];
    if (!f.hasBooking && f.profile.bookingExpected) missing.push("reserva online");
    if (!f.hasInstantChannel) missing.push("WhatsApp", "chat");
    if (!f.capturesData) missing.push("formulario");
    if (!f.strongCtas.length) missing.push("una llamada a la acción clara");
    if (missing.length) {
      const list = missing.length > 1 ? `${missing.slice(0, -1).join(", ")} ni ${missing[missing.length - 1]}` : missing[0];
      parts.push(`No se detecta ${list}.`);
    }
  }

  if (ctx.reviewCount != null || ctx.rating != null) {
    const r = ctx.rating != null ? `${ctx.rating.toLocaleString("es-ES")}/5` : "sin nota";
    parts.push(`Reputación: ${r} con ${ctx.reviewCount ?? "?"} reseñas en ${f.reviewSourceLabel}.`);
  }

  const issues = findings.filter((x) => x.kind === "issue" && (x.severity === "high" || x.severity === "medium"));
  if (opportunities.length) {
    const top = opportunities.slice(0, 3).map((o) => SERVICES[o.serviceKey].label);
    parts.push(
      `Principales oportunidades: ${listEs([...new Set(top)])}. ${issues.length} problema(s) relevantes detectados; prioridad heurística ${total}/100.`,
    );
  } else {
    parts.push(`No se detectaron oportunidades con evidencia suficiente; prioridad heurística ${total}/100.`);
  }
  return parts.join(" ");
}
