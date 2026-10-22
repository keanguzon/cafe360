import { describe, expect, it } from "vitest";
import { formatLocalDate, formatManilaDate, parseLocalDate } from "./visit-date";

describe("visit calendar dates", () => {
  it("keeps the selected calendar day at UTC+8 local midnight", () => {
    const previousTimezone = process.env.TZ;
    process.env.TZ = "Asia/Manila";
    try {
      const selected = new Date(2026, 9, 16);
      expect(selected.toISOString()).toBe("2026-10-15T16:00:00.000Z");
      expect(formatLocalDate(selected)).toBe("2026-10-16");
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimezone;
    }
  });

  it("uses the Manila calendar day for quick check-in", () => {
    expect(formatManilaDate(new Date("2026-10-15T16:30:00.000Z"))).toBe("2026-10-16");
  });

  it("parses strict date-only values and rejects rollover dates", () => {
    expect(formatLocalDate(parseLocalDate("2024-02-29"))).toBe("2024-02-29");
    expect(() => parseLocalDate("2026-02-30")).toThrow();
    expect(() => parseLocalDate("2026-10-16T00:00:00Z")).toThrow();
  });
});
