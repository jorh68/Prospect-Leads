import type { DiscoveredBusiness } from "../../domain/types";
import { isOwnWebsite, normalizePhone, normalizeUrl, socialPlatformFromUrl } from "../../text";

export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  types?: string[];
  formattedAddress?: string;
  addressComponents?: { longText: string; shortText: string; types: string[] }[];
  location?: { latitude: number; longitude: number };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  businessStatus?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | string;
  editorialSummary?: { text: string };
}

const STATUS: Record<string, DiscoveredBusiness["businessStatus"]> = {
  OPERATIONAL: "operational",
  CLOSED_TEMPORARILY: "closed_temporarily",
  CLOSED_PERMANENTLY: "closed_permanently",
};

export function parseGooglePlace(p: GooglePlace): DiscoveredBusiness | null {
  const name = p.displayName?.text?.trim();
  if (!name) return null;

  const component = (type: string) => p.addressComponents?.find((c) => c.types.includes(type));
  const route = component("route")?.longText;
  const number = component("street_number")?.longText;

  const socials: DiscoveredBusiness["socials"] = [];
  let website = normalizeUrl(p.websiteUri);
  if (website && !isOwnWebsite(website)) {
    const platform = socialPlatformFromUrl(website);
    if (platform) socials.push({ platform, url: website });
    website = null;
  }

  return {
    provider: "google_places",
    externalId: p.id,
    name,
    category: p.primaryTypeDisplayName?.text ?? p.primaryType ?? p.types?.[0] ?? null,
    website,
    phone: normalizePhone(p.internationalPhoneNumber ?? p.nationalPhoneNumber),
    email: null,
    street: route ? [route, number].filter(Boolean).join(", ") : null,
    postalCode: component("postal_code")?.longText ?? null,
    city: component("locality")?.longText ?? component("postal_town")?.longText ?? null,
    region: component("administrative_area_level_2")?.longText ?? component("administrative_area_level_1")?.longText ?? null,
    country: component("country")?.shortText ?? null,
    address: p.formattedAddress ?? null,
    latitude: p.location?.latitude ?? null,
    longitude: p.location?.longitude ?? null,
    openingHours: p.regularOpeningHours?.weekdayDescriptions ?? null,
    rating: typeof p.rating === "number" ? p.rating : null,
    reviewCount: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    mapsUrl: p.googleMapsUri ?? null,
    description: p.editorialSummary?.text ?? null,
    businessStatus: (p.businessStatus && STATUS[p.businessStatus]) || "unknown",
    socials,
    raw: p,
  };
}
