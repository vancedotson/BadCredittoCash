/**
 * The automation map (ebook §4.3) — behaviour comes in, the funnel routes the
 * person to the right sequence. Pure routing on top of the email seam
 * (src/lib/email.ts); it holds no state of its own.
 *
 * Called from the server:
 *   - /api/lead   -> enrollNewRegistration (start the pre-webinar sequence)
 *   - /api/book   -> onBooked (stop pitching, start onboarding)
 * The per-segment routing (routeBySegment) is what a scheduled job would call as
 * leads move between segments; it's exposed here so the logic lives in one place.
 */

import { enqueueSequence } from "./email";
import { type Segment } from "./segments";
import { SEQUENCE_FOR_SEGMENT } from "./sequence-routing";

export { SEQUENCE_FOR_SEGMENT } from "./sequence-routing";

/** On registration: begin the pre-webinar (get-them-to-watch) sequence. */
export async function enrollNewRegistration(email: string): Promise<void> {
  await enqueueSequence(email, "pre_webinar");
}

/** Route a lead to the follow-up built for their current segment. */
export async function routeBySegment(
  email: string,
  segment: Segment,
): Promise<void> {
  const seq = SEQUENCE_FOR_SEGMENT[segment];
  if (seq) await enqueueSequence(email, seq);
}

/**
 * On booking (the conversion): stop every pitch sequence and start onboarding.
 * The stub email layer has no live queue to cancel yet, so "stop" is a no-op
 * today; the onboarding enrolment is what matters and is recorded for the
 * dashboard. When a real ESP is wired, cancel the lead's pending pitch sends here.
 */
export async function onBooked(
  email: string,
  appointmentStart: Date,
  timezone: string,
  bookingId: string,
): Promise<void> {
  await enqueueSequence(email, "onboarding", appointmentStart, {
    bookingId,
    startsAt: appointmentStart.toISOString(),
    timezone,
  });
}
