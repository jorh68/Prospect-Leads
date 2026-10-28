import { describe, expect, it } from "vitest";
import { daysUntil, describeFollowUp, followUpState, parseDateInput, toDateInputValue } from "@/lib/crm/dates";
import { scoreHistogram } from "@/lib/crm/stats";
import { crmDetailsSchema, noteBodySchema } from "@/lib/crm/schemas";

describe("follow-up dates", () => {
  it("stores calendar days at 12:00 UTC and reads them back", () => {
    const d = parseDateInput("2026-10-30")!;
    expect(d.toISOString()).toBe("2026-10-30T12:00:00.000Z");
    expect(toDateInputValue(d)).toBe("2026-10-30");
  });

  it("rejects invalid dates", () => {
    expect(parseDateInput("2026-02-31")).toBeNull();
    expect(parseDateInput("30/10/2026")).toBeNull();
    expect(parseDateInput("")).toBeNull();
  });

  it("classifies urgency relative to today", () => {
    const now = new Date(2026, 9, 28, 9, 0); // local 28 Oct 2026
    expect(daysUntil(parseDateInput("2026-10-28")!, now)).toBe(0);
    expect(followUpState(parseDateInput("2026-10-27")!, now)).toBe("overdue");
    expect(followUpState(parseDateInput("2026-10-28")!, now)).toBe("today");
    expect(followUpState(parseDateInput("2026-11-02")!, now)).toBe("soon");
    expect(followUpState(parseDateInput("2026-12-01")!, now)).toBe("later");
    expect(followUpState(null, now)).toBeNull();
    expect(describeFollowUp(parseDateInput("2026-10-25")!, now)).toBe("Vencido hace 3 días");
    expect(describeFollowUp(parseDateInput("2026-10-29")!, now)).toBe("Mañana");
  });
});

describe("scoreHistogram", () => {
  it("bins scores into ten ranges with 100 in the last bin", () => {
    const bins = scoreHistogram([0, 9, 10, 55, 99, 100]);
    expect(bins).toHaveLength(10);
    expect(bins.map((b) => b.count)).toEqual([2, 1, 0, 0, 0, 1, 0, 0, 0, 2]);
    expect(bins[9]).toMatchObject({ from: 90, to: 100 });
  });
});

describe("CRM input schemas", () => {
  it("turns empty fields into null and trims", () => {
    expect(crmDetailsSchema.parse({ owner: "  ", nextAction: " Llamar ", followUpAt: "" })).toEqual({
      owner: null,
      nextAction: "Llamar",
      followUpAt: null,
    });
  });

  it("reports invalid dates and long values", () => {
    const r = crmDetailsSchema.safeParse({ owner: "x".repeat(81), nextAction: "", followUpAt: "2026-13-01" });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path[0]).sort()).toEqual(["followUpAt", "owner"]);
  });

  it("rejects empty notes", () => {
    expect(noteBodySchema.safeParse("   ").success).toBe(false);
  });
});
