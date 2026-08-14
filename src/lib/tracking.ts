/**
 * Client-side behaviour tracking layer.
 *
 * The single seam for tracking what visitors do on the funnel (page views,
 * CTA clicks, registrations). Right now it pushes to window.dataLayer and
 * logs — swap the body of `track()` for your analytics/pixels when you pick
 * them (GA4, Meta Pixel, TikTok, PostHog, Segment, etc.). Everything else in
 * the app calls `track()` and doesn't care what's underneath.
 */

import { EVENT_SCHEMA_VERSION, type PublicTrackingEvent } from "@/lib/events";

type EventProps = Record<string, unknown>;
const VISITOR_KEY = "vance-visitor-id";
const FIRST_TOUCH_KEY = "vance-first-touch";
const INTERNAL_TRAFFIC_KEY = "vance-internal-traffic";

export type AttributionTouch = Record<string, string>;

export function syncInternalTrafficPreference(): boolean {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("internal");
  try {
    if (value === "1") sessionStorage.setItem(INTERNAL_TRAFFIC_KEY, "1");
    if (value === "0") sessionStorage.removeItem(INTERNAL_TRAFFIC_KEY);
    return sessionStorage.getItem(INTERNAL_TRAFFIC_KEY) === "1";
  } catch {
    return value === "1";
  }
}

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function eventId(event: string, email?: string): string {
  const singleton = event === "page_viewed" || event.startsWith("webinar_") || event === "quiz_started" || event === "quiz_completed" || event === "goal_replied" || event === "call_page_view" || event === "call_booking_started";
  if (!singleton) return crypto.randomUUID();
  const pageKey = event === "page_viewed" ? window.location.pathname : "";
  const key = `vance-event:${event}:${pageKey}:${email ?? getVisitorId()}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/**
 * Fire a behaviour event. Safe to call anywhere on the client.
 *
 * `email` is optional and, when supplied, is sent top-level so the event can be
 * attributed to a known lead (this is what powers the funnel's per-person
 * segmentation in src/lib/segments.ts). Funnel pages pass getRememberedLead()?.email.
 */
export function track(event: PublicTrackingEvent, props: EventProps = {}, email?: string): void {
  if (typeof window === "undefined") return;
  if (syncInternalTrafficPreference()) return;

  // 1) Generic dataLayer push — works with GTM and is easy to forward anywhere.
  window.dataLayer = window.dataLayer || [];
  const visitorId = getVisitorId();
  const enrichedProps = {
    ...props,
    visitorId,
    pagePath: `${window.location.pathname}${window.location.search}`.slice(0, 2000),
  };
  window.dataLayer.push({ event, ...enrichedProps });

  // 2) Persist to our own store so the dashboard can report on it.
  //    Fire-and-forget: tracking must never block or break the UI.
  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event,
      eventVersion: EVENT_SCHEMA_VERSION,
      email,
      props: enrichedProps,
      clientEventId: eventId(event, email),
    }),
    keepalive: true,
  }).catch(() => {});

  // TODO: also forward to your pixels/analytics, e.g.:
  // window.gtag?.("event", event, props);
  // window.fbq?.("track", event, props);

  if (process.env.NODE_ENV !== "production") {
    console.debug("[track]", event, props);
  }
}

/**
 * Remember the just-registered lead so later funnel steps (confirmation, room,
 * booking) can attribute their events to the same person. Kept in localStorage
 * because the funnel spans several page loads. Best-effort — never throws.
 */
const LEAD_KEY = "vance-lead";

export function rememberLead(lead: { email: string; name?: string }): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LEAD_KEY, JSON.stringify(lead));
  } catch {
    /* ignore */
  }
}

export function getRememberedLead(): { email: string; name?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LEAD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.email === "string" ? parsed : null;
  } catch {
    return null;
  }
}

/** Read UTM / attribution params from the current URL. */
export function getUtmParams(): Record<string, string> {
  return getAttribution().lastTouch;
}

function currentTouch(): AttributionTouch {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const touch: AttributionTouch = {};
  const allowed = new Set(["ref", "gclid", "fbclid", "msclkid", "ttclid"]);
  for (const [key, value] of params.entries()) {
    if ((key.startsWith("utm_") || allowed.has(key)) && value.length <= 500) {
      touch[key] = value;
    }
  }
  touch.landing_page = `${window.location.pathname}${window.location.search}`.slice(0, 2000);
  if (document.referrer) touch.referrer = document.referrer.slice(0, 2000);
  return touch;
}

export function getAttribution(): { firstTouch: AttributionTouch; lastTouch: AttributionTouch } {
  const lastTouch = currentTouch();
  if (typeof window === "undefined") return { firstTouch: {}, lastTouch };
  try {
    const stored = localStorage.getItem(FIRST_TOUCH_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { firstTouch: parsed as AttributionTouch, lastTouch };
      }
    }
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(lastTouch));
  } catch {
    // Attribution is best-effort; registration must still work without storage.
  }
  return { firstTouch: lastTouch, lastTouch };
}
