import { describe, expect, it } from "vitest";
import {
  activeFilterChips,
  companyFiltersQuery,
  companyOrderBy,
  companyWhere,
  hasActiveFilters,
  parseCompanyFilters,
} from "@/lib/crm/filters";

describe("parseCompanyFilters", () => {
  it("returns defaults for empty params", () => {
    const f = parseCompanyFilters({});
    expect(f).toMatchObject({ q: "", niche: null, status: null, sort: "score", dir: "desc", page: 1 });
    expect(hasActiveFilters(f)).toBe(false);
  });

  it("parses valid values and drops invalid ones", () => {
    const f = parseCompanyFilters({
      q: "  Dental Ejemplo ",
      status: "contacted",
      analysis: "bogus",
      scoreMin: "40",
      scoreMax: "150",
      ratingMin: "4,5",
      reviewsMin: "-3",
      problem: "no_whatsapp",
      service: "not_a_service",
      web: "no",
      sort: "rating",
      page: "0",
    });
    expect(f.q).toBe("Dental Ejemplo");
    expect(f.status).toBe("contacted");
    expect(f.analysis).toBeNull();
    expect(f.scoreMin).toBe(40);
    expect(f.scoreMax).toBeNull();
    expect(f.ratingMin).toBe(4.5);
    expect(f.reviewsMin).toBeNull();
    expect(f.problem).toBe("no_whatsapp");
    expect(f.service).toBeNull();
    expect(f.web).toBe("no");
    expect(f.sort).toBe("rating");
    expect(f.dir).toBe("desc");
    expect(f.page).toBe(1);
  });

  it("swaps an inverted score range and rejects unsafe problem keys", () => {
    const f = parseCompanyFilters({ scoreMin: "80", scoreMax: "20", problem: "x'; DROP" });
    expect([f.scoreMin, f.scoreMax]).toEqual([20, 80]);
    expect(f.problem).toBeNull();
  });

  it("uses the first value of repeated params", () => {
    expect(parseCompanyFilters({ city: ["Madrid", "Sevilla"] }).city).toBe("Madrid");
  });
});

describe("companyWhere", () => {
  it("is empty without filters", () => {
    expect(companyWhere(parseCompanyFilters({}))).toEqual({});
  });

  it("normalises the name search and combines filters with AND", () => {
    const where = companyWhere(parseCompanyFilters({ q: "Clínica Ñandú", city: "Madrid", oppMin: "2", web: "yes" }));
    expect(where).toEqual({
      AND: [
        { normalizedName: { contains: "clinica nandu" } },
        { city: "Madrid" },
        { opportunityCount: { gte: 2 } },
        { website: { not: null } },
      ],
    });
  });

  it("restricts problem and service filters to current analyses", () => {
    const where = companyWhere(parseCompanyFilters({ problem: "no_booking", service: "online_booking" }), ["a1", "a2"]);
    expect(where.AND).toEqual([
      { findings: { some: { key: "no_booking", kind: "issue", analysisId: { in: ["a1", "a2"] } } } },
      { opportunities: { some: { serviceKey: "online_booking", status: { not: "dismissed" }, analysisId: { in: ["a1", "a2"] } } } },
    ]);
  });

  it("builds a score range", () => {
    expect(companyWhere(parseCompanyFilters({ scoreMin: "70" })).AND).toEqual([{ score: { gte: 70 } }]);
    expect(companyWhere(parseCompanyFilters({ scoreMin: "10", scoreMax: "19" })).AND).toEqual([{ score: { gte: 10, lte: 19 } }]);
  });
});

describe("companyOrderBy", () => {
  it("puts unscored companies last when sorting by score", () => {
    expect(companyOrderBy(parseCompanyFilters({}))[0]).toEqual({ score: { sort: "desc", nulls: "last" } });
  });
  it("sorts by name ascending by default", () => {
    expect(companyOrderBy(parseCompanyFilters({ sort: "name" }))[0]).toEqual({ normalizedName: "asc" });
  });
});

describe("companyFiltersQuery", () => {
  const f = parseCompanyFilters({ q: "dental", status: "priority", sort: "rating", dir: "asc", page: "3" });

  it("omits defaults and resets the page on filter changes", () => {
    expect(companyFiltersQuery(f)).toBe("?q=dental&status=priority&sort=rating&dir=asc");
    expect(companyFiltersQuery(f, { status: null })).toBe("?q=dental&sort=rating&dir=asc");
  });

  it("keeps an explicit page", () => {
    expect(companyFiltersQuery(f, { page: 4 })).toBe("?q=dental&status=priority&sort=rating&dir=asc&page=4");
  });

  it("returns an empty string for the default view", () => {
    expect(companyFiltersQuery(parseCompanyFilters({}))).toBe("");
  });

  it("round-trips through parseCompanyFilters", () => {
    const qs = companyFiltersQuery(f, { page: 2 });
    const again = parseCompanyFilters(Object.fromEntries(new URLSearchParams(qs)));
    expect(again).toEqual({ ...f, page: 2 });
  });
});

describe("activeFilterChips", () => {
  it("labels filters in Spanish and uses known problem labels", () => {
    const chips = activeFilterChips(parseCompanyFilters({ status: "won", problem: "no_whatsapp", ratingMin: "4.2", web: "no" }), {
      no_whatsapp: "Sin WhatsApp",
    });
    expect(chips.map((c) => c.label)).toEqual(["Estado: Ganada", "Problema: Sin WhatsApp", "Valoración ≥ 4,2", "Sin web"]);
  });
});
