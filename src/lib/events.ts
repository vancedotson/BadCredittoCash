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
  bookingRescheduled: "call_rescheduled",
  bookingCancelled: "call_cancelled",
  bookingAbandoned: "call_booking_abandoned",

  // Generic UI
  pageViewed: "page_viewed",
  funnelError: "funnel_error",
  ctaClicked: "cta_clicked",

  // Email seam (fired by src/lib/email.ts so the dashboard can see the machine)
  emailQueued: "email_queued",
  emailSent: "email_sent",
  emailUnsubscribed: "email_unsubscribed",
  emailDelivered: "email_delivered",
  emailBounced: "email_bounced",
  emailComplained: "email_complained",
  emailRetryScheduled: "email_retry_scheduled",
  emailDeadLettered: "email_dead_lettered",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export const EVENT_SCHEMA_VERSION = 1 as const;

/** Events that an untrusted browser is allowed to submit to `/api/track`. */
export const PUBLIC_TRACKING_EVENTS = [
  EVENTS.pageViewed,
  EVENTS.funnelError,
  EVENTS.confirmedView,
  EVENTS.goalReplied,
  EVENTS.quizStarted,
  EVENTS.quizCompleted,
  EVENTS.roomOpened,
  EVENTS.watch25,
  EVENTS.watch50,
  EVENTS.watch75,
  EVENTS.watch90,
  EVENTS.completed,
  EVENTS.offerCtaClicked,
  EVENTS.callPageView,
  EVENTS.bookingStarted,
  EVENTS.bookingAbandoned,
  EVENTS.ctaClicked,
] as const;

export type PublicTrackingEvent = (typeof PUBLIC_TRACKING_EVENTS)[number];

const PUBLIC_TRACKING_EVENT_SET = new Set<string>(PUBLIC_TRACKING_EVENTS);

export function isPublicTrackingEvent(value: unknown): value is PublicTrackingEvent {
  return typeof value === "string" && PUBLIC_TRACKING_EVENT_SET.has(value);
}

export const EVENT_REQUIRED_PROPERTIES: Partial<Record<PublicTrackingEvent, readonly string[]>> = {
  [EVENTS.funnelError]: ["action", "reason"],
  [EVENTS.watch25]: ["pct"],
  [EVENTS.watch50]: ["pct"],
  [EVENTS.watch75]: ["pct"],
  [EVENTS.watch90]: ["pct"],
};

export const WATCH_EVENT_PERCENT: Partial<Record<PublicTrackingEvent, number>> = {
  [EVENTS.watch25]: 25,
  [EVENTS.watch50]: 50,
  [EVENTS.watch75]: 75,
  [EVENTS.watch90]: 90,
};

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
