import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { onBooked } from "@/lib/automations";
import { verifyTurnstile } from "@/lib/turnstile";
import { consumePublicRateLimit, readLimitedJson } from "@/lib/public-api";
import {
  assertGoogleCalendarAvailable,
  attachGoogleEventToBooking,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  listGoogleBusyIntervals,
} from "@/lib/google-calendar";

export async function GET() {
  const from = new Date();
  const to = new Date(from.getTime() + 45 * 24 * 60 * 60 * 1000);
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_booked_slots", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) return NextResponse.json({ error: "Could not load availability." }, { status: 502 });
  let busy;
  try {
    busy = await listGoogleBusyIntervals(from, to);
  } catch (calendarError) {
    console.error("[api/book] Google availability failed", calendarError);
    return NextResponse.json({ error: "Could not load live calendar availability." }, { status: 502 });
  }
  return NextResponse.json(
    { startsAt: (data ?? []).map((row: { starts_at: string }) => row.starts_at), busy },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } },
  );
}

/**
 * Receives a free-strategy-call booking (the funnel's conversion). Records the
 * `call_booked` event against the lead and hands off to the automation map,
 * which stops the pitch sequences and starts onboarding (delivery stubbed).
 *
 * No real calendar yet — this captures the request; a real scheduler / Calendly
 * embed slots in later. Called by BookCallV4.
 */
export async function POST(request: Request) {
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
  };
  const parsed = await readLimitedJson<BookingBody>(request);
  if (!parsed.ok) return NextResponse.json(
    { error: parsed.status === 413 ? "Request is too large." : "Invalid JSON." },
    { status: parsed.status },
  );
  const body = parsed.value;

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
    await assertGoogleCalendarAvailable(startsAt, endsAt);
    const googleEventId = await createGoogleCalendarEvent({
      name,
      email,
      phone: body.phone?.trim() || null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      timezone,
    });
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("book_funnel_call_v2", {
      p_name: name,
      p_email: email,
      p_phone: body.phone?.trim() || null,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
      p_timezone: timezone,
      p_intake_answers: body.answers && typeof body.answers === "object" ? body.answers : {},
      p_utm: body.utm && typeof body.utm === "object" ? body.utm : {},
      p_visitor_id: body.visitorId?.trim() || null,
    });
    if (error || !data) {
      await deleteGoogleCalendarEvent(googleEventId).catch((cleanupError) =>
        console.error("[api/book] orphaned Google event cleanup failed", cleanupError));
      if (error?.code === "23505") return NextResponse.json({ error: "That time was just booked. Please choose another slot." }, { status: 409 });
      throw new Error(error?.message ?? "Could not save booking.");
    }

    const booking = (Array.isArray(data) ? data[0] : data) as { id?: string };
    if (!booking?.id) throw new Error("Booking ID was not returned.");
    await attachGoogleEventToBooking(booking.id, googleEventId);
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
    console.error("[api/book] failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
}
