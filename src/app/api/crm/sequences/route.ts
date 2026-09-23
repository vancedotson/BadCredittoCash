import { NextResponse } from "next/server";
import { requireCrmApiUser } from "@/lib/auth";
import { retryFailedSequenceMessage } from "@/lib/email";
import { setSequenceEnrollmentStatus } from "@/lib/store";
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
    const result = await retryFailedSequenceMessage(messageId);
    if (!result) return NextResponse.json({ error: "Failed message was not found or already retried." }, { status: 404 });
    const policyCancelled = result === "cancelled";
    await recordAdminAudit({
      actorId: String(auth.user.sub),
      action: policyCancelled ? "sequence.retry_blocked_by_policy" : "sequence.retry",
      entityType: "scheduled_message",
      entityId: messageId,
      afterState: policyCancelled ? { status: "cancelled", reason: "outbound_email_policy" } : { status: "scheduled", attempts: 0 },
    });
    return NextResponse.json({ ok: true, status: result });
  }

  return NextResponse.json({ error: "Unknown sequence action." }, { status: 400 });
}
