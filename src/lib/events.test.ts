import { describe, expect, it } from "vitest";
import { EVENTS, PUBLIC_TRACKING_EVENTS, isPublicTrackingEvent } from "./events";

describe("isPublicTrackingEvent", () => {
  it.each(PUBLIC_TRACKING_EVENTS)("accepts browser event %s", (event) => {
    expect(isPublicTrackingEvent(event)).toBe(true);
  });

  it.each([
    EVENTS.registered,
    EVENTS.booked,
    EVENTS.bookingRescheduled,
    EVENTS.bookingCancelled,
    EVENTS.emailSent,
    EVENTS.emailDelivered,
    EVENTS.emailBounced,
  ])("rejects privileged event %s", (event) => {
    expect(isPublicTrackingEvent(event)).toBe(false);
  });

  it.each([undefined, null, 25, {}, "", "webinar_watch_100", "call_booked "])(
    "rejects malformed value %j",
    (value) => {
      expect(isPublicTrackingEvent(value)).toBe(false);
    },
  );
});
