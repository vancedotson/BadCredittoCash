import { NextResponse } from "next/server";
import { cancelBooking, rescheduleBooking } from "@/lib/store";
import { processDueEmails } from "@/lib/email";
import { requireCrmApiUser } from "@/lib/auth";

export async function PATCH(request: Request) {
  const auth = await requireCrmApiUser(request, "write");
  if (auth.response) return auth.response;
  let body: { id?: string; startsAt?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!body.id || !body.startsAt) return NextResponse.json({ error: "id and startsAt are required." }, { status: 400 });
  try {
    await rescheduleBooking(body.id, body.startsAt);
    try { await processDueEmails(10); } catch (error) { console.error("[crm/booking] reschedule saved; notification remains queued", error); }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") return NextResponse.json({ error: "That time is already booked." }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not reschedule booking." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireCrmApiUser(request, "write");
  if (auth.response) return auth.response;
  let body: { id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  try {
    await cancelBooking(body.id);
    try { await processDueEmails(10); } catch (error) { console.error("[crm/booking] cancellation saved; notification remains queued", error); }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not cancel booking." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
