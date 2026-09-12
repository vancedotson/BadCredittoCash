"use client";

import type { LiveActivityEvent } from "./live-webinar-types";

/** Acknowledged session activity; question content never enters the analytics dataLayer. */
export async function trackLiveEvent(
  event: LiveActivityEvent,
  sessionId: string,
  props: Record<string, unknown> = {},
  submissionId?: string,
): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("preview") === "1" || params.has("state") || params.get("internal") === "1") return false;
  let clientEventId = submissionId;
  if (!clientEventId) {
    if (event === "live_presence" || event === "live_question_asked") clientEventId = crypto.randomUUID();
    else {
      const key = `vance-live-event:${sessionId}:${event}`;
      try {
        clientEventId = sessionStorage.getItem(key) ?? crypto.randomUUID();
        sessionStorage.setItem(key, clientEventId);
      } catch { clientEventId = crypto.randomUUID(); }
    }
  }
  try {
    const response = await fetch("/api/live/activity", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, event, clientEventId, props }), keepalive: true,
    });
    const result = await response.json() as { ok?: boolean };
    return response.ok && result.ok === true;
  } catch { return false; }
}
