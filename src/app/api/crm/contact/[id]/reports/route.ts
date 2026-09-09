import { NextResponse } from "next/server";
import { listCreditReportsForContact } from "@/lib/credit-reports";
import { reportError, reportResponseHeaders, requireReportContact } from "./access";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const denied = await requireReportContact(request, id);
    if (denied) return denied;
    const reports = (await listCreditReportsForContact(id)).map(({ id, submissionId, bureau, fileName, uploadedAt, byteSize }) => ({
      id, submissionId, bureau, fileName, uploadedAt, byteSize,
    }));
    return NextResponse.json({ reports }, { headers: reportResponseHeaders });
  } catch {
    return reportError("Reports could not be loaded. Please try again.", 503);
  }
}
