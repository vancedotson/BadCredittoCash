import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { processEmailBacklog } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileGoogleCalendarBookings } from "@/lib/google-calendar";
import { syncCrmNotifications } from "@/lib/store";
import { cleanupAnonymousAnalytics } from "@/lib/analytics-retention";
import { sendDailyOverdueDigest } from "@/lib/overdue-digest";
import { reconcileCreditReportArtifacts } from "@/lib/credit-report-reconciliation";

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
    const [emailResult, calendarResult, notificationResult, retentionResult, digestResult, reconciliationResult, liveResult] = await Promise.allSettled([
      processEmailBacklog(),
      reconcileGoogleCalendarBookings(25),
      syncCrmNotifications(),
      cleanupAnonymousAnalytics(500),
      sendDailyOverdueDigest(),
      reconcileCreditReportArtifacts({ limit: 25 }),
      (async () => {
        if (process.env.LIVE_WEBINAR_ENABLED !== "true") return { enabled: false };
        const { data, error } = await createAdminClient().rpc("sync_live_webinar_messages_v1", { p_limit: 500 });
        if (error) throw new Error("Live webinar scheduling failed.");
        return { enabled: true, ...(data as Record<string, unknown>) };
      })(),
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
    const creditReports = reconciliationResult.status === "fulfilled"
      ? reconciliationResult.value
      : { error: "Credit-report reconciliation failed." };
    const ok = emailResult.status === "fulfilled"
      && liveResult.status === "fulfilled"
      && calendarResult.status === "fulfilled"
      && notificationResult.status === "fulfilled"
      && retentionResult.status === "fulfilled"
      && digestResult.status === "fulfilled"
      && reconciliationResult.status === "fulfilled"
      && reconciliationResult.value.failed === 0;
    const live = liveResult.status === "fulfilled" ? liveResult.value : { error: "Live webinar scheduling failed." };
    console.log("[maintenance-cron] completed", { ok, email, calendar, notifications, retention, digest, creditReports, live });
    return NextResponse.json({ ok, email, calendar, notifications, retention, digest, creditReports, live });
  } catch (error) {
    console.error("[maintenance-cron] failed", {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return NextResponse.json({ error: "Scheduled maintenance failed." }, { status: 500 });
  }
}
