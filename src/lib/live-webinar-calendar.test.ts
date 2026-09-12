import { describe, expect, it } from "vitest";
import { calendarDate, calendarMonthDays, formatCalendarMonth, shiftCalendarMonth } from "./live-webinar-calendar";

describe("calendar dates", () => {
  it("places a UTC instant on the chosen calendar's local date", () => {
    expect(calendarDate("2026-10-01T01:30:00Z", "America/Chicago")).toBe("2026-09-30");
    expect(calendarDate("2026-09-30T23:30:00Z", "Europe/Lisbon")).toBe("2026-10-01");
  });
  it("uses the correct offset at the spring and autumn DST boundaries", () => {
    expect(calendarDate("2026-03-08T05:30:00Z", "America/Chicago")).toBe("2026-03-07");
    expect(calendarDate("2026-03-09T05:30:00Z", "America/Chicago")).toBe("2026-03-09");
    expect(calendarDate("2026-11-01T05:30:00Z", "America/Chicago")).toBe("2026-11-01");
    expect(calendarDate("2026-11-02T05:30:00Z", "America/Chicago")).toBe("2026-11-01");
  });
  it("rejects invalid instants and zones rather than silently moving a session", () => {
    expect(() => calendarDate("invalid", "UTC")).toThrow(RangeError);
    expect(() => calendarDate("2026-09-12T00:00:00Z", "Invalid/Timezone")).toThrow(RangeError);
  });
});

describe("Monday-first month grids", () => {
  it("includes adjacent dates and every leap day exactly once", () => {
    const days = calendarMonthDays("2028-02");
    expect(days).toHaveLength(35);
    expect(days[0]).toEqual({ date: "2028-01-31", day: 31, inMonth: false });
    expect(days.at(-1)).toEqual({ date: "2028-03-05", day: 5, inMonth: false });
    expect(days.filter((day) => day.inMonth)).toHaveLength(29);
    expect(days.filter((day) => day.date === "2028-02-29")).toHaveLength(1);
    expect(new Set(days.map((day) => day.date)).size).toBe(days.length);
  });
  it("retains six weeks when a 31-day month starts on Sunday", () => {
    const days = calendarMonthDays("2026-03");
    expect(days).toHaveLength(42);
    expect(days[0].date).toBe("2026-02-23");
    expect(days.at(-1)?.date).toBe("2026-04-05");
    expect(days.filter((day) => day.inMonth)).toHaveLength(31);
  });
  it("uses at least five weeks even for a four-week February", () => {
    const days = calendarMonthDays("2027-02");
    expect(days).toHaveLength(35);
    expect(days[0]).toEqual({ date: "2027-02-01", day: 1, inMonth: true });
    expect(days.at(-1)?.date).toBe("2027-03-07");
  });
  it("includes the correct neighboring year", () => {
    expect(calendarMonthDays("2027-01")[0].date).toBe("2026-12-28");
    expect(calendarMonthDays("2026-12").at(-1)?.date).toBe("2027-01-03");
  });
  it.each(["2026-00", "2026-13", "2026-2", "invalid"])("rejects malformed month %s", (month) => {
    expect(() => calendarMonthDays(month)).toThrow(RangeError);
  });
});

describe("month navigation", () => {
  it("crosses year boundaries without skipping a month", () => {
    expect(shiftCalendarMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftCalendarMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftCalendarMonth("2026-09", 0)).toBe("2026-09");
    expect(shiftCalendarMonth("2026-09", 15)).toBe("2027-12");
  });
  it("formats a stable month heading independently of browser timezone", () => {
    expect(formatCalendarMonth("2026-09")).toBe("September 2026");
    expect(formatCalendarMonth("2027-01")).toBe("January 2027");
  });
  it("rejects fractional navigation", () => {
    expect(() => shiftCalendarMonth("2026-09", 0.5)).toThrow(RangeError);
  });
});
