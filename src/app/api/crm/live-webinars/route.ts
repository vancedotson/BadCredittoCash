import { NextResponse } from "next/server";
import { requireCrmApiUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLiveWebinarSessions, getLiveWebinarSessionReport, mapLiveSession, liveWebinarsEnabled } from "@/lib/live-webinars";
import { validateLiveSessionInput } from "@/lib/live-webinar-validation";
import { isUuid } from "@/lib/live-webinar-types";
import { readLimitedJson } from "@/lib/public-api";
import { recordAdminAudit } from "@/lib/audit";
import { isCrmDemoMode } from "@/lib/demo";

export async function GET(request: Request) {
  const auth = await requireCrmApiUser();
  if (auth.response) return auth.response;
  try {
    const id = new URL(request.url).searchParams.get("sessionId");
    if (id) {
      if (!isUuid(id)) return crmJson({ error: "Invalid session." }, { status: 400 });
      const report = await getLiveWebinarSessionReport(id);
      return report ? crmJson(report) : crmJson({ error: "Session not found." }, { status: 404 });
    }
    return crmJson({ sessions: await getLiveWebinarSessions(), enabled: liveWebinarsEnabled() });
  } catch {
    return crmJson({ error: "Could not load webinars. Check the database migration and try again." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await requireCrmApiUser(request, "write");
  if (auth.response) return auth.response;
  if (isCrmDemoMode()) return crmJson({ error: "Session changes are disabled in the design preview." }, { status: 409 });
  const parsed = await readLimitedJson<{ session?: unknown }>(request);
  if (!parsed.ok) return crmJson({ error: "Invalid session details." }, { status: parsed.status });
  const validation = validateLiveSessionInput(parsed.value && typeof parsed.value === "object" ? parsed.value.session : null);
  if (!validation.session) return crmJson({ error: validation.error }, { status: 400 });
  const session = validation.session;
  try {
    const db = await createClient();
    const values = { slug: session.slug, title: session.title, starts_at: session.startsAt, ends_at: session.endsAt,
      timezone: session.timezone, status: session.status, embed_url: session.embedUrl, replay_url: session.replayUrl,
      replay_published: session.replayPublished, replay_available_until: session.replayAvailableUntil, automation_enabled: session.automationEnabled };
    const { data, error } = session.id
      ? await db.from("live_webinar_sessions").update(values).eq("id", session.id).select("*").single()
      : await db.from("live_webinar_sessions").insert(values).select("*").single();
    if (error || !data) return crmJson({ error: error?.code === "23505" ? "That session slug is already in use." : "Could not save this session." }, { status: 409 });
    await recordAdminAudit({ actorId: String(auth.user.sub), action: session.id ? "live_webinar.updated" : "live_webinar.created", entityType: "live_webinar_session", entityId: data.id, afterState: values });
    return crmJson({ session: mapLiveSession(data) });
  } catch {
    return crmJson({ error: "Could not save the session. Reload the session list before retrying." }, { status: 503 });
  }
}

function crmJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Vary", "Cookie");
  return NextResponse.json(body, { ...init, headers });
}
