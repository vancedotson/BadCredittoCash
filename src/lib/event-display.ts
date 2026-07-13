/**
 * Presentation map for behaviour events — the single source of truth for how the
 * 19 event names (events.ts) render in CRM timelines and activity feeds. Kept as
 * pure data (icon is a key string, resolved to a component in the UI) so this
 * stays a plain lib with no JSX.
 */

import { type Tone } from "./stages";

export type EventIcon =
  | "user"
  | "check"
  | "idea"
  | "play"
  | "cursor"
  | "phone"
  | "x"
  | "mail";

export type EventDisplay = { label: string; icon: EventIcon; tone: Tone };

const MAP: Record<string, EventDisplay> = {
  webinar_registered: { label: "Registered for the training", icon: "user", tone: "info" },
  webinar_confirmed_view: { label: "Viewed the confirmation page", icon: "check", tone: "neutral" },
  goal_replied: { label: "Shared their #1 goal", icon: "idea", tone: "active" },
  quiz_started: { label: "Started the concern quiz", icon: "idea", tone: "neutral" },
  quiz_completed: { label: "Completed the concern quiz", icon: "idea", tone: "active" },
  webinar_room_opened: { label: "Opened the training", icon: "play", tone: "info" },
  webinar_watch_25: { label: "Watched 25%", icon: "play", tone: "neutral" },
  webinar_watch_50: { label: "Watched 50%", icon: "play", tone: "neutral" },
  webinar_watch_75: { label: "Watched 75%", icon: "play", tone: "active" },
  webinar_watch_90: { label: "Watched 90%", icon: "play", tone: "active" },
  webinar_completed: { label: "Finished the training", icon: "check", tone: "success" },
  offer_cta_clicked: { label: "Clicked 'book a call'", icon: "cursor", tone: "active" },
  call_page_view: { label: "Viewed the booking page", icon: "cursor", tone: "neutral" },
  call_booking_started: { label: "Started booking a call", icon: "phone", tone: "active" },
  call_booked: { label: "Booked a strategy call", icon: "phone", tone: "success" },
  call_booking_abandoned: { label: "Left the booking unfinished", icon: "x", tone: "warn" },
  cta_clicked: { label: "Clicked a CTA", icon: "cursor", tone: "neutral" },
  email_queued: { label: "Email sequence queued", icon: "mail", tone: "neutral" },
  email_sent: { label: "Email sent", icon: "mail", tone: "neutral" },
};

export function displayEvent(eventName: string): EventDisplay {
  return MAP[eventName] ?? { label: eventName.replace(/_/g, " "), icon: "check", tone: "neutral" };
}
