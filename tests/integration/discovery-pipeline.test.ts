/**
 * End-to-end discovery pipeline against a throwaway SQLite database, with the
 * external HTTP APIs replaced by fixture responses (no network, no real data).
 */
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { area, overpassElements } from "../discovery/fixtures";

const DB_FILE = "prisma/test-pipeline.db";
process.env.DATABASE_URL = "file:./test-pipeline.db";
delete process.env.GOOGLE_PLACES_API_KEY;

let mod: {
  db: typeof import("@/lib/db").db;
  createSearch: typeof import("@/lib/discovery/pipeline").createSearch;
  runDiscoveryJob: typeof import("@/lib/discovery/pipeline").runDiscoveryJob;
};

function fakeFetch(failGeocode = false) {
  return vi.fn(async (input: string | URL) => {
    const url = String(input);
    if (url.includes("/search?")) {
      if (failGeocode) throw new TypeError("fetch failed");
      return Response.json([
        {
          osm_type: area.osmType,
          osm_id: area.osmId,
          lat: String(area.latitude),
          lon: String(area.longitude),
          display_name: area.displayName,
          boundingbox: area.boundingBox.map(String),
          address: { country_code: "es" },
        },
      ]);
    }
    if (url.includes("interpreter")) return Response.json({ elements: overpassElements });
    throw new Error(`unexpected fetch ${url}`);
  });
}

async function runLatestJob(searchId: string) {
  const job = await mod.db.job.findFirstOrThrow({ where: { searchId }, orderBy: { createdAt: "desc" } });
  await mod.runDiscoveryJob(job);
}

beforeAll(async () => {
  rmSync(DB_FILE, { force: true });
  execSync("npx prisma migrate deploy", { env: { ...process.env }, stdio: "ignore" });
  const { db } = await import("@/lib/db");
  const { createSearch, runDiscoveryJob } = await import("@/lib/discovery/pipeline");
  mod = { db, createSearch, runDiscoveryJob };
}, 60_000);

afterAll(async () => {
  await mod?.db.$disconnect();
  rmSync(DB_FILE, { force: true });
  rmSync(`${DB_FILE}-journal`, { force: true });
  vi.unstubAllGlobals();
});

describe("discovery pipeline", () => {
  it("geocodes, queries OSM, persists companies with provenance and logs activity", async () => {
    vi.stubGlobal("fetch", fakeFetch());
    const search = await mod.createSearch({ niche: "Clínicas dentales", location: "Madrid", count: 2 });
    await runLatestJob(search.id);

    const done = await mod.db.search.findUniqueOrThrow({ where: { id: search.id }, include: { results: true } });
    expect(done.status).toBe("completed");
    expect(done.resultCount).toBe(2);
    expect(done.providers).toEqual(["osm"]);
    expect((done.warnings as string[]).some((w) => w.includes("GOOGLE_PLACES_API_KEY"))).toBe(true);

    const company = await mod.db.company.findFirstOrThrow({
      where: { name: "Clínica Dental Ejemplo" },
      include: { sources: true, socialProfiles: true },
    });
    expect(company.domain).toBe("dental-ejemplo.test");
    expect(company.niche).toBe("Clínicas dentales");
    expect(company.rating).toBeNull();
    expect(company.sources).toHaveLength(1);
    expect(company.sources[0]!.provider).toBe("osm");
    expect(company.socialProfiles[0]!.platform).toBe("instagram");
    expect((company.fieldSources as Record<string, string>).phone).toBe("osm");

    const activities = await mod.db.activity.findMany({ where: { searchId: search.id } });
    expect(activities.map((a) => a.type).sort()).toEqual(["search_completed", "search_created"]);
  });

  it("re-running a search reuses existing companies instead of duplicating them", async () => {
    vi.stubGlobal("fetch", fakeFetch());
    const before = await mod.db.company.count();
    const search = await mod.createSearch({ niche: "Dentistas", location: "Madrid", count: 3 });
    await runLatestJob(search.id);
    const after = await mod.db.company.count();
    expect(after - before).toBe(1); // only the third company is new
    const results = await mod.db.searchResult.count({ where: { searchId: search.id } });
    expect(results).toBe(3);
  });

  it("marks the search as failed with a readable error when the geocoder is unreachable", async () => {
    vi.stubGlobal("fetch", fakeFetch(true));
    const search = await mod.createSearch({ niche: "Clínicas dentales", location: "Madrid", count: 5 });
    await expect(runLatestJob(search.id)).rejects.toThrow(/Nominatim/);
    const failed = await mod.db.search.findUniqueOrThrow({ where: { id: search.id } });
    expect(failed.status).toBe("failed");
    expect(failed.error).toMatch(/no se pudo conectar/);
  }, 30_000);
});
