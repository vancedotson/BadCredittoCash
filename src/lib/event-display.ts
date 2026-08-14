/**
 * Presentation + taxonomy for behaviour events — the single source of truth for
 * how the 19 event names (events.ts) render, which category they belong to, and
 * whether they're "important" (high-signal). Pure data (icon is a key string),
 * used by CRM timelines, the activity feed, and its filters.
 */

import { type Tone } from "./stages";

export type EventIcon = "user" | "check" | "idea" | "play" | "cursor" | "phone" | "x" | "mail";
export type EventCategory = "registration" | "engagement" | "watch" | "booking" | "email" | "other";
export type EventDisplay = { label: string; icon: EventIcon; tone: Tone; category: EventCategory; important: boolean };

export const EVENT_CATEGORIES: EventCategory[] = ["registration", "engagement", "watch", "booking", "email", "other"];
export const CATEGORY_LABELS: Record<EventCategory, string> = {
  registration: "Registration",
  engagement: "Engagement",
  watch: "Watch",
  booking: "Booking",
  email: "Email",
  other: "Other",
};

const MAP: Record<string, EventDisplay> = {
  page_viewed: { label: "Viewed a page", icon: "cursor", tone: "neutral", category: "other", important: false },
  funnel_error: { label: "Encountered a funnel error", icon: "x", tone: "warn", category: "other", important: true },
  webinar_registered: { label: "Registered for the training", icon: "user", tone: "info", category: "registration", important: true },
  webinar_confirmed_view: { label: "Viewed the confirmation page", icon: "check", tone: "neutral", category: "watch", important: false },
  goal_replied: { label: "Shared their #1 goal", icon: "idea", tone: "active", category: "engagement", important: true },
  quiz_started: { label: "Started the concern quiz", icon: "idea", tone: "neutral", category: "engagement", important: false },
  quiz_completed: { label: "Completed the concern quiz", icon: "idea", tone: "active", category: "engagement", important: true },
  webinar_room_opened: { label: "Opened the training", icon: "play", tone: "info", category: "watch", important: false },
  webinar_watch_25: { label: "Watched 25%", icon: "play", tone: "neutral", category: "watch", important: false },
  webinar_watch_50: { label: "Watched 50%", icon: "play", tone: "neutral", category: "watch", important: false },
  webinar_watch_75: { label: "Watched 75%", icon: "play", tone: "active", category: "watch", important: false },
  webinar_watch_90: { label: "Watched 90%", icon: "play", tone: "active", category: "watch", important: false },
  webinar_completed: { label: "Finished the training", icon: "check", tone: "success", category: "watch", important: true },
  offer_cta_clicked: { label: "Clicked 'book a call'", icon: "cursor", tone: "active", category: "booking", important: true },
  call_page_view: { label: "Viewed the booking page", icon: "cursor", tone: "neutral", category: "booking", important: false },
  call_booking_started: { label: "Started booking a call", icon: "phone", tone: "active", category: "booking", important: true },
  call_booked: { label: "Booked a strategy call", icon: "phone", tone: "success", category: "booking", important: true },
  call_rescheduled: { label: "Rescheduled the strategy call", icon: "phone", tone: "info", category: "booking", important: true },
  call_cancelled: { label: "Cancelled the strategy call", icon: "x", tone: "warn", category: "booking", important: true },
  call_booking_abandoned: { label: "Left the booking unfinished", icon: "x", tone: "warn", category: "booking", important: true },
  cta_clicked: { label: "Clicked a CTA", icon: "cursor", tone: "neutral", category: "other", important: false },
  email_queued: { label: "Email sequence queued", icon: "mail", tone: "neutral", category: "email", important: false },
  email_sent: { label: "Email sent", icon: "mail", tone: "neutral", category: "email", important: false },
  email_unsubscribed: { label: "Unsubscribed from marketing email", icon: "mail", tone: "warn", category: "email", important: true },
  email_delivered: { label: "Email delivered", icon: "mail", tone: "success", category: "email", important: false },
  email_delivery_delayed: { label: "Email delivery delayed", icon: "mail", tone: "warn", category: "email", important: false },
  email_bounced: { label: "Email bounced", icon: "mail", tone: "warn", category: "email", important: true },
  email_complained: { label: "Email marked as spam", icon: "mail", tone: "warn", category: "email", important: true },
  email_failed: { label: "Email delivery failed", icon: "mail", tone: "warn", category: "email", important: true },
  email_suppressed: { label: "Email suppressed by provider", icon: "mail", tone: "warn", category: "email", important: true },
  email_opened: { label: "Email opened", icon: "mail", tone: "info", category: "email", important: false },
  email_clicked: { label: "Clicked an email link", icon: "cursor", tone: "active", category: "email", important: true },
  email_retry_scheduled: { label: "Email retry scheduled", icon: "mail", tone: "warn", category: "email", important: true },
  email_dead_lettered: { label: "Email permanently failed", icon: "mail", tone: "warn", category: "email", important: true },
};

export function displayEvent(eventName: string): EventDisplay {
  return MAP[eventName] ?? { label: eventName.replace(/_/g, " "), icon: "check", tone: "neutral", category: "other", important: false };
}
