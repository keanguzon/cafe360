import { describe, expect, it } from "vitest";
import { isCurrentlyOpen, type CafeHoursEntry } from "./cafe-hours";

const entry = (day: number, open: string, close: string, isClosed = false): CafeHoursEntry => ({
  id: String(day), day_of_week: day, open_time: open, close_time: close, is_closed: isClosed,
});
const friday = new Date("2026-10-16T08:00:00.000Z"); // Friday 16:00 in Manila

describe("isCurrentlyOpen", () => {
  it("keeps missing and partial schedules unknown", () => {
    expect(isCurrentlyOpen([], "Asia/Manila", friday)).toBe("unknown");
    expect(isCurrentlyOpen([entry(4, "08:00", "17:00")], "Asia/Manila", friday)).toBe("unknown");
  });

  it("honors a declared closed day", () => {
    expect(isCurrentlyOpen([entry(5, "08:00", "17:00", true)], "Asia/Manila", friday)).toBe("closed");
  });

  it("uses café timezone even when viewer is outside Manila", () => {
    expect(isCurrentlyOpen([entry(5, "15:00", "17:00")], "Asia/Manila", friday)).toBe("open");
    expect(isCurrentlyOpen([entry(5, "15:00", "17:00")], "America/Los_Angeles", friday)).toBe("closed");
  });

  it("includes opening and excludes closing boundaries", () => {
    const hours = [entry(5, "16:00", "18:00")];
    expect(isCurrentlyOpen(hours, "Asia/Manila", friday)).toBe("open");
    expect(isCurrentlyOpen(hours, "Asia/Manila", new Date("2026-10-16T10:00:00Z"))).toBe("closed");
  });

  it("carries yesterday's overnight interval into today", () => {
    const hours = [entry(5, "22:00", "02:00"), entry(6, "08:00", "17:00")];
    expect(isCurrentlyOpen(hours, "Asia/Manila", new Date("2026-10-16T14:00:00Z"))).toBe("open");
    expect(isCurrentlyOpen(hours, "Asia/Manila", new Date("2026-10-16T17:59:00Z"))).toBe("open");
    expect(isCurrentlyOpen(hours, "Asia/Manila", new Date("2026-10-16T18:00:00Z"))).toBe("closed");
  });

  it("lets a previous overnight interval finish even if today is closed", () => {
    const hours = [entry(5, "22:00", "02:00"), entry(6, "08:00", "17:00", true)];
    expect(isCurrentlyOpen(hours, "Asia/Manila", new Date("2026-10-16T17:00:00Z"))).toBe("open");
  });
});
