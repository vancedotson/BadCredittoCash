import { readCreditReportForContact } from "@/lib/credit-reports";
import { isReportId, reportDownloadName, reportError, reportResponseHeaders, requireReportContact } from "../access";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string; reportId: string }> }) {
  try {
    const { id, reportId } = await ctx.params;
    const denied = await requireReportContact(request, id);
    if (denied) return denied;
    if (!isReportId(reportId)) return reportError("Report not found.", 404);
    const report = await readCreditReportForContact(id, reportId);
    if (!report) return reportError("Report not found.", 404);
    return new Response(new Uint8Array(report.bytes).buffer, {
      headers: {
        ...reportResponseHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${reportDownloadName(report.fileName)}"`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch {
    return reportError("This report could not be downloaded. Please try again.", 503);
  }
}
