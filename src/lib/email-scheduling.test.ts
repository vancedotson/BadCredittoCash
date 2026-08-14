import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduledFor } from "./email-scheduling";

const NOW = new Date("2026-08-13T12:00:00.000Z");

afterEach(() => vi.unstubAllEnvs());

describe("email scheduling", () => {
  it("sends immediate messages at the supplied current time", () => {
    expect(scheduledFor("immediately", 0, undefined, NOW)).toEqual(NOW);
  });

  it("spaces test-mode follow-ups five minutes apart", () => {
    vi.stubEnv("EMAIL_MODE", "test");
    expect(scheduledFor("+1 hour", 1, undefined, NOW).toISOString()).toBe("2026-08-13T12:05:00.000Z");
    expect(scheduledFor("+1 day", 2, undefined, NOW).toISOString()).toBe("2026-08-13T12:10:00.000Z");
  });

  it.each([
    ["+3 hours", 0, "2026-08-13T15:00:00.000Z"],
    ["+1 day", 0, "2026-08-14T12:00:00.000Z"],
    ["+4 days", 0, "2026-08-17T12:00:00.000Z"],
    ["weekly", 2, "2026-09-03T12:00:00.000Z"],
  ])("applies production delay %s", (delay, index, expected) => {
    vi.stubEnv("EMAIL_MODE", "production");
    expect(scheduledFor(delay, index, undefined, NOW).toISOString()).toBe(expected);
  });

  it("schedules a reminder one day before its appointment", () => {
    vi.stubEnv("EMAIL_MODE", "production");
    const appointment = new Date("2026-08-20T15:00:00.000Z");
    expect(scheduledFor("1 day before", 1, appointment, NOW).toISOString()).toBe("2026-08-19T15:00:00.000Z");
  });

  it("never schedules an appointment reminder in the past", () => {
    vi.stubEnv("EMAIL_MODE", "production");
    const appointment = new Date("2026-08-13T18:00:00.000Z");
    expect(scheduledFor("1 day before", 1, appointment, NOW)).toEqual(NOW);
  });

  it("rejects unsupported production delays", () => {
    vi.stubEnv("EMAIL_MODE", "production");
    expect(() => scheduledFor("tomorrow-ish", 0, undefined, NOW)).toThrow("Unsupported sequence delay");
  });
});
