import { NextResponse } from "next/server";
import { consumePublicRateLimit, readLimitedJson } from "@/lib/public-api";
import { getPublicLiveWebinarSession, liveWebinarsEnabled, resolveLiveParticipant } from "@/lib/live-webinars";
import { isLiveActivityEvent, isUuid } from "@/lib/live-webinar-types";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLivePreviewRequest } from "@/lib/live-webinar-validation";

export async function POST(request: Request) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  if (!liveWebinarsEnabled()) return json({ ok: false, error: "Live session tracking is not enabled." }, 503);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ ok: false, error: "Cross-site request rejected." }, 403);
  const parsed = await readLimitedJson<Record<string, unknown>>(request);
  if (!parsed.ok) return json({ ok: false, error: "Invalid activity request." }, parsed.status);
  const body = parsed.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "Invalid activity request." }, 400);
  if (isLivePreviewRequest(request, body)) return json({ ok: false, error: "Preview submissions are disabled." }, 409);
  if (!isUuid(body.sessionId) || !isLiveActivityEvent(body.event) || typeof body.clientEventId !== "string" || !/^[a-zA-Z0-9_-]{8,160}$/.test(body.clientEventId)) return json({ ok: false, error: "Invalid session activity." }, 400);
  const props = body.props && typeof body.props === "object" && !Array.isArray(body.props) ? body.props as Record<string, unknown> : {};
  if (props.preview === true) return json({ ok: false, error: "Preview submissions are disabled." }, 400);
  const question = typeof props.question === "string" ? props.question.trim() : "";
  if (body.event === "live_question_asked" && (question.length < 2 || question.length > 1000)) return json({ ok: false, error: "Enter a question between 2 and 1,000 characters." }, 400);
  try {
    if (!await consumePublicRateLimit(request, body.event === "live_question_asked" ? "live-question" : "live-activity", body.event === "live_question_asked" ? 12 : 90, 60)) return json({ ok: false, error: "Please wait a moment before trying again." }, 429);
    const session = await getPublicLiveWebinarSession(body.sessionId);
    if (!session || session.status !== "scheduled") return json({ ok: false, error: "This live session is not available." }, 409);
    const participant = await resolveLiveParticipant(session.id);
    if (!participant) return json({ ok: false, error: "Open the joining link in your registration email to connect your activity." }, 401);
    const { data, error } = await createAdminClient().rpc("update_live_webinar_activity_v1", {
      p_registration_id: participant.registrationId, p_session_id: session.id, p_access_version: participant.accessVersion,
      p_event_key: body.event, p_client_event_id: body.clientEventId,
      p_properties: { ...(body.event === "live_question_asked" ? { question } : {}), funnel: "live", sessionId: session.id, sessionTitle: session.title },
    });
    if (error || !data) return json({ ok: false, error: "We couldn't save that activity. Please try again." }, 502);
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "We couldn't save that activity. Please try again." }, 503);
  }
}
