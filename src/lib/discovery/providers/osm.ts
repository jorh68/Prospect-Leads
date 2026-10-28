import "server-only";
import { env, overpassUrls } from "../../env";
import { ExternalServiceError, fetchJson } from "../../http";
import type { DiscoveredBusiness, SearchArea } from "../../domain/types";
import { parseOverpassElements, type OverpassElement } from "./osm-parse";

/**
 * OpenStreetMap discovery: Nominatim geocodes the location, Overpass returns
 * every mapped business with the niche's tags inside that area. Keyless.
 * OSM has no ratings or review counts; those stay null (never estimated).
 */

interface NominatimResult {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  boundingbox: [string, string, string, string];
  address?: { country_code?: string };
}

export async function geocode(location: string): Promise<SearchArea | null> {
  const url = new URL("/search", env().NOMINATIM_URL);
  url.searchParams.set("q", location);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "es");

  const results = await fetchJson<NominatimResult[]>(url.toString(), {
    service: "Nominatim (OpenStreetMap)",
    timeoutMs: 15000,
  });
  const r = results[0];
  if (!r) return null;
  const [south, north, west, east] = r.boundingbox.map(Number) as [number, number, number, number];
  return {
    displayName: r.display_name,
    latitude: Number(r.lat),
    longitude: Number(r.lon),
    boundingBox: [south, north, west, east],
    osmType: r.osm_type,
    osmId: r.osm_id,
    countryCode: r.address?.country_code?.toUpperCase() ?? null,
  };
}

/** Overpass area id for a Nominatim relation/way, or null for nodes. */
export function overpassAreaId(area: SearchArea): number | null {
  if (area.osmId == null) return null;
  if (area.osmType === "relation") return 3600000000 + area.osmId;
  if (area.osmType === "way") return 2400000000 + area.osmId;
  return null;
}

export function buildOverpassQuery(area: SearchArea, filters: string[], limit: number): string {
  const areaId = overpassAreaId(area);
  const scope = areaId != null ? "(area.searchArea)" : `(around:5000,${area.latitude},${area.longitude})`;
  const header = areaId != null ? `area(id:${areaId})->.searchArea;\n` : "";
  const body = filters.map((f) => `  nwr${f}["name"]${scope};`).join("\n");
  return `[out:json][timeout:90];\n${header}(\n${body}\n);\nout center tags ${limit};`;
}

export async function searchOsm(params: {
  area: SearchArea;
  filters: string[];
  limit: number;
}): Promise<DiscoveredBusiness[]> {
  const query = buildOverpassQuery(params.area, params.filters, params.limit);
  const endpoints = overpassUrls();
  let lastError: unknown = null;

  for (const endpoint of endpoints) {
    try {
      const data = await fetchJson<{ elements: OverpassElement[]; remark?: string }>(endpoint, {
        service: "Overpass (OpenStreetMap)",
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }).toString(),
        timeoutMs: 100000,
        retries: 1,
      });
      if (data.remark && /runtime error|timed out/i.test(data.remark)) {
        throw new ExternalServiceError("Overpass (OpenStreetMap)", data.remark);
      }
      return parseOverpassElements(data.elements ?? [], params.area);
    } catch (e) {
      lastError = e;
      console.warn(`[discovery] Overpass ${endpoint} falló:`, (e as Error).message);
    }
  }
  throw lastError ?? new ExternalServiceError("Overpass (OpenStreetMap)", "sin endpoints configurados");
}
