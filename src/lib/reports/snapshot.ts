import { IMPACT_LABELS, PROVIDER_LABELS, SOCIAL_PLATFORM_LABELS, type ImpactLevel, type Provider, type SocialPlatform } from "../domain/constants";
import { displayUrl, formatDate, formatNumber, formatPhone, formatRating } from "../format";
import type { OutreachInput } from "../messages/facts";
import { severityRank, sortOpportunities } from "./priority";
import { REPORT_VERSION, type ReportContent } from "./schema";
import { recommendServices, serviceLabel } from "./services";

export interface ReportInput extends OutreachInput {
  details: {
    category: string | null;
    address: string | null;
  };
  analysis: { summary: string | null; finishedAt: Date | null; generator: string | null } | null;
  /** Providers that contributed to the company record */
  providers: string[];
  preparedBy: string | null;
  now?: Date;
}

export class ReportNotReadyError extends Error {
  constructor() {
    super("Para generar el informe, la empresa tiene que estar analizada. Lanza el análisis y vuelve a intentarlo.");
    this.name = "ReportNotReadyError";
  }
}

const MAX_RECOMMENDATIONS = 5;

/** Builds the frozen report content. Only real data from the input is used. */
export function buildReportContent(input: ReportInput): ReportContent {
  if (!input.analysis) throw new ReportNotReadyError();
  const { company } = input;
  const now = input.now ?? new Date();
  const opportunities = sortOpportunities(input.opportunities);

  const facts: { label: string; value: string }[] = [];
  facts.push({ label: "Web", value: company.website ? displayUrl(company.website) : "No tiene web propia en las fuentes consultadas" });
  if (company.rating != null) {
    facts.push({
      label: "Valoración",
      value: `${formatRating(company.rating)} / 5${company.reviewCount != null ? ` (${formatNumber(company.reviewCount)} reseñas)` : ""}`,
    });
  } else {
    facts.push({ label: "Valoración", value: "No disponible en las fuentes consultadas" });
  }
  facts.push({ label: "Teléfono", value: company.phone ? formatPhone(company.phone) : "No disponible" });
  facts.push({ label: "Email", value: company.email ?? "No disponible" });
  facts.push({
    label: "Redes sociales",
    value:
      input.socials.length > 0
        ? [...new Set(input.socials.map((s) => SOCIAL_PLATFORM_LABELS[s.platform as SocialPlatform] ?? s.platform))].join(", ")
        : "No se han encontrado perfiles enlazados",
  });

  const toItem = (f: OutreachInput["findings"][number]) => ({
    title: f.label,
    evidence: f.evidence,
    evidenceUrl: f.evidenceUrl,
    interpretation: f.interpretation,
    severity: f.severity,
    category: f.category,
  });

  const problems = input.findings
    .filter((f) => f.kind === "issue")
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .map(toItem);
  const strengths = input.findings.filter((f) => f.kind === "positive").map(toItem);

  const byImpact = (level: ImpactLevel) => opportunities.filter((o) => o.impact === level).length;
  const counts = (["high", "medium", "low"] as const)
    .map((l) => [byImpact(l), IMPACT_LABELS[l].toLowerCase()] as const)
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} de impacto ${label}`);
  const overall =
    opportunities.length === 0
      ? "Con la información pública disponible no hemos identificado oportunidades con evidencia suficiente."
      : `Hemos identificado ${opportunities.length} ${opportunities.length === 1 ? "oportunidad" : "oportunidades"} (${counts.join(", ")}). ` +
        "El impacto es una estimación cualitativa basada en la evidencia observada y en criterios heurísticos; no utiliza datos internos del negocio.";

  const summary =
    input.analysis.summary?.trim() ||
    `${company.name}${input.details.category ? ` (${input.details.category})` : ""}${company.city ? ` en ${company.city}` : ""}: ${
      problems.length
    } problemas detectados y ${opportunities.length} oportunidades comerciales a partir de su presencia digital.`;

  const sources = input.providers
    .filter((p) => p !== "website")
    .map((p) => PROVIDER_LABELS[p as Provider] ?? p);
  if (input.analyzedUrl || company.website) {
    sources.push(
      `Web de la empresa (${displayUrl(input.analyzedUrl ?? company.website)}), revisada el ${formatDate(input.analysis.finishedAt)}`,
    );
  }

  return {
    version: REPORT_VERSION,
    generatedAt: now.toISOString(),
    preparedBy: input.preparedBy,
    company: {
      name: company.name,
      category: input.details.category,
      niche: company.niche,
      address: input.details.address,
      city: company.city,
      website: company.website,
      phone: company.phone,
      email: company.email,
      rating: company.rating,
      reviewCount: company.reviewCount,
      socials: input.socials,
    },
    analysis: {
      analyzedAt: input.analysis.finishedAt?.toISOString() ?? null,
      url: input.analyzedUrl,
      generator: input.analysis.generator,
    },
    situation: { summary, facts },
    strengths,
    problems,
    opportunities: opportunities.map((o) => ({
      id: o.id,
      title: o.title,
      problem: o.problem,
      evidence: o.evidence,
      consequence: o.consequence,
      solution: o.solution,
      service: serviceLabel(o.serviceKey),
      impact: o.impact,
      impactNote: o.impactNote ?? null,
      confidence: o.confidence,
    })),
    recommendations: opportunities.slice(0, MAX_RECOMMENDATIONS).map((o) => ({ title: o.title, detail: o.solution })),
    systems: recommendServices(opportunities).map((s) => ({
      label: s.label,
      description: s.description,
      addresses: s.opportunities.map((o) => o.title),
    })),
    impact: {
      overall,
      notes: opportunities.flatMap((o) => {
        return o.impactNote ? [{ title: o.title, impact: o.impact, note: o.impactNote }] : [];
      }),
    },
    sources,
  };
}
