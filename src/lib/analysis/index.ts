import "server-only";
import type { Company, Job, Prisma, SocialProfile } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { errorMessage } from "../http";
import { logActivity } from "../activity";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "../domain/constants";
import { fieldSourcesSchema, type FieldSources } from "../domain/types";
import { setJobProgress } from "../jobs/queue";
import { extractDomain, isOwnWebsite, normalizeUrl } from "../text";
import { buildSignals, crawledText, type CompanyContext } from "./collect";
import { crawlSite, hasInternetAccess, type CrawlResult } from "./crawl";
import { interpret } from "./interpret";
import { refineWithLlm } from "./llm";
import { runPageSpeed } from "./pagespeed";
import type { AnalysisSignals } from "./signals";
import { ANALYSIS_VERSION, SCORE_VERSION } from "./version";

/**
 * Website analysis, opportunity detection and scoring (module A).
 * See ARCHITECTURE.md § 8. Flow per company:
 *   crawl website → signals → findings → opportunities → score → summary
 *   (→ optional LLM wording) → persist everything + update the company.
 */

/** Discovery queues analyses only when this is true. */
export const analysisAvailable = true;

/** Error whose message is shown to the user as the reason the analysis failed. */
export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisError";
  }
}

const payloadSchema = z.object({ companyId: z.string().min(1) });

function toContext(company: Company & { socialProfiles: SocialProfile[] }): CompanyContext {
  const fs = fieldSourcesSchema.safeParse(company.fieldSources);
  const hours = company.openingHours;
  return {
    id: company.id,
    name: company.name,
    niche: company.niche,
    category: company.category,
    city: company.city,
    website: company.website,
    phone: company.phone,
    email: company.email,
    rating: company.rating,
    reviewCount: company.reviewCount,
    ratingSource: fs.success ? (fs.data.rating ?? fs.data.reviewCount ?? null) : null,
    openingHours:
      typeof hours === "string" || (Array.isArray(hours) && hours.every((h) => typeof h === "string"))
        ? (hours as string | string[])
        : null,
    businessStatus: company.businessStatus,
    socials: company.socialProfiles
      .filter((p) => (SOCIAL_PLATFORMS as readonly string[]).includes(p.platform))
      .map((p) => ({ platform: p.platform as SocialPlatform, url: p.url, source: p.source })),
  };
}

export async function runAnalysisJob(job: Job): Promise<void> {
  const { companyId } = payloadSchema.parse(job.payload);
  const company = await db.company.findUnique({ where: { id: companyId }, include: { socialProfiles: true } });
  if (!company) {
    console.warn(`[analysis] empresa ${companyId} no existe (borrada): nada que analizar`);
    return;
  }

  const ctx = toContext(company);
  const url = normalizeUrl(company.website);
  const analysis = await db.analysis.create({
    data: { companyId, status: "running", version: ANALYSIS_VERSION, url, startedAt: new Date() },
  });
  await db.company.update({ where: { id: companyId }, data: { analysisStatus: "running" } });

  try {
    let crawl: CrawlResult | null = null;
    let pageSpeed: Awaited<ReturnType<typeof runPageSpeed>> = { result: null, error: null };

    if (url && isOwnWebsite(url)) {
      await setJobProgress(job.id, { step: "crawl", url });
      crawl = await crawlSite(url);
      if (crawl.home.proxyRefused) {
        throw new AnalysisError(
          `La red de este servidor no permite conectar con ${extractDomain(url) ?? url} (lo bloquea un proxy), así que no se puede revisar la web. No es un fallo de la empresa: vuelve a lanzar el análisis desde una red con acceso.`,
        );
      }
      if (crawl.home.networkError && !(await hasInternetAccess())) {
        throw new AnalysisError(
          "El servidor no tiene acceso a internet, así que no se puede revisar la web. Vuelve a lanzar el análisis cuando haya conexión.",
        );
      }
      if (crawl.home.html) {
        await setJobProgress(job.id, { step: "pagespeed" });
        pageSpeed = await runPageSpeed(crawl.home.finalUrl);
      }
    }

    await setJobProgress(job.id, { step: "interpret" });
    const signals = buildSignals(ctx, { crawl, pageSpeed: pageSpeed.result, pageSpeedError: pageSpeed.error });
    const result = interpret(ctx, signals);

    let summary = result.summary;
    let opportunities = result.opportunities;
    let generator: "rules" | "llm" = "rules";
    try {
      const refined = await refineWithLlm(ctx, signals, result, crawledText(signals.website.mismatch ? null : crawl));
      if (refined) {
        summary = refined.summary;
        opportunities = refined.opportunities;
        generator = "llm";
      }
    } catch (e) {
      console.warn(`[analysis] IA no disponible para ${company.name}, se usan reglas: ${errorMessage(e)}`);
      signals.limitations.push("La interpretación con IA falló; el texto se ha generado con reglas.");
    }

    await setJobProgress(job.id, { step: "save" });
    await persist({ company, analysisId: analysis.id, signals, result: { ...result, summary, opportunities }, generator });
    console.info(
      `[analysis] ${company.name}: ${result.score.total}/100, ${opportunities.length} oportunidad(es), ${result.findings.length} hallazgo(s) [${generator}]`,
    );
  } catch (e) {
    const message = errorMessage(e);
    console.error(`[analysis] ${company.name} (${companyId}) falló: ${message}`);
    await db.analysis
      .update({ where: { id: analysis.id }, data: { status: "failed", error: message, finishedAt: new Date() } })
      .catch(() => {});
    await db.company.update({ where: { id: companyId }, data: { analysisStatus: "failed" } }).catch(() => {});
    await logActivity({
      type: "analysis_failed",
      message: `Análisis fallido: ${company.name}`,
      companyId,
      meta: { analysisId: analysis.id, error: message },
    }).catch(() => {});
    throw e;
  }
}

