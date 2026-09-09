import { NextResponse } from "next/server";
import { consumePublicRateLimit, readLimitedJson } from "@/lib/public-api";
import { verifyTurnstile } from "@/lib/turnstile";
import { validateCreditCheckSubmission } from "@/lib/credit-check-validation";
import { issueCreditReportSession, reportSessionCookie } from "@/lib/credit-reports";
import {
  consumeLocalCreditCheckRateLimit,
  hasCreditCheckDatabaseConfig,
  isCreditCheckLocalMode,
  saveCreditCheckSubmission,
} from "@/lib/credit-check";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host");
  if (!host) return origin === requestUrl.origin;
  // Next may construct Request.url with its internal localhost hostname. The
  // browser's actual authority is in Host; never substitute forwarded-host.
  if (/[\s/\\?#@]/.test(host)) return false;
  try {
    return origin === new URL(`${requestUrl.protocol}//${host}`).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return json({ error: "Please submit the form as JSON." }, 415);
  }
  if (!hasSameOrigin(request)) {
    return json({ error: "Please submit the form from this website." }, 403);
  }

  let parsed;
  try {
    parsed = await readLimitedJson<unknown>(request, 16384);
  } catch {
    return json({ error: "Could not read the submission. Please try again." }, 400);
  }
  if (!parsed.ok) return json({ error: parsed.status === 413 ? "Request is too large." : "Invalid JSON." }, parsed.status);
  const validation = validateCreditCheckSubmission(parsed.value);
  if (!validation.ok) return json({ error: validation.error, fieldErrors: validation.fieldErrors }, 400);

  const localMode = isCreditCheckLocalMode();
  if (!localMode && (!hasCreditCheckDatabaseConfig()
    || !process.env.TURNSTILE_SECRET || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)) {
    return json({ error: "The form is temporarily unavailable. Please try again later." }, 503);
  }

  try {
    const allowed = localMode
      ? consumeLocalCreditCheckRateLimit(request)
      : await consumePublicRateLimit(request, "registration", 10, 600);
    if (!allowed) return json({ error: "Too many attempts. Please wait and try again." }, 429);
  } catch {
    console.error("[api/credit-check] rate limit unavailable");
    return json({ error: "Please try again in a moment." }, 503);
  }

  if (!localMode && !await verifyTurnstile(request, validation.value.turnstileToken)) {
    return json({ error: "Please complete the security check and try again." }, 403);
  }

  try {
    const saved = await saveCreditCheckSubmission(validation.value);
    const session = await issueCreditReportSession(saved);
    const response = json({ ok: true, ...saved });
    response.headers.set("Set-Cookie", reportSessionCookie(session.token, request, session.expiresAt));
    return response;
  } catch {
    console.error("[api/credit-check] submission could not be saved");
    return json({ error: "We couldn't save your answers. Please try again." }, 502);
  }
}
