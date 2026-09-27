import { NextResponse } from "next/server";

import { requireCrmApiUser } from "@/lib/auth";
import { readLimitedJson } from "@/lib/public-api";
import {
  assignCreditReportFollowup,
  getCreditReportFollowups,
  recordCreditReportFollowupContact,
} from "@/lib/credit-report-followups";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHANNELS = ["phone", "email", "other"] as const;
const OUTCOMES = ["reached", "no_answer", "left_message", "other"] as const;

function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: NO_STORE }); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return null;
  const parsed = await readLimitedJson<unknown>(request, 2048);
  return parsed.ok && isRecord(parsed.value) ? parsed.value : null;
}

export async function GET(request: Request) {
  const auth = await requireCrmApiUser(request, "read");
  if (auth.response) return json({ error: "CRM access required." }, auth.response.status);
  try { return json(await getCreditReportFollowups()); }
  catch { return json({ error: "The private follow-up queue is temporarily unavailable." }, 503); }
}

export async function PATCH(request: Request) {
  const auth = await requireCrmApiUser(request, "write");
  if (auth.response) return json({ error: "CRM write access required." }, auth.response.status);
  const body = await parseBody(request);
  if (!body || typeof body.id !== "string" || !UUID.test(body.id)
    || !(body.assigneeId === null || (typeof body.assigneeId === "string" && UUID.test(body.assigneeId)))) {
    return json({ error: "A follow-up and valid assignee are required." }, 400);
  }
  try {
    await assignCreditReportFollowup(body.id, body.assigneeId, String(auth.user?.sub ?? ""));
    return json({ ok: true });
  } catch { return json({ error: "The follow-up assignment could not be saved." }, 409); }
}

export async function POST(request: Request) {
  const auth = await requireCrmApiUser(request, "write");
  if (auth.response) return json({ error: "CRM write access required." }, auth.response.status);
  const body = await parseBody(request);
  if (!body || typeof body.id !== "string" || !UUID.test(body.id)
    || typeof body.contactedAt !== "string" || !Number.isFinite(Date.parse(body.contactedAt))
    || typeof body.channel !== "string" || !(CHANNELS as readonly string[]).includes(body.channel)
    || typeof body.outcome !== "string" || !(OUTCOMES as readonly string[]).includes(body.outcome)) {
    return json({ error: "A valid contact time, channel, and outcome are required." }, 400);
  }
  try {
    await recordCreditReportFollowupContact({
      obligationId: body.id,
      actorId: String(auth.user?.sub ?? ""),
      contactedAt: new Date(body.contactedAt).toISOString(),
      channel: body.channel as (typeof CHANNELS)[number],
      outcome: body.outcome as (typeof OUTCOMES)[number],
    });
    return json({ ok: true });
  } catch { return json({ error: "The contact outcome could not be recorded." }, 409); }
}
