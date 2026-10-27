import { NextResponse } from "next/server";
import { hasReportSameOrigin } from "@/lib/credit-report-http";
import {
  CREDIT_REPORT_WEBINAR_COOKIE,
  findCompletedCreditReportSession,
  reportTokenFromRequest,
} from "@/lib/credit-reports";
import { addTagToContact } from "@/lib/store";

export const runtime = "nodejs";

const ACCESS_SECONDS = 48 * 60 * 60;

export async function POST(request: Request) {
  if (!hasReportSameOrigin(request)) return new Response("Cross-site request rejected.", { status: 403 });
  const token = reportTokenFromRequest(request);
  if (!token) return NextResponse.redirect(new URL("/credit-check/thank-you", request.url), 303);

  try {
    const session = await findCompletedCreditReportSession(token);
    if (!session) return NextResponse.redirect(new URL("/credit-check/thank-you", request.url), 303);
    if (session.contactId) await addTagToContact(session.contactId, "clicked-video-guide");

    const response = NextResponse.redirect(new URL("/webinar/room", request.url), 303);
    response.cookies.set(CREDIT_REPORT_WEBINAR_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(request.url).protocol === "https:" || process.env.NODE_ENV === "production",
      path: "/webinar/room",
      maxAge: ACCESS_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/credit-check/thank-you", request.url), 303);
  }
}
