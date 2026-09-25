import { requireCrmApiUser } from "@/lib/auth";
import { recordAdminAudit } from "@/lib/audit";
import { prepareCloudflareLiveInput } from "@/lib/cloudflare-stream";
import { isCrmDemoMode } from "@/lib/demo";
import { isUuid } from "@/lib/live-webinar-types";
import { createClient } from "@/lib/supabase/server";

const privateHeaders = { "cache-control": "private, no-store", vary: "Cookie" };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCrmApiUser(request, "admin-write");
  if (auth.response) return auth.response;
  if (isCrmDemoMode()) return Response.json({ error: "Live broadcasting is unavailable in demonstration mode." }, { status: 409 });
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "Invalid webinar session." }, { status: 400 });

  const db = await createClient();
  const { data: session, error } = await db.from("live_webinar_sessions")
    .select("id,title,cloudflare_live_input_id").eq("id", id).maybeSingle();
  if (error) return Response.json({ error: "The webinar session could not be loaded." }, { status: 500 });
  if (!session) return Response.json({ error: "Webinar session not found." }, { status: 404 });

  try {
    const stream = await prepareCloudflareLiveInput({
      sessionId: id,
      title: session.title,
      liveInputId: session.cloudflare_live_input_id,
    });
    const { error: updateError } = await db.from("live_webinar_sessions").update({
      stream_provider: "cloudflare",
      cloudflare_live_input_id: stream.liveInputId,
      embed_url: stream.embedUrl,
    }).eq("id", id);
    if (updateError) return Response.json({ error: "The broadcast could not be linked to this webinar." }, { status: 500 });
    await recordAdminAudit({
      actorId: String(auth.user.sub),
      action: "live_webinar.stream_prepared",
      entityType: "live_webinar_session",
      entityId: id,
      afterState: { provider: "cloudflare", liveInputId: stream.liveInputId },
    });
    return Response.json(stream, { headers: privateHeaders });
  } catch (cause) {
    const message = cause instanceof Error && cause.message === "Cloudflare Stream is not configured yet."
      ? cause.message
      : "The live broadcast could not be prepared.";
    return Response.json({ error: message }, { status: 503, headers: privateHeaders });
  }
}
