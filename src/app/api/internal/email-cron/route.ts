import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { processDueEmails } from "@/lib/email";
import { reconcileGoogleCalendarBookings } from "@/lib/google-calendar";
import { syncCrmNotifications } from "@/lib/store";
import { cleanupAnonymousAnalytics } from "@/lib/analytics-retention";
import { sendDailyOverdueDigest } from "@/lib/overdue-digest";

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("x-vance-cron-secret");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length
    && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const [emailResult, calendarResult, notificationResult, retentionResult, digestResult] = await Promise.allSettled([
      processDueEmails(10),
      reconcileGoogleCalendarBookings(25),
      syncCrmNotifications(),
      cleanupAnonymousAnalytics(500),
      sendDailyOverdueDigest(),
    ]);
    const email = emailResult.status === "fulfilled"
      ? emailResult.value
      : { error: emailResult.reason instanceof Error ? emailResult.reason.message : "unknown_error" };
    const calendar = calendarResult.status === "fulfilled"
      ? calendarResult.value
      : { error: calendarResult.reason instanceof Error ? calendarResult.reason.message : "unknown_error" };
    const notifications = notificationResult.status === "fulfilled"
      ? { ok: true }
      : { error: notificationResult.reason instanceof Error ? notificationResult.reason.message : "unknown_error" };
    const retention = retentionResult.status === "fulfilled"
      ? retentionResult.value
      : { error: retentionResult.reason instanceof Error ? retentionResult.reason.message : "unknown_error" };
    const digest = digestResult.status === "fulfilled"
      ? digestResult.value
      : { error: digestResult.reason instanceof Error ? digestResult.reason.message : "unknown_error" };
    const ok = emailResult.status === "fulfilled"
      && calendarResult.status === "fulfilled"
      && notificationResult.status === "fulfilled"
      && retentionResult.status === "fulfilled"
      && digestResult.status === "fulfilled";
    console.log("[maintenance-cron] completed", { ok, email, calendar, notifications, retention, digest });
    return NextResponse.json({ ok, email, calendar, notifications, retention, digest });
  } catch (error) {
    console.error("[maintenance-cron] failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json({ error: "Scheduled maintenance failed." }, { status: 500 });
  }
}
