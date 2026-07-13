import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/store";
import { EVENTS } from "@/lib/events";
import { onBooked } from "@/lib/automations";

/**
 * Receives a free-strategy-call booking (the funnel's conversion). Records the
 * `call_booked` event against the lead and hands off to the automation map,
 * which stops the pitch sequences and starts onboarding (delivery stubbed).
 *
 * No real calendar yet — this captures the request; a real scheduler / Calendly
 * embed slots in later. Called by BookCallV4.
 */
export async function POST(request: Request) {
  let body: {
    name?: string;
    email?: string;
    phone?: string;
    preferredTime?: string;
    utm?: Record<string, string>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { error: "A valid name and email are required." },
      { status: 400 },
    );
  }

  try {
    await recordEvent({
      event: EVENTS.booked,
      email,
      props: {
        name,
        phone: body.phone?.trim() || undefined,
        preferredTime: body.preferredTime?.trim() || undefined,
        utm: body.utm,
      },
    });

    await onBooked(email);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/book] failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
}
