/**
 * Behavioral segmentation — the six paths from the ebook (§4.2), derived from a
 * lead's event history. This is the "behavior is intent" logic: what someone did
 * places them in exactly one segment, and the automation map (automations.ts)
 * routes each segment to its own follow-up.
 *
 * `deriveSegment` takes the event NAMES a lead has fired (newest or oldest order
 * doesn't matter) and returns their current, most-advanced state.
 */

import { EVENTS, type EventName } from "./events";

export type Segment =
  | "booked" // converted: booked the call
  | "booking_abandon" // started booking, didn't finish
  | "offer_click_no_book" // clicked the offer CTA, never started booking
  | "high_watch" // watched 50 to 90 percent (or completed)
  | "mid_watch" // watched 25 to 50 percent
  | "low_watch" // opened / watched under 25 percent
  | "registered_no_show" // registered, never opened the room
  | "lead"; // fallback (e.g. only a page view)

export const SEGMENT_LABELS: Record<Segment, string> = {
  booked: "Booked the call",
  booking_abandon: "Started booking, didn't finish",
  offer_click_no_book: "Clicked to book, didn't",
  high_watch: "High watch (50 to 90%)",
  mid_watch: "Mid watch (25 to 50%)",
  low_watch: "Low watch (0 to 25%)",
  registered_no_show: "Registered, no-show",
  lead: "Lead",
};

/** All segments in funnel-depth order (deepest first) — handy for the dashboard. */
export const SEGMENTS_IN_ORDER: Segment[] = [
  "booked",
  "booking_abandon",
  "offer_click_no_book",
  "high_watch",
  "mid_watch",
  "low_watch",
  "registered_no_show",
  "lead",
];

export function deriveSegment(events: Array<{ event: string }>): Segment {
  const has = (e: EventName) => events.some((x) => x.event === e);

  if (has(EVENTS.booked)) return "booked";
  if (has(EVENTS.bookingStarted)) return "booking_abandon";
  if (has(EVENTS.offerCtaClicked)) return "offer_click_no_book";

  if (has(EVENTS.completed) || has(EVENTS.watch90) || has(EVENTS.watch75))
    return "high_watch";
  if (has(EVENTS.watch50)) return "mid_watch";
  if (has(EVENTS.roomOpened) || has(EVENTS.watch25)) return "low_watch";

  if (has(EVENTS.registered) || has(EVENTS.confirmedView))
    return "registered_no_show";

  return "lead";
}
