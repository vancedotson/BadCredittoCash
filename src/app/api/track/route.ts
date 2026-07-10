import { NextResponse } from "next/server";
import { recordEvent } from "@/lib/store";

/**
 * Persists client-side behaviour events into our own store so the dashboard
 * can report on them. Called (fire-and-forget) by track() in src/lib/tracking.ts.
 */
export async function POST(request: Request) {
  let body: { event?: string; email?: string; props?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const event = body.event?.trim();
  if (!event) {
    return NextResponse.json({ error: "Missing event name." }, { status: 400 });
  }

  try {
    await recordEvent({ event, email: body.email, props: body.props });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/track] failed:", err);
    // Behaviour tracking should never block the user — swallow and 200.
    return NextResponse.json({ ok: false });
  }
}
