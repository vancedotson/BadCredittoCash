/**
 * Funnel event vocabulary — the single source of truth for every behaviour
 * event the webinar funnel fires.
 *
 * Pages call track() (src/lib/tracking.ts) with these names; the segmentation
 * (src/lib/segments.ts) and the automation map (src/lib/automations.ts) read
 * them back. Centralising the strings here stops the drift that already crept
 * in ("cta_click" vs "cta_clicked") and lets TypeScript catch typos.
 *
 * The names mirror the four funnel stages the ebook measures against
 * (registration, show-up / watch time, decision): keep that order.
 */

export const EVENTS = {
  // Stage 1 — registration
  registered: "webinar_registered",

  // Stage 2 — confirmation → show-up
  confirmedView: "webinar_confirmed_view",
  goalReplied: "goal_replied",
  quizStarted: "quiz_started",
  quizCompleted: "quiz_completed",

  // Stage 3 — the room → watch time
  roomOpened: "webinar_room_opened",
  watch25: "webinar_watch_25",
  watch50: "webinar_watch_50",
  watch75: "webinar_watch_75",
  watch90: "webinar_watch_90",
  completed: "webinar_completed",

  // Stage 4 — the offer → booking (the conversion is `booked`)
  offerCtaClicked: "offer_cta_clicked",
  callPageView: "call_page_view",
  bookingStarted: "call_booking_started",
  booked: "call_booked",
  bookingAbandoned: "call_booking_abandoned",

  // Generic UI
  ctaClicked: "cta_clicked",

  // Email seam (fired by src/lib/email.ts so the dashboard can see the machine)
  emailQueued: "email_queued",
  emailSent: "email_sent",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * Watch-time milestones in ascending order. The room player fires each event
 * once as playback crosses its threshold — these percentages are the same ones
 * the segmentation uses to place a lead (0-25 / 25-50 / 50-90 / 90+).
 */
export const WATCH_MILESTONES = [
  { pct: 25, event: EVENTS.watch25 },
  { pct: 50, event: EVENTS.watch50 },
  { pct: 75, event: EVENTS.watch75 },
  { pct: 90, event: EVENTS.watch90 },
] as const;