async function persist(params: {
  company: Company & { socialProfiles: SocialProfile[] };
  analysisId: string;
  signals: AnalysisSignals;
  result: ReturnType<typeof interpret>;
  generator: "rules" | "llm";
}) {
  const { company, analysisId, signals, result, generator } = params;
  const companyId = company.id;

  // Keep the user's "dismissed" decisions across re-analyses.
  const dismissed = new Set(
    (
      await db.opportunity.findMany({
        where: { companyId, status: "dismissed" },
        select: { type: true },
      })
    ).map((o) => o.type),
  );

  const fs = fieldSourcesSchema.safeParse(company.fieldSources);
  const fieldSources: FieldSources = fs.success ? { ...fs.data } : {};
  const companyUpdate: Prisma.CompanyUpdateInput = {
    score: result.score.total,
    opportunityCount: result.opportunities.filter((o) => !dismissed.has(o.type)).length,
    analyzedAt: new Date(),
    analysisStatus: "completed",
  };
  const siteEmail = signals.contact.emails[0];
  if (!company.email && siteEmail) {
    companyUpdate.email = siteEmail;
    fieldSources.email = "website";
  }
  const sitePhone = signals.contact.phones[0];
  if (!company.phone && sitePhone) {
    companyUpdate.phone = sitePhone;
    fieldSources.phone = "website";
  }
  if (company.crmStatus === "new") companyUpdate.crmStatus = "analyzed";
  companyUpdate.fieldSources = fieldSources;

  await db.$transaction(async (tx) => {
    await tx.analysis.update({
      where: { id: analysisId },
      data: {
        status: "completed",
        finalUrl: signals.website.finalUrl,
        httpStatus: signals.website.httpStatus,
        loadTimeMs: signals.website.loadTimeMs,
        pageBytes: signals.website.pageBytes,
        signals: signals as unknown as Prisma.InputJsonValue,
        summary: result.summary,
        generator,
        error: null,
        finishedAt: new Date(),
      },
    });
    if (result.findings.length) {
      await tx.finding.createMany({
        data: result.findings.map((f) => ({ ...f, evidenceUrl: f.evidenceUrl ?? null, interpretation: f.interpretation ?? null, analysisId, companyId })),
      });
    }
    if (result.opportunities.length) {
      await tx.opportunity.createMany({
        data: result.opportunities.map((o) => ({
          ...o,
          impactNote: o.impactNote ?? null,
          status: dismissed.has(o.type) ? "dismissed" : "open",
          analysisId,
          companyId,
        })),
      });
    }
    await tx.score.create({
      data: {
        companyId,
        analysisId,
        total: result.score.total,
        breakdown: result.score.breakdown as unknown as Prisma.InputJsonValue,
        version: SCORE_VERSION,
      },
    });
    await tx.company.update({ where: { id: companyId }, data: companyUpdate });

    for (const social of signals.socials) {
      await tx.socialProfile.upsert({
        where: { companyId_platform_url: { companyId, platform: social.platform, url: social.url } },
        create: { companyId, platform: social.platform, url: social.url, source: "website" },
        update: {},
      });
    }
    for (const link of signals.whatsapp.links.slice(0, 1)) {
      if (!/^https?:/.test(link)) continue;
      await tx.socialProfile.upsert({
        where: { companyId_platform_url: { companyId, platform: "whatsapp", url: link } },
        create: { companyId, platform: "whatsapp", url: link, source: "website" },
        update: {},
      });
    }

    if (signals.website.reachable) {
      const payload = {
        finalUrl: signals.website.finalUrl,
        pages: signals.pages.map((p) => ({ url: p.url, kind: p.kind, status: p.status, title: p.title })),
        emails: signals.contact.emails,
        phones: signals.contact.phones,
        socials: signals.socials,
        analysisId,
      };
      const externalId = `${companyId}:${extractDomain(signals.website.finalUrl) ?? "web"}`;
      await tx.companySource.upsert({
        where: { provider_externalId: { provider: "website", externalId } },
        create: { companyId, provider: "website", externalId, url: signals.website.finalUrl, payload },
        update: { url: signals.website.finalUrl, payload, fetchedAt: new Date() },
      });
    }

    await logActivity(
      {
        type: "analysis_completed",
        message: `Análisis completado: ${company.name} · ${result.score.total}/100 · ${result.opportunities.length} oportunidad(es)`,
        companyId,
        meta: { analysisId, score: result.score.total, opportunities: result.opportunities.length, generator },
      },
      tx,
    );
  });
}
