import { describe, expect, it } from "vitest";
import { formatPhone } from "@/lib/format";

describe("formatPhone", () => {
  it("formats Spanish numbers", () => {
    expect(formatPhone("+34910000001")).toBe("+34 910 00 00 01");
    expect(formatPhone("910000001")).toBe("910 00 00 01");
  });

  it("leaves unknown formats readable", () => {
    expect(formatPhone(null)).toBe("—");
    expect(formatPhone("+4930123456")).toMatch(/^\+49/);
  });
});
