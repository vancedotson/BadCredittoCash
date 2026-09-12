import { describe, expect, it } from "vitest";
import { EVENTS } from "./events";
import { deriveSegment } from "./segments";

describe("deriveSegment", () => {
  it("keeps live attendance and booking attempts out of evergreen follow-up segments", () => {
    expect(deriveSegment([
      { event: EVENTS.registered },
      ...[EVENTS.roomOpened, EVENTS.bookingStarted, EVENTS.livePresence].map((event) => ({ event, props: { funnel: "live" } })),
    ])).toBe("registered_no_show");
    expect(deriveSegment([{ event: EVENTS.registered, props: { funnel: "live" } }])).toBe("lead");
  });

  it("recognizes a confirmed call across funnels", () => {
    expect(deriveSegment([{ event: EVENTS.booked, props: { funnel: "live" } }])).toBe("booked");
  });

  it.each([
    [[], "lead"],
    [[EVENTS.registered], "registered_no_show"],
    [[EVENTS.roomOpened], "low_watch"],
    [[EVENTS.watch25], "low_watch"],
    [[EVENTS.watch50], "mid_watch"],
    [[EVENTS.watch75], "high_watch"],
    [[EVENTS.watch90], "high_watch"],
    [[EVENTS.completed], "high_watch"],
    [[EVENTS.offerCtaClicked], "offer_click_no_book"],
    [[EVENTS.bookingStarted], "booking_abandon"],
    [[EVENTS.booked], "booked"],
  ])("maps %j to %s", (eventNames, expected) => {
    expect(deriveSegment(eventNames.map((event) => ({ event })))).toBe(expected);
  });

  it("uses the most advanced behavior regardless of event order", () => {
    expect(deriveSegment([
      { event: EVENTS.booked },
      { event: EVENTS.registered },
      { event: EVENTS.watch50 },
    ])).toBe("booked");
  });
});
