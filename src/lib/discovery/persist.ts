import "server-only";
import type { Company, Prisma } from "@prisma/client";
import { db } from "../db";
import { fieldSourcesSchema, type FieldSources } from "../domain/types";
import { extractDomain, normalizeText } from "../text";
import { isSameBusiness, MERGEABLE_FIELDS, type MergedBusiness } from "./merge";

type Tx = Prisma.TransactionClient;

/** Fields refreshed on every discovery because they change over time. */
const VOLATILE_FIELDS = ["rating", "reviewCount", "openingHours", "businessStatus"] as const;

async function findExisting(tx: Tx, m: MergedBusiness): Promise<Company | null> {
  const bySource = await tx.companySource.findFirst({
    where: { OR: m.sources.map((s) => ({ provider: s.provider, externalId: s.externalId })) },
    include: { company: true },
  });
  if (bySource) return bySource.company;

  const domain = extractDomain(m.data.website);
  const candidates = await tx.company.findMany({
    where: {
      OR: [
        ...(domain ? [{ domain }] : []),
        { normalizedName: normalizeText(m.data.name) },
      ],
    },
    take: 20,
  });
  return candidates.find((c) => isSameBusiness(c, m.data)) ?? null;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value == null ? undefined : (value as Prisma.InputJsonValue);
}

/**
 * Insert or update one merged business and link it to the search.
 * Existing values are never overwritten with different data from a lower
 * quality source; gaps are filled and volatile fields (rating, reviews,
 * hours, status) are refreshed.
 */
export async function persistBusiness(params: {
  searchId: string;
  niche: string;
  rank: number;
  business: MergedBusiness;
}): Promise<{ companyId: string; created: boolean }> {
  const { business: m } = params;

  return db.$transaction(async (tx) => {
    const existing = await findExisting(tx, m);
    let companyId: string;
    let created = false;

    if (existing) {
      const current = fieldSourcesSchema.safeParse(existing.fieldSources);
      const fieldSources: FieldSources = current.success ? { ...current.data } : {};
      const update: Prisma.CompanyUpdateInput = {};
      const record = existing as unknown as Record<string, unknown>;

      for (const f of MERGEABLE_FIELDS) {
        const incoming = m.data[f];
        if (incoming == null) continue;
        const isVolatile = (VOLATILE_FIELDS as readonly string[]).includes(f);
        if (record[f] == null || isVolatile) {
          (update as Record<string, unknown>)[f] = f === "openingHours" ? toJson(incoming) : incoming;
          if (m.fieldSources[f]) fieldSources[f] = m.fieldSources[f];
        }
      }
      if (m.data.businessStatus !== "unknown") update.businessStatus = m.data.businessStatus;
      if (!existing.domain && m.data.website) update.domain = extractDomain(m.data.website);
      update.fieldSources = fieldSources;

      await tx.company.update({ where: { id: existing.id }, data: update });
      companyId = existing.id;
    } else {
      const { socials: _socials, openingHours, businessStatus, ...data } = m.data;
      const company = await tx.company.create({
        data: {
          ...data,
          openingHours: toJson(openingHours),
          businessStatus,
          normalizedName: normalizeText(m.data.name),
          domain: extractDomain(m.data.website),
          niche: params.niche,
          fieldSources: m.fieldSources,
        },
      });
      companyId = company.id;
      created = true;
    }

    for (const s of m.sources) {
      await tx.companySource.upsert({
        where: { provider_externalId: { provider: s.provider, externalId: s.externalId } },
        create: {
          companyId,
          provider: s.provider,
          externalId: s.externalId,
          url: s.mapsUrl,
          payload: toJson(s.raw) ?? {},
        },
        update: { payload: toJson(s.raw) ?? {}, url: s.mapsUrl, fetchedAt: new Date() },
      });
      for (const social of s.socials) {
        await tx.socialProfile.upsert({
          where: { companyId_platform_url: { companyId, platform: social.platform, url: social.url } },
          create: { companyId, platform: social.platform, url: social.url, source: s.provider },
          update: {},
        });
      }
    }

    await tx.searchResult.upsert({
      where: { searchId_companyId: { searchId: params.searchId, companyId } },
      create: {
        searchId: params.searchId,
        companyId,
        rank: params.rank,
        provider: m.sources[0]!.provider,
      },
      update: {},
    });

    return { companyId, created };
  });
}
