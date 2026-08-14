import "server-only";

import { Resend } from "resend";
import { createAdminClient } from "./supabase/admin";

const DIGEST_KEY = "daily_overdue_tasks";
const DIGEST_TIMEZONE = "Europe/Lisbon";

type OverdueTaskRow = {
  title: string;
  due_at: string;
  contact_name: string;
};

function digestDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DIGEST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export async function sendDailyOverdueDigest(): Promise<{ sent: boolean; skipped: boolean; overdue: number }> {
  const admin = createAdminClient();
  const date = digestDate();
  const { data: claimed, error: claimError } = await admin.rpc("claim_operational_digest_v1", {
    p_digest_key: DIGEST_KEY,
    p_digest_date: date,
  });
  if (claimError) throw new Error(claimError.message);
  if (!claimed) return { sent: false, skipped: true, overdue: 0 };

  let overdue = 0;
  try {
    const { data, error } = await admin.rpc("list_overdue_digest_tasks_v1", { p_limit: 50 });
    if (error) throw new Error(error.message);
    const tasks = (data ?? []) as OverdueTaskRow[];
    overdue = tasks.length;

    if (tasks.length) {
      const testMode = (process.env.EMAIL_MODE ?? "test") !== "production";
      const recipient = testMode ? process.env.EMAIL_TEST_RECIPIENT : process.env.CRM_DIGEST_RECIPIENT;
      const apiKey = process.env.RESEND_API_KEY;
      if (!recipient || !apiKey) throw new Error("Digest email delivery is not configured.");
      const lines = tasks.map((task) => {
        return `• ${task.title} — ${task.contact_name} — due ${new Date(task.due_at).toLocaleString("en-US", { timeZone: DIGEST_TIMEZONE, dateStyle: "medium", timeStyle: "short" })}`;
      });
      const appUrl = (process.env.APP_BASE_URL ?? "https://vance-dotson.anadias-dev.workers.dev").replace(/\/$/, "");
      const text = [`${tasks.length} overdue task${tasks.length === 1 ? "" : "s"} need attention:`, "", ...lines, "", `Open Tasks: ${appUrl}/crm/tasks`].join("\n");
      const list = lines.map((line) => `<li style="margin-bottom:8px">${escapeHtml(line.slice(2))}</li>`).join("");
      const { data: sent, error: sendError } = await new Resend(apiKey).emails.send({
        from: process.env.EMAIL_FROM ?? "Vance Dotson <onboarding@resend.dev>",
        to: recipient,
        subject: `Vance CRM: ${tasks.length} overdue task${tasks.length === 1 ? "" : "s"}`,
        text,
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>Overdue tasks</h2><ul>${list}</ul><p><a href="${appUrl}/crm/tasks">Open Tasks</a></p></div>`,
      }, { idempotencyKey: `vance-${DIGEST_KEY}-${date}` });
      if (sendError || !sent?.id) throw new Error(sendError?.message ?? "Resend returned no message ID.");
    }

    await admin.rpc("complete_operational_digest_v1", {
      p_digest_key: DIGEST_KEY,
      p_digest_date: date,
      p_status: "sent",
      p_item_count: overdue,
      p_last_error: null,
    });
    return { sent: overdue > 0, skipped: false, overdue };
  } catch (error) {
    await admin.rpc("complete_operational_digest_v1", {
      p_digest_key: DIGEST_KEY,
      p_digest_date: date,
      p_status: "failed",
      p_item_count: overdue,
      p_last_error: error instanceof Error ? error.message : "Unknown digest error",
    });
    throw error;
  }
}
