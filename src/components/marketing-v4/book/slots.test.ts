import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDays, slotLabelOf, slotStart, TIMES } from "./slots";

afterEach(() => vi.useRealTimers());

describe("booking slot scheduling", () => {
  it("converts each displayed time to the correct local hour", () => {
    expect(TIMES.map((time) => slotStart("2026-08-17", time)?.getHours())).toEqual([9, 11, 13, 15]);
  });

  it.each([
    ["", "9:00 AM"],
    ["2026-08-17", ""],
    ["not-a-date", "9:00 AM"],
    ["2026-08-17", "09:00"],
  ])("rejects incomplete slot %s %s", (day, time) => {
    expect(slotStart(day, time)).toBeNull();
  });

  it("returns the next ten weekdays and skips weekends", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 14, 12)); // Friday, August 14, 2026

    const days = buildDays();

    expect(days).toHaveLength(10);
    expect(days[0].key).toBe("2026-08-17");
    expect(days.at(-1)?.key).toBe("2026-08-28");
    expect(days.every((day) => day.dow >= 1 && day.dow <= 5)).toBe(true);
    expect(days.map((day) => day.week)).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
  });

  it("builds a readable label only for a valid selected day", () => {
    const days = [{
      key: "2026-08-17",
      weekday: "Mon",
      dayNum: "17",
      month: "Aug",
      full: "Monday, August 17",
      dow: 1,
      week: 0,
    }];

    expect(slotLabelOf(days, "2026-08-17", "9:00 AM")).toBe("Monday, August 17 at 9:00 AM");
    expect(slotLabelOf(days, "2026-08-18", "9:00 AM")).toBe("");
  });
});
