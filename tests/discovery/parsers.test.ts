import { describe, expect, it } from "vitest";
import { parseOverpassElements } from "@/lib/discovery/providers/osm-parse";
import { parseGooglePlace } from "@/lib/discovery/providers/google-places-parse";
import { buildOverpassQuery, overpassAreaId } from "@/lib/discovery/providers/osm";
import { area, googlePlace, overpassElements } from "./fixtures";

describe("OSM parser", () => {
  const results = parseOverpassElements(overpassElements, area);

  it("skips unnamed and disused features", () => {
    expect(results.map((r) => r.externalId)).toEqual(["node/1", "node/3", "way/2"]);
  });

  it("maps tags to business fields", () => {
    const b = results[0]!;
    expect(b.name).toBe("Clínica Dental Ejemplo");
    expect(b.website).toBe("https://www.dental-ejemplo.test/");
    expect(b.phone).toBe("+34910000001");
    expect(b.address).toBe("Calle Falsa, 1, 28001 Madrid");
    expect(b.city).toBe("Madrid");
    expect(b.category).toBe("Dentista");
    expect(b.openingHours).toBe("Mo-Fr 09:00-20:00");
    expect(b.socials).toEqual([{ platform: "instagram", url: "https://www.instagram.com/dentalejemplo" }]);
    expect(b.mapsUrl).toBe("https://www.openstreetmap.org/node/1");
  });

  it("never invents ratings or reviews", () => {
    expect(results.every((r) => r.rating === null && r.reviewCount === null)).toBe(true);
  });

  it("moves social-network 'websites' to socials", () => {
    const b = results.find((r) => r.externalId === "node/3")!;
    expect(b.website).toBeNull();
    expect(b.socials[0]?.platform).toBe("facebook");
  });

  it("uses way centre coordinates", () => {
    const b = results.find((r) => r.externalId === "way/2")!;
    expect([b.latitude, b.longitude]).toEqual([40.43, -3.69]);
  });
});

describe("Overpass query", () => {
  it("uses the area id for relations", () => {
    expect(overpassAreaId(area)).toBe(3605326784);
    const q = buildOverpassQuery(area, ['["amenity"="dentist"]'], 100);
    expect(q).toContain("area(id:3605326784)->.searchArea;");
    expect(q).toContain('nwr["amenity"="dentist"]["name"](area.searchArea);');
    expect(q).toContain("out center tags 100;");
  });

  it("falls back to a radius around nodes", () => {
    const q = buildOverpassQuery({ ...area, osmType: "node" }, ['["shop"="florist"]'], 50);
    expect(q).toContain("(around:5000,40.4167,-3.7036)");
  });
});

describe("Google Places parser", () => {
  it("maps a place", () => {
    const b = parseGooglePlace(googlePlace)!;
    expect(b.externalId).toBe("ChIJ-ejemplo-1");
    expect(b.rating).toBe(4.6);
    expect(b.reviewCount).toBe(213);
    expect(b.city).toBe("Madrid");
    expect(b.postalCode).toBe("28001");
    expect(b.street).toBe("Calle Falsa, 1");
    expect(b.country).toBe("ES");
    expect(b.businessStatus).toBe("operational");
    expect(b.phone).toBe("+34910000001");
  });

  it("tolerates address components without types (seen in real responses)", () => {
    const place = {
      ...googlePlace,
      addressComponents: [{ longText: "Calle Falsa, 1, entresuelo" }, ...googlePlace.addressComponents],
    };
    const b = parseGooglePlace(place)!;
    expect(b.city).toBe("Madrid");
    expect(b.street).toBe("Calle Falsa, 1");
  });
});
