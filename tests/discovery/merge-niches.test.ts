import { describe, expect, it } from "vitest";
import { mergeProviderResults, isSameBusiness } from "@/lib/discovery/merge";
import { buildOsmFilters, matchNiche } from "@/lib/discovery/niches";
import { parseOverpassElements } from "@/lib/discovery/providers/osm-parse";
import { parseGooglePlace } from "@/lib/discovery/providers/google-places-parse";
import { area, googlePlace, overpassElements } from "./fixtures";

describe("mergeProviderResults", () => {
  const google = [parseGooglePlace(googlePlace)!];
  const osm = parseOverpassElements(overpassElements, area);
  const merged = mergeProviderResults([google, osm]);

  it("merges the same business across providers", () => {
    expect(merged).toHaveLength(3);
    const first = merged[0]!;
    expect(first.sources.map((s) => s.provider)).toEqual(["google_places", "osm"]);
  });

  it("keeps higher-priority values and fills gaps with provenance", () => {
    const first = merged[0]!;
    expect(first.data.rating).toBe(4.6);
    expect(first.fieldSources.rating).toBe("google_places");
    expect(first.data.socials.map((s) => s.platform)).toContain("instagram");
    expect(first.fieldSources.socials).toBe("osm");
  });

  it("does not merge chain branches that share a domain but are far apart", () => {
    const a = { name: "Cadena Ejemplo", website: "https://cadena.test", phone: null, latitude: 40.4, longitude: -3.7, postalCode: null };
    const b = { ...a, latitude: 40.5, longitude: -3.6 };
    expect(isSameBusiness(a, b)).toBe(false);
    expect(isSameBusiness(a, { ...a, latitude: 40.4001 })).toBe(true);
  });
});

describe("matchNiche", () => {
  it.each([
    ["Clínicas dentales", "dentist"],
    ["clinica dental", "dentist"],
    ["Fisioterapeutas", "physio"],
    ["Gimnasios", "gym"],
    ["Abogados laboralistas", "lawyer"],
    ["Inmobiliarias", "real_estate"],
    ["Peluquerías", "hairdresser"],
    ["Restaurantes", "restaurant"],
    ["Talleres mecánicos", "car_repair"],
  ])("%s → %s", (input, id) => {
    expect(matchNiche(input).niche?.id).toBe(id);
  });

  it("falls back to name search for unknown niches", () => {
    const m = matchNiche("Escape rooms");
    expect(m.niche).toBeNull();
    const filters = buildOsmFilters(m);
    expect(filters[0]).toBe('["shop"]["name"~"escape",i]');
  });
});
