import { describe, expect, it } from "vitest";
import { formatLiveDate, liveDateInput, liveDateToIso, liveParticipationLabel, liveBookingLabel } from "./live-webinar-display";
import type { LiveWebinarRegistration } from "./live-webinar-types";

const registration: LiveWebinarRegistration = { id: "r1", contactId: "c1", sessionId: "s1", registeredAt: "2026-09-12T12:00:00Z", cancelledAt: null, firstRoomOpenedAt: null, attendedAt: null, lastPresenceAt: null, replayOpenedAt: null, bookingStartedAt: null, postSessionOutcome: null, timezone: null };

describe("live webinar dates", () => {
  it.each([
    ["2026-09-12T12:00", "America/New_York", "2026-09-12T16:00:00.000Z"],
    ["2026-12-12T12:00", "America/New_York", "2026-12-12T17:00:00.000Z"],
    ["2026-09-12T12:00", "Europe/Lisbon", "2026-09-12T11:00:00.000Z"],
    ["2026-09-12T12:00", "Asia/Kolkata", "2026-09-12T06:30:00.000Z"],
    ["2026-09-12T00:00", "UTC", "2026-09-12T00:00:00.000Z"],
  ])("resolves %s in %s independently of the operator's browser", (local, timezone, expected) => {
    expect(liveDateToIso(local, timezone)).toBe(expected);
    expect(liveDateInput(expected, timezone)).toBe(local);
  });
  it("rejects non-existent and ambiguous daylight-saving times", () => {
    expect(() => liveDateToIso("2026-03-08T02:30", "America/New_York")).toThrow("does not exist");
    expect(() => liveDateToIso("2026-11-01T01:30", "America/New_York")).toThrow("occurs twice");
  });
  it("handles missing timestamps without inventing dates", () => {
    expect(formatLiveDate(null)).toBe("—");
    expect(formatLiveDate("invalid")).toBe("—");
  });
});

describe("live participation labels", () => {
  it("waits thirty minutes before marking a booking incomplete and respects completed calls", () => {
    const started = { ...registration, bookingStartedAt: "2026-09-12T12:00:00Z" };
    expect(liveBookingLabel(registration, Date.parse("2026-09-12T13:00:00Z"))).toBeNull();
    expect(liveBookingLabel(started, Date.parse("2026-09-12T12:29:59Z"))).toBe("Booking started");
    expect(liveBookingLabel(started, Date.parse("2026-09-12T12:30:00Z"))).toBe("Booking incomplete (30m+)");
    expect(liveBookingLabel({ ...started, bookedAt: "2026-09-12T12:10:00Z" }, Date.parse("2026-09-12T13:00:00Z"))).toBe("Call booked");
  });
  it("does not infer attendance from room entry or replay access", () => {
    expect(liveParticipationLabel(registration)).toBe("Registered");
    expect(liveParticipationLabel({ ...registration, firstRoomOpenedAt: registration.registeredAt })).toBe("Entered room");
    expect(liveParticipationLabel({ ...registration, replayOpenedAt: registration.registeredAt })).toBe("Registered");
  });
  it("keeps finalized live outcome separate from replay activity", () => {
    expect(liveParticipationLabel({ ...registration, postSessionOutcome: "no_show", replayOpenedAt: registration.registeredAt })).toBe("No attendance recorded");
    expect(liveParticipationLabel({ ...registration, attendedAt: registration.registeredAt, replayOpenedAt: registration.registeredAt })).toBe("Present during session");
  });
});
