import "server-only";

import { createAdminClient } from "./supabase/admin";
import { createClient as createServerSupabaseClient } from "./supabase/server";
import { listGoogleBusyIntervals } from "./google-calendar";
import { isCrmDemoMode } from "./demo";

export type HealthState = "healthy" | "warning" | "error";

export type HealthCheck = {
  key: "database" | "email" | "queue" | "calendar";
  label: string;
  state: HealthState;
  detail: string;
};

async function databaseCheck(): Promise<HealthCheck> {
  const { error } = await createAdminClient()
    .from("contacts")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return { key: "database", label: "Database", state: "healthy", detail: "Connected to Supabase." };
}

async function queueCheck(): Promise<HealthCheck> {
  const admin = await createServerSupabaseClient();
  const [scheduled, retrying, failed] = await Promise.all([
    admin.from("scheduled_messages").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
    admin.from("scheduled_messages").select("id", { count: "exact", head: true }).eq("status", "scheduled").gt("attempts", 0),
    admin.from("scheduled_messages").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  const error = scheduled.error ?? retrying.error ?? failed.error;
  if (error) throw new Error(error.message);
  const failedCount = failed.count ?? 0;
  return {
    key: "queue",
    label: "Email queue",
    state: failedCount > 0 ? "warning" : "healthy",
    detail: `${scheduled.count ?? 0} scheduled · ${retrying.count ?? 0} retrying · ${failedCount} permanently failed.`,
  };
}

async function emailCheck(): Promise<HealthCheck> {
  const production = process.env.EMAIL_MODE === "production";
  const providerConfigured = Boolean(process.env.RESEND_API_KEY);
  if (!providerConfigured) {
    return { key: "email", label: "Email provider", state: "error", detail: "Resend is not configured." };
  }
  return {
    key: "email",
    label: "Email provider",
    state: production ? "healthy" : "warning",
    detail: production ? "Resend is configured for production delivery." : "Resend is configured in test mode.",
  };
}

async function calendarCheck(): Promise<HealthCheck> {
  const now = new Date();
  await listGoogleBusyIntervals(now, new Date(now.getTime() + 60_000));
  return { key: "calendar", label: "Google Calendar", state: "healthy", detail: "Connected and responding." };
}

const checks = [databaseCheck, emailCheck, queueCheck, calendarCheck] as const;

export async function getSystemHealth(): Promise<{ checkedAt: string; checks: HealthCheck[] }> {
  if (isCrmDemoMode()) {
    return {
      checkedAt: new Date().toISOString(),
      checks: [
        { key: "database", label: "Database", state: "warning", detail: "Using local design-review data. Connect Supabase before launch." },
        { key: "email", label: "Email provider", state: "error", detail: "Resend is not configured. Add the API key before sending real email." },
        { key: "queue", label: "Email queue", state: "healthy", detail: "Preview queue is available and has no permanent failures." },
        { key: "calendar", label: "Google Calendar", state: "warning", detail: "Calendar is disconnected in local design-review mode." },
      ],
    };
  }
  const results = await Promise.allSettled(checks.map((check) => check()));
  const labels: Array<Pick<HealthCheck, "key" | "label">> = [
    { key: "database", label: "Database" },
    { key: "email", label: "Email provider" },
    { key: "queue", label: "Email queue" },
    { key: "calendar", label: "Google Calendar" },
  ];
  return {
    checkedAt: new Date().toISOString(),
    checks: results.map((result, index) => {
      if (result.status === "fulfilled") return result.value;
      console.error("[system-health] dependency check failed", {
        check: labels[index].key,
        error: result.reason instanceof Error ? result.reason.message : "unknown_error",
      });
      return {
        ...labels[index],
        state: "error" as const,
        detail: "The service did not respond to the health check.",
      };
    }),
  };
}
