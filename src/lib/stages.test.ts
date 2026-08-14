import { describe, expect, it } from "vitest";
import { isStage, stageFromEvents } from "./stages";

describe("stageFromEvents", () => {
  it.each([
    [[], "new"],
    [["page_viewed"], "new"],
    [["webinar_registered"], "registered"],
    [["webinar_confirmed_view"], "registered"],
    [["webinar_room_opened"], "engaged"],
    [["webinar_watch_25"], "engaged"],
    [["quiz_completed"], "engaged"],
    [["call_booking_started"], "engaged"],
    [["call_booked"], "booked"],
  ])("maps %j to %s", (events, expected) => {
    expect(stageFromEvents(events)).toBe(expected);
  });

  it("keeps a booking ahead of earlier funnel events", () => {
    expect(stageFromEvents(["call_booked", "webinar_registered", "webinar_watch_50"])).toBe("booked");
  });
});

describe("isStage", () => {
  it("accepts supported stages and rejects blank or legacy values", () => {
    expect(isStage("engaged")).toBe(true);
    expect(isStage("client")).toBe(false);
    expect(isStage("")).toBe(false);
    expect(isStage(null)).toBe(false);
  });
});
