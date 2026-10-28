import type { Provider } from "../domain/constants";
import type { DiscoveredBusiness, FieldSources } from "../domain/types";
import { distanceMeters, extractDomain, nameKey, phoneKey } from "../text";

/**
 * Combines results from several providers into one record per real business.
 * Lists are given in priority order: the first provider's values win, later
 * providers only fill gaps. Every contributing record is kept in `sources`.
 */
export interface MergedBusiness {
  data: Omit<DiscoveredBusiness, "provider" | "externalId" | "raw">;
  fieldSources: FieldSources;
  sources: DiscoveredBusiness[];
}

export const MERGEABLE_FIELDS = [
  "name",
  "category",
  "website",
  "phone",
  "email",
  "street",
  "postalCode",
  "city",
  "region",
  "country",
  "address",
  "latitude",
  "longitude",
  "openingHours",
  "rating",
  "reviewCount",
  "mapsUrl",
  "description",
] as const;
type MergeableField = (typeof MERGEABLE_FIELDS)[number];

const SAME_PLACE_METERS = 250;

type Comparable = Pick<
  DiscoveredBusiness,
  "name" | "website" | "phone" | "latitude" | "longitude" | "postalCode"
>;

function farApart(a: Comparable, b: Comparable): boolean {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return false;
  return distanceMeters({ lat: a.latitude, lon: a.longitude }, { lat: b.latitude, lon: b.longitude }) > SAME_PLACE_METERS;
}

/**
 * Whether two records describe the same business location. Chains share a
 * domain or a central phone number, so those only match when the records are
 * not far apart.
 */
export function isSameBusiness(a: Comparable, b: Comparable): boolean {
  const da = extractDomain(a.website);
  const db = extractDomain(b.website);
  if (da && db && da === db) return !farApart(a, b);

  const pa = phoneKey(a.phone);
  const pb = phoneKey(b.phone);
  if (pa && pb && pa === pb) return !farApart(a, b);

  if (nameKey(a.name) !== nameKey(b.name)) return false;
  if (farApart(a, b)) return false;
  const bothLocated = a.latitude != null && b.latitude != null;
  // Same name: same spot, or same postcode when there are no coordinates
  return bothLocated || !a.postalCode || !b.postalCode || a.postalCode === b.postalCode;
}

function emptyValue(v: unknown): boolean {
  return v == null || v === "" || (Array.isArray(v) && v.length === 0);
}

function fromSingle(b: DiscoveredBusiness): MergedBusiness {
  const { provider, externalId: _id, raw: _raw, ...data } = b;
  const fieldSources: FieldSources = {};
  for (const f of MERGEABLE_FIELDS) if (!emptyValue(data[f])) fieldSources[f] = provider;
  if (data.socials.length) fieldSources.socials = provider;
  return { data: { ...data, socials: [...data.socials] }, fieldSources, sources: [b] };
}

function absorb(target: MergedBusiness, b: DiscoveredBusiness) {
  target.sources.push(b);
  const data = target.data as Record<MergeableField, unknown>;
  for (const f of MERGEABLE_FIELDS) {
    if (emptyValue(data[f]) && !emptyValue(b[f])) {
      data[f] = b[f];
      target.fieldSources[f] = b.provider as Provider;
    }
  }
  for (const s of b.socials) {
    if (!target.data.socials.some((x) => x.url === s.url)) {
      target.data.socials.push(s);
      target.fieldSources.socials ??= b.provider;
    }
  }
  if (target.data.businessStatus === "unknown" && b.businessStatus !== "unknown") {
    target.data.businessStatus = b.businessStatus;
  }
}

/** Merge provider lists (highest priority first), preserving order of first appearance. */
export function mergeProviderResults(lists: DiscoveredBusiness[][]): MergedBusiness[] {
  const merged: MergedBusiness[] = [];
  for (const list of lists) {
    for (const b of list) {
      // Records from the same provider are distinct entities; only merge across providers.
      const existing = merged.find(
        (m) => !m.sources.some((s) => s.provider === b.provider) && m.sources.some((s) => isSameBusiness(s, b)),
      );
      if (existing) absorb(existing, b);
      else merged.push(fromSingle(b));
    }
  }
  return merged.filter((m) => m.data.businessStatus !== "closed_permanently");
}
