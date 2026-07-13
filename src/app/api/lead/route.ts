import { NextResponse } from "next/server";
import { createLead, recordEvent, type Lead } from "@/lib/store";
import { EVENTS } from "@/lib/events";
import { enrollNewRegistration } from "@/lib/automations";

/**
 * Receives webinar registrations and saves them to our own data store
 * (in-memory today, Supabase later — see src/lib/store.ts).
 * Called by the registration form (src/components/marketing/RegistrationForm.tsx).
 */
export async function POST(request: Request) {
  let body: Partial<Lead>;
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
    const lead = await createLead({
      name,
      email,
      phone: body.phone?.trim() || undefined,
      source: body.source || "vance-webinar",
      utm: body.utm,
    });

    await recordEvent({
      event: EVENTS.registered,
      email: lead.email,
      props: { source: lead.source },
    });

    // Enter the pre-webinar (get-them-to-watch) sequence. Stubbed delivery.
    await enrollNewRegistration(lead.email);

    return NextResponse.json({ ok: true, id: lead.id });
  } catch (err) {
    console.error("[api/lead] failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }
}
