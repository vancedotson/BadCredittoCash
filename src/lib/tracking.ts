/**
 * Client-side behaviour tracking layer.
 *
 * The single seam for tracking what visitors do on the funnel (page views,
 * CTA clicks, registrations). Right now it pushes to window.dataLayer and
 * logs — swap the body of `track()` for your analytics/pixels when you pick
 * them (GA4, Meta Pixel, TikTok, PostHog, Segment, etc.). Everything else in
 * the app calls `track()` and doesn't care what's underneath.
 */

type EventProps = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/** Fire a behaviour event. Safe to call anywhere on the client. */
export function track(event: string, props: EventProps = {}): void {
  if (typeof window === "undefined") return;

  // 1) Generic dataLayer push — works with GTM and is easy to forward anywhere.
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...props });

  // 2) Persist to our own store so the dashboard can report on it.
  //    Fire-and-forget: tracking must never block or break the UI.
  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, props }),
    keepalive: true,
  }).catch(() => {});

  // TODO: also forward to your pixels/analytics, e.g.:
  // window.gtag?.("event", event, props);
  // window.fbq?.("track", event, props);

  if (process.env.NODE_ENV !== "production") {
    console.debug("[track]", event, props);
  }
}

/** Read UTM / attribution params from the current URL. */
export function getUtmParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (key.startsWith("utm_") || key === "ref" || key === "gclid") {
      utm[key] = value;
    }
  }
  return utm;
}
