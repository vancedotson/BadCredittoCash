import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { onBooked } from "@/lib/automations";
import { verifyTurnstile } from "@/lib/turnstile";
import { consumePublicRateLimit, readLimitedJson } from "@/lib/public-api";
import { getPublicLiveWebinarSession, resolveLiveParticipant } from "@/lib/live-webinars";
import { isUuid } from "@/lib/live-webinar-types";
import { isLivePreviewRequest } from "@/lib/live-webinar-validation";
import {
  assertGoogleCalendarAvailable,
  attachGoogleEventToBooking,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleBusyIntervals,
} from "@/lib/google-calendar";
import { GoogleCalendarConflictError } from "@/lib/google-calendar";
import { emailModeUnavailableResponse, isProductionEmailMode } from "@/lib/email-mode";
import { isBookingEmailConfigurationReady } from "@/lib/email-configuration";

async function recordCalendarSyncWarning(email: string, reason: string) {
  try {
    const { error } = await createAdminClient().rpc("record_funnel_event", {
      p_event_key: "funnel_error", p_email: email,
      p_properties: { action: "booking", reason, source: "google_calendar_sync" }, p_client_event_id: null,
    });
    if (error) console.error("[api/book] calendar warning recording failed", { reason: error.message });
  } catch (error) {
    console.error("[api/book] calendar warning recording failed", { reason: error instanceof Error ? error.message : "unknown_error" });
  }
}

export async function GET() {
  const from = new Date();
  const to = new Date(from.getTime() + 45 * 24 * 60 * 60 * 1000);
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_booked_slots", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) return NextResponse.json({ error: "Could not load availability." }, { status: 502 });
  let busy: Awaited<ReturnType<typeof listGoogleBusyIntervals>> = [];
  let calendarStatus: "connected" | "unavailable" = "connected";
  try {
    busy = await listGoogleBusyIntervals(from, to);
  } catch (calendarError) {
    calendarStatus = "unavailable";
    console.error("[api/book] Google availability unavailable", {
      reason: calendarError instanceof Error ? calendarError.message : "unknown_error",
    });
  }
  return NextResponse.json(
    { startsAt: (data ?? []).map((row: { starts_at: string }) => row.starts_at), busy, calendarStatus },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } },
  );
}

/**
 * Receives a free-strategy-call booking (the funnel's conversion). Records the
 * `call_booked` event against the lead and hands off to the automation map,
 * which stops the pitch sequences and starts onboarding (delivery stubbed).
 *
 * Supabase owns the booking reservation. Google Calendar is an optional
 * synchronization adapter when it is connected and responding.
 */
