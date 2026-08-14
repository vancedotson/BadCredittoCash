import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/store";
import { routeBySegment } from "@/lib/automations";
import {
  EVENT_REQUIRED_PROPERTIES,
  EVENT_SCHEMA_VERSION,
  EVENTS,
  WATCH_EVENT_PERCENT,
  isPublicTrackingEvent,
} from "@/lib/events";
import type { Segment } from "@/lib/segments";
import { consumePublicRateLimit, readLimitedJson } from "@/lib/public-api";

const SEGMENT_EVENT: Partial<Record<string, Segment>> = {
  [EVENTS.roomOpened]: "low_watch",
  [EVENTS.watch25]: "low_watch",
  [EVENTS.watch50]: "mid_watch",
  [EVENTS.watch75]: "high_watch",
  [EVENTS.watch90]: "high_watch",
  [EVENTS.completed]: "high_watch",
  [EVENTS.offerCtaClicked]: "offer_click_no_book",
  [EVENTS.bookingStarted]: "booking_abandon",
  [EVENTS.bookingAbandoned]: "booking_abandon",
};

const BOT_USER_AGENT = /\b(bot|crawler|spider|slurp|headlesschrome|lighthouse|pagespeed|pingdom|uptimerobot|curl|wget|python-requests)\b/i;

function isObviousBot(request: Request): boolean {
  const userAgent = request.headers.get("user-agent")?.trim();
  return !userAgent || BOT_USER_AGENT.test(userAgent);
}

/**
 * Persists client-side behaviour events into our own store so the dashboard
 * can report on them. Called (fire-and-forget) by track() in src/lib/tracking.ts.
 */
export async function POST(request: Request) {
  if (isObviousBot(request)) {
    return NextResponse.json({ ok: true, filtered: "bot" }, { status: 202 });
  }
  type TrackingRequest = {
    event?: string;
    eventVersion?: number;
    email?: string;
    props?: Record<string, unknown>;
    clientEventId?: string;
  };
  const parsed = await readLimitedJson<TrackingRequest>(request);
  if (!parsed.ok) return NextResponse.json({ ok: false }, { status: parsed.status });
  const body = parsed.value;

  try {
    if (!await consumePublicRateLimit(request, "tracking", 180, 60)) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }
  } catch (error) {
    console.error("[api/track] rate limit failed:", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const event = body.event?.trim();
  if (!isPublicTrackingEvent(event)) {
    return NextResponse.json({ error: "Unsupported event name." }, { status: 400 });
  }
  if (body.eventVersion !== EVENT_SCHEMA_VERSION) {
    return NextResponse.json({ error: "Unsupported event version." }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (email && (email.length > 320 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))) {
    return NextResponse.json({ error: "Invalid email identity." }, { status: 400 });
  }
  if (!body.clientEventId || body.clientEventId.length > 160 || !/^[A-Za-z0-9_-]+$/.test(body.clientEventId)) {
    return NextResponse.json({ error: "Invalid event ID." }, { status: 400 });
  }
  const props = body.props;
  if (!props || typeof props !== "object" || Array.isArray(props)) {
    return NextResponse.json({ error: "Invalid event properties." }, { status: 400 });
  }
  const visitorId = props.visitorId;
  if (typeof visitorId !== "string" || visitorId.length < 8 || visitorId.length > 160) {
    return NextResponse.json({ error: "Invalid visitor identity." }, { status: 400 });
  }
  if (JSON.stringify(props).length > 8_192) {
    return NextResponse.json({ error: "Event properties are too large." }, { status: 413 });
  }
  for (const key of EVENT_REQUIRED_PROPERTIES[event] ?? []) {
    if (!(key in props)) return NextResponse.json({ error: `Missing required property: ${key}.` }, { status: 400 });
  }
  const expectedPct = WATCH_EVENT_PERCENT[event];
  if (expectedPct !== undefined && props.pct !== expectedPct) {
    return NextResponse.json({ error: "Invalid watch milestone." }, { status: 400 });
  }

  try {
    await recordEvent({
      event,
      email,
      props: { ...props, eventVersion: EVENT_SCHEMA_VERSION },
      clientEventId: body.clientEventId,
    });
    const segment = SEGMENT_EVENT[event];
    if (segment && email) await routeBySegment(email, segment);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/track] failed:", err);
    // Behaviour tracking should never block the user — swallow and 200.
    return NextResponse.json({ ok: false });
  }
}
