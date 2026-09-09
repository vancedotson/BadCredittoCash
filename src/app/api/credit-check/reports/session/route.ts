import { readLimitedJson } from "@/lib/public-api";
import { hasReportSameOrigin, reportJson } from "@/lib/credit-report-http";
import { consumeCreditReportRateLimit, findCreditReportSession, isReportToken, listCreditReports, reportSessionCookie, reportTokenFromRequest } from "@/lib/credit-reports";

export const runtime = "nodejs";

async function sessionResponse(token: string, request: Request, setCookie = false) {
  const session = await findCreditReportSession(token);
  if (!session) return reportJson({ error: "Please complete the 60-second check to open your upload link." }, 401);
  const reports = await listCreditReports(session);
  return reportJson({ ok: true, sessionId: session.id, mode: session.mode, reports, handoffToken: token }, 200,
    setCookie ? { "Set-Cookie": reportSessionCookie(token, request, session.expiresAt) } : {});
}

export async function GET(request: Request) {
  if (!hasReportSameOrigin(request, false)) return reportJson({ error: "Please open this page on our website." }, 403);
  const token = reportTokenFromRequest(request);
  if (!token) return reportJson({ error: "Please complete the 60-second check to open your upload link." }, 401);
  try { return await sessionResponse(token, request); }
  catch { return reportJson({ error: "Your uploads are temporarily unavailable. Please try again." }, 503); }
}

export async function POST(request: Request) {
  if (!hasReportSameOrigin(request)) return reportJson({ error: "Please open this page on our website." }, 403);
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return reportJson({ error: "Invalid upload link." }, 415);
  try {
    if (!await consumeCreditReportRateLimit(request)) return reportJson({ error: "Too many attempts. Please wait and try again." }, 429);
    const parsed = await readLimitedJson<unknown>(request, 1024);
    if (!parsed.ok) return reportJson({ error: "Invalid upload link." }, parsed.status);
    const value = parsed.value as { token?: unknown } | null;
    if (!value || typeof value.token !== "string" || !isReportToken(value.token)) return reportJson({ error: "Invalid or expired upload link. Please complete the 60-second check again." }, 401);
    return await sessionResponse(value.token, request, true);
  } catch { return reportJson({ error: "Your uploads are temporarily unavailable. Please try again." }, 503); }
}
