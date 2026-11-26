import { describe, expect, it } from "vitest";
import { addChicagoDays, chicagoDateKey, chicagoDayWindow, chicagoMidnightUtc, midnightCentralLabel } from "@/lib/chicago-day";

describe("chicago calendar day", () => {
  it("resolves CST midnight (UTC-6) in January", () => {
    const start = chicagoMidnightUtc("2026-01-15");
    expect(start.toISOString()).toBe("2026-01-15T06:00:00.000Z");
    expect(chicagoDateKey(start)).toBe("2026-01-15");
    expect(chicagoDateKey(new Date(start.getTime() - 1))).toBe("2026-01-14");
  });

  it("resolves CDT midnight (UTC-5) in July", () => {
    const start = chicagoMidnightUtc("2026-07-15");
    expect(start.toISOString()).toBe("2026-07-15T05:00:00.000Z");
    expect(chicagoDateKey(start)).toBe("2026-07-15");
  });

  it("handles the 2026 spring-forward (23-hour day)", () => {
    // 2026-03-08 02:00 CST -> 03:00 CDT
    const day = chicagoDayWindow(new Date("2026-03-08T12:00:00.000Z"));
    expect(day.key).toBe("2026-03-08");
    expect(day.start.toISOString()).toBe("2026-03-08T06:00:00.000Z");
    expect(day.end.toISOString()).toBe("2026-03-09T05:00:00.000Z");
    expect(day.end.getTime() - day.start.getTime()).toBe(23 * 60 * 60 * 1000);
  });

  it("handles the 2026 fall-back (25-hour day)", () => {
    const day = chicagoDayWindow(new Date("2026-11-01T12:00:00.000Z"));
    expect(day.key).toBe("2026-11-01");
    expect(day.start.toISOString()).toBe("2026-11-01T05:00:00.000Z");
    expect(day.end.toISOString()).toBe("2026-11-02T06:00:00.000Z");
    expect(day.end.getTime() - day.start.getTime()).toBe(25 * 60 * 60 * 1000);
  });

  it("addChicagoDays crosses the DST boundary", () => {
    expect(addChicagoDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addChicagoDays("2026-11-01", 1)).toBe("2026-11-02");
  });

  it("labels the reset as midnight Central", () => {
    expect(midnightCentralLabel(null)).toBe("midnight Central");
    expect(midnightCentralLabel(new Date("2026-01-16T06:00:00.000Z"))).toMatch(/^midnight Central \([A-Z][a-z]{2}\)$/);
  });
});
