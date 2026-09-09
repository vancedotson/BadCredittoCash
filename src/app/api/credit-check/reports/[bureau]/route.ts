import { hasReportSameOrigin, reportJson } from "@/lib/credit-report-http";
import { decodeReportFileName, isCreditReportBureau, isPdfFile, readReportBody } from "@/lib/credit-report-validation";
import { consumeCreditReportRateLimit, findCreditReportSession, reportTokenFromRequest, saveCreditReport } from "@/lib/credit-reports";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ bureau: string }> }) {
  if (!hasReportSameOrigin(request)) return reportJson({ error: "Please upload from this website." }, 403);
  const { bureau } = await params;
  if (!isCreditReportBureau(bureau)) return reportJson({ error: "Choose TransUnion, Equifax, or Experian." }, 400);
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/pdf") return reportJson({ error: "Choose a PDF report." }, 415);
  const fileName = decodeReportFileName(request.headers.get("x-report-filename"));
  if (!fileName) return reportJson({ error: "Choose a PDF with a valid filename (up to 180 characters)." }, 400);
  const token = reportTokenFromRequest(request);
  if (!token) return reportJson({ error: "Your upload link has expired. Please complete the 60-second check again." }, 401);
  try {
    const session = await findCreditReportSession(token);
    if (!session) return reportJson({ error: "Your upload link has expired. Please complete the 60-second check again." }, 401);
    if (request.headers.get("x-report-session") !== session.id) return reportJson({ error: "Your upload session changed. Refresh this page before sending any reports." }, 409);
    if (!await consumeCreditReportRateLimit(request, session.tokenHash)) return reportJson({ error: "Too many attempts. Please wait and try again." }, 429);
    let parsed;
    try { parsed = await readReportBody(request); }
    catch { return reportJson({ error: "The upload was interrupted. Please try again." }, 400); }
    if (!parsed.ok) return reportJson({ error: parsed.status === 413 ? "This PDF is too large. Choose a file under 15 MB." : "Choose your saved PDF report." }, parsed.status);
    if (!isPdfFile(parsed.bytes)) return reportJson({ error: "This file is not a complete PDF. Save your report as a PDF and try again." }, 400);
    const report = await saveCreditReport(session, bureau, fileName, parsed.bytes);
    return reportJson({ ok: true, mode: session.mode, report });
  } catch {
    console.error("[api/credit-check/reports] report upload could not be confirmed");
    return reportJson({ error: "We couldn't confirm this upload. Please try again. Your other saved reports are still safe." }, 503);
  }
}
