import type { Segment } from "./segments";

export const SEQUENCE_FOR_SEGMENT: Record<Segment, string | null> = {
  booked: null,
  booking_abandon: "booking_abandon",
  offer_click_no_book: "offer_click_no_book",
  high_watch: "high_watch",
  mid_watch: "mid_watch",
  low_watch: "low_watch",
  registered_no_show: "registered_no_show",
  lead: null,
};
