import "server-only";
import { env } from "../../env";
import { fetchJson } from "../../http";
import type { DiscoveredBusiness } from "../../domain/types";
import { parseGooglePlace, type GooglePlace } from "./google-places-parse";

/**
 * Google Places API (New) — Text Search. Enabled when GOOGLE_PLACES_API_KEY is
 * set. Gives ratings and review counts that OSM does not have.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 * Max 60 results per query (3 pages of 20).
 */

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.types",
  "places.formattedAddress",
  "places.addressComponents",
  "places.location",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.editorialSummary",
  "nextPageToken",
].join(",");

export const GOOGLE_MAX_RESULTS = 60;

export async function searchGooglePlaces(params: {
  query: string;
  limit: number;
  regionCode?: string | null;
  location?: { latitude: number; longitude: number } | null;
}): Promise<DiscoveredBusiness[]> {
  const apiKey = env().GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  const out: DiscoveredBusiness[] = [];
  let pageToken: string | undefined;
  const target = Math.min(params.limit, GOOGLE_MAX_RESULTS);

  do {
    const body: Record<string, unknown> = {
      textQuery: params.query,
      languageCode: "es",
      pageSize: 20,
      ...(params.regionCode ? { regionCode: params.regionCode } : {}),
      ...(params.location
        ? { locationBias: { circle: { center: params.location, radius: 30000 } } }
        : {}),
      ...(pageToken ? { pageToken } : {}),
    };
    const data = await fetchJson<{ places?: GooglePlace[]; nextPageToken?: string }>(
      "https://places.googleapis.com/v1/places:searchText",
      {
        service: "Google Places",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
        timeoutMs: 20000,
      },
    );
    for (const place of data.places ?? []) {
      // One malformed record must not lose the rest of the results.
      try {
        const b = parseGooglePlace(place);
        if (b) out.push(b);
      } catch (e) {
        console.warn(`[discovery] Google Places: registro ${place.id ?? "?"} ignorado:`, e);
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken && out.length < target);

  return out.slice(0, target);
}