export async function POST(request: Request) {
  if (!isProductionEmailMode() || !isBookingEmailConfigurationReady()) return emailModeUnavailableResponse();

  type BookingBody = {
    name?: string;
    email?: string;
    phone?: string;
    preferredTime?: string;
    startsAt?: string;
    endsAt?: string;
    timezone?: string;
    visitorId?: string;
    answers?: Record<string, string>;
    utm?: Record<string, string>;
    turnstileToken?: string;
    funnel?: "live";
    sessionId?: string;
  };
  const parsed = await readLimitedJson<BookingBody>(request);
  if (!parsed.ok) return NextResponse.json(
    { error: parsed.status === 413 ? "Request is too large." : "Invalid JSON." },
    { status: parsed.status },
  );
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
  if (isLivePreviewRequest(request, body)) return NextResponse.json({ error: "Booking is disabled in preview." }, { status: 409 });
  if (body.sessionId !== undefined) body.funnel = "live";
  if (body.sessionId !== undefined && !isUuid(body.sessionId)) return NextResponse.json({ error: "Invalid webinar session." }, { status: 400 });
  let liveSessionId: string | null = null;
  let liveRegistrationId: string | null = null;
  if (body.funnel === "live" && body.sessionId) {
    try {
      const session = await getPublicLiveWebinarSession(body.sessionId);
      if (!session) return NextResponse.json({ error: "This webinar session is not available. Please reload the booking page." }, { status: 409 });
      liveSessionId = session.id;
      const participant = await resolveLiveParticipant(session.id);
      liveRegistrationId = participant && typeof body.email === "string" && participant.email.toLowerCase() === body.email.trim().toLowerCase()
        ? participant.registrationId : null;
    } catch { return NextResponse.json({ error: "Could not verify the webinar session. Please try again." }, { status: 503 }); }
  }

  try {
    if (!await consumePublicRateLimit(request, "booking", 10, 600)) {
      return NextResponse.json({ error: "Too many attempts. Please wait and try again." }, { status: 429 });
    }
  } catch (error) {
    console.error("[api/book] rate limit failed:", error);
    return NextResponse.json({ error: "Please try again in a moment." }, { status: 503 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const startsAt = body.startsAt ? new Date(body.startsAt) : null;
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  const timezone = body.timezone?.trim();
  if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { error: "A valid name and email are required." },
      { status: 400 },
    );
  }
  if (!startsAt || !endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || !timezone) {
    return NextResponse.json({ error: "Please select a valid appointment time." }, { status: 400 });
  }
  if (!await verifyTurnstile(request, body.turnstileToken)) {
    return NextResponse.json({ error: "Please complete the security check and try again." }, { status: 403 });
  }

  try {
    let googleConnected = false;
    try {
      await assertGoogleCalendarAvailable(startsAt, endsAt);
      googleConnected = true;
    } catch (calendarError) {
      if (calendarError instanceof GoogleCalendarConflictError) throw calendarError;
      console.error("[api/book] Google synchronization unavailable", { reason: calendarError instanceof Error ? calendarError.message : "unknown_error" });
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc(body.funnel === "live" ? "book_live_funnel_call_v1" : "book_funnel_call_v2", {
      p_name: name,
      p_email: email,
      p_phone: body.phone?.trim() || null,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
      p_timezone: timezone,
      p_intake_answers: body.answers && typeof body.answers === "object" ? body.answers : {},
      p_utm: body.utm && typeof body.utm === "object" ? body.utm : {},
      p_visitor_id: body.visitorId?.trim() || null,
      ...(body.funnel === "live" ? { p_session_id: liveSessionId, p_registration_id: liveRegistrationId } : {}),
    });
    if (error || !data) {
      if (error?.code === "23505") return NextResponse.json({ error: "That time was just booked. Please choose another slot." }, { status: 409 });
      throw new Error(error?.message ?? "Could not save booking.");
    }

    const booking = (Array.isArray(data) ? data[0] : data) as { id?: string };
    if (!booking?.id) throw new Error("Booking ID was not returned.");
    if (googleConnected) {
      let googleEventId: string | null = null;
      try {
        googleEventId = await createGoogleCalendarEvent({ name, email, phone: body.phone?.trim() || null, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), timezone });
        await attachGoogleEventToBooking(booking.id, googleEventId);
      } catch (calendarError) {
        console.error("[api/book] Google synchronization failed after booking", { reason: calendarError instanceof Error ? calendarError.message : "unknown_error" });
        if (googleEventId) {
          await deleteGoogleCalendarEvent(googleEventId).catch(async (cleanupError) => {
            console.error("[api/book] orphaned Google event cleanup failed", { reason: cleanupError instanceof Error ? cleanupError.message : "unknown_error" });
            await recordCalendarSyncWarning(email, "google_event_cleanup_failed");
          });
        } else await recordCalendarSyncWarning(email, "google_event_create_or_attach_failed");
      }
    }
    await onBooked(email, startsAt, timezone, booking.id);

    return NextResponse.json({
      ok: true,
      booking: {
        id: booking.id,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        timezone,
      },
    });
  } catch (err) {
    if (err instanceof GoogleCalendarConflictError) return NextResponse.json({ error: err.message }, { status: 409 });
    console.error("[api/book] failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
}
