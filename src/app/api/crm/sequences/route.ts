import { NextResponse } from "next/server";
import { requireCrmApiUser } from "@/lib/auth";
import { retryFailedSequenceMessage, setSequenceEnrollmentStatus } from "@/lib/store";
import { recordAdminAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const auth = await requireCrmApiUser(request, "write");
  if (auth.response) return auth.response;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "pause" || action === "resume") {
    const enrollmentId = typeof body.enrollmentId === "string" ? body.enrollmentId : "";
    if (!enrollmentId) return NextResponse.json({ error: "Enrollment is required." }, { status: 400 });
    const status = action === "pause" ? "paused" as const : "active" as const;
    const changed = await setSequenceEnrollmentStatus(enrollmentId, status);
    if (!changed) return NextResponse.json({ error: "Enrollment was not found or already changed." }, { status: 404 });
    await recordAdminAudit({ actorId: String(auth.user.sub), action: `sequence.${action}`, entityType: "sequence_enrollment", entityId: enrollmentId, afterState: { status } });
    return NextResponse.json({ ok: true, status });
  }

  if (action === "retry") {
    const messageId = typeof body.messageId === "string" ? body.messageId : "";
    if (!messageId) return NextResponse.json({ error: "Failed message is required." }, { status: 400 });
    const changed = await retryFailedSequenceMessage(messageId);
    if (!changed) return NextResponse.json({ error: "Failed message was not found or already retried." }, { status: 404 });
    await recordAdminAudit({ actorId: String(auth.user.sub), action: "sequence.retry", entityType: "scheduled_message", entityId: messageId, afterState: { status: "scheduled", attempts: 0 } });
    return NextResponse.json({ ok: true, status: "scheduled" });
  }

  return NextResponse.json({ error: "Unknown sequence action." }, { status: 400 });
}
