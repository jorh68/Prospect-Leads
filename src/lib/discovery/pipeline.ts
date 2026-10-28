import "server-only";
import type { Job, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { integrations } from "../env";
import { errorMessage } from "../http";
import { logActivity } from "../activity";
import { MAX_SEARCH_COUNT, type Provider } from "../domain/constants";
import type { DiscoveredBusiness, SearchArea } from "../domain/types";
import { enqueueAnalysis, enqueueJob, setJobProgress } from "../jobs/queue";
import { analysisAvailable } from "../analysis";
import { buildOsmFilters, matchNiche } from "./niches";
import { mergeProviderResults } from "./merge";
import { persistBusiness } from "./persist";
import { geocode, searchOsm } from "./providers/osm";
import { searchGooglePlaces } from "./providers/google-places";

export const searchInputSchema = z.object({
  niche: z.string().trim().min(2, "Indica el tipo de negocio").max(80),
  location: z.string().trim().min(2, "Indica la ciudad o zona").max(120),
  count: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 empresa")
    .max(MAX_SEARCH_COUNT, `Máximo ${MAX_SEARCH_COUNT} empresas por búsqueda`),
});
export type SearchInput = z.infer<typeof searchInputSchema>;

/** Create a search and queue its discovery job. Returns the Search row. */
export async function createSearch(input: SearchInput) {
  const search = await db.search.create({
    data: {
      query: `${input.niche} en ${input.location}`,
      niche: input.niche,
      location: input.location,
      requestedCount: input.count,
    },
  });
  await logActivity({
    type: "search_created",
    message: `Nueva búsqueda: ${search.query} (${input.count} empresas)`,
    searchId: search.id,
  });
  await enqueueJob("discovery", { searchId: search.id }, { searchId: search.id });
  return search;
}

/** How many OSM records to request so ranking and merging have room. */
function osmFetchLimit(count: number) {
  return Math.min(1000, Math.max(count * 5, 150));
}

export async function runDiscoveryJob(job: Job): Promise<void> {
  const { searchId } = job.payload as { searchId: string };
  const search = await db.search.findUniqueOrThrow({ where: { id: searchId } });
  await db.search.update({
    where: { id: searchId },
    data: { status: "running", startedAt: new Date(), error: null },
  });

  const warnings: string[] = [];
  const failures: string[] = [];
  const providers: Provider[] = [];
  const progress = (step: string, extra: Record<string, number> = {}) =>
    setJobProgress(job.id, { step, ...extra });

  try {
    const match = matchNiche(search.niche);
    if (!match.niche) {
      warnings.push(
        `"${search.niche}" no corresponde a una categoría conocida de OpenStreetMap: se buscan negocios cuyo nombre lo contiene.`,
      );
    }

    // 1. Geocode the location (needed for OSM, used as bias for Google)
    await progress("geocoding");
    let area: SearchArea | null = null;
    try {
      area = await geocode(search.location);
      if (!area) failures.push(`No se encontró la ubicación "${search.location}".`);
    } catch (e) {
      failures.push(`Geocodificación: ${errorMessage(e)}`);
    }

    // 2. Query providers, highest data quality first
    const lists: DiscoveredBusiness[][] = [];

    if (integrations.googlePlaces()) {
      await progress("google_places");
      try {
        const google = await searchGooglePlaces({
          query: `${search.niche} en ${search.location}`,
          limit: search.requestedCount,
          regionCode: area?.countryCode,
          location: area ? { latitude: area.latitude, longitude: area.longitude } : null,
        });
        providers.push("google_places");
        lists.push(google);
      } catch (e) {
        failures.push(`Google Places: ${errorMessage(e)}`);
      }
    } else {
      warnings.push(
        "Google Places no está configurado (GOOGLE_PLACES_API_KEY): no hay valoraciones ni número de reseñas, solo datos de OpenStreetMap.",
      );
    }

    if (area) {
      await progress("osm");
      try {
        const osm = await searchOsm({
          area,
          filters: buildOsmFilters(match),
          limit: osmFetchLimit(search.requestedCount),
        });
        providers.push("osm");
        lists.push(osm.slice(0, Math.max(search.requestedCount * 3, 300)));
      } catch (e) {
        failures.push(`OpenStreetMap: ${errorMessage(e)}`);
      }
    }

    if (providers.length === 0) {
      throw new Error(failures.join(" · ") || "Ninguna fuente de datos respondió.");
    }

    // 3. Merge, rank and keep the requested number
    const merged = mergeProviderResults(lists).slice(0, search.requestedCount);
    if (merged.length < search.requestedCount) {
      warnings.push(`Se encontraron ${merged.length} de ${search.requestedCount} empresas solicitadas en las fuentes disponibles.`);
    }

    // 4. Persist
    const companyIds: string[] = [];
    let created = 0;
    for (const [i, business] of merged.entries()) {
      const r = await persistBusiness({ searchId, niche: search.niche, rank: i + 1, business });
      companyIds.push(r.companyId);
      if (r.created) created++;
      if (i % 5 === 4) await progress("saving", { done: i + 1, total: merged.length });
    }

    const status = failures.length > 0 ? "partial" : "completed";
    await db.search.update({
      where: { id: searchId },
      data: {
        status,
        providers,
        area: (area ?? undefined) as Prisma.InputJsonValue | undefined,
        resultCount: merged.length,
        warnings: [...warnings, ...failures],
        finishedAt: new Date(),
      },
    });
    await logActivity({
      type: "search_completed",
      message: `${search.query}: ${merged.length} empresas encontradas (${created} nuevas)`,
      searchId,
      meta: { found: merged.length, created, providers },
    });

    // 5. Hand over to analysis (module A) when available
    if (analysisAvailable) {
      for (const id of companyIds) await enqueueAnalysis(id);
    }
  } catch (e) {
    const message = errorMessage(e);
    await db.search.update({
      where: { id: searchId },
      // Failures are already part of the error message; keep only the warnings.
      data: { status: "failed", error: message, warnings, finishedAt: new Date() },
    });
    await logActivity({ type: "search_failed", message: `${search.query}: ${message}`, searchId });
    throw e;
  }
}
