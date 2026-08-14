import "server-only";

import { Resend } from "resend";

import { SEQUENCES, SEGMENT_SEQUENCES, type SequenceEmail } from "@/config/sequences";
import { EVENTS } from "./events";
import { createUnsubscribeToken } from "./email-token";
import { scheduledFor } from "./email-scheduling";
import { createAdminClient } from "./supabase/admin";
import { recordEvent } from "./store";

type ClaimedMessage = {
  id: string;
  template_key: string;
  payload: MessagePayload;
};

type DueMessage = {
  message_id: string;
  email: string;
  template_key: string;
  payload: MessagePayload;
};

export type MessagePayload = {
  bookingId?: string;
  startsAt?: string;
  timezone?: string;
};

type FailureOutcome = {
  outcome: "retrying" | "failed";
  attempts: number;
  retry_at: string | null;
};

type DeliveryOutcome = "sent" | "retrying" | "failed";

function resolveSequence(sequenceId: string) {
  return SEQUENCES[sequenceId] ?? SEGMENT_SEQUENCES[sequenceId];
}

function resolveTemplate(templateKey: string): SequenceEmail | null {
  if (templateKey.startsWith("booking_rescheduled:")) return {
    delay: "immediately",
    subject: "Your call has been rescheduled.",
    body: "Your new call time is {{appointment_time}} ({{timezone}}). Have your reports and any collector messages handy. If anything else changes, reply to this email.",
  };
  if (templateKey.startsWith("booking_reminder:")) return {
    delay: "1 day before",
    subject: "Reminder: your call is coming up.",
    body: "We're scheduled for {{appointment_time}} ({{timezone}}). Have your reports and any collector messages handy so we can make the most of the call.",
  };
  if (templateKey.startsWith("booking_cancelled:")) return {
    delay: "immediately",
    subject: "Your call has been cancelled.",
    body: "Your call scheduled for {{appointment_time}} ({{timezone}}) has been cancelled. If you want to choose another time, use this link: {{call_link}}.",
  };
  // Booking onboarding keys carry the booking ID so a repeat booking creates a
  // fresh provider idempotency key instead of replaying the first confirmation.
  const match = templateKey.match(/^(.+):(\d+)(?::.+)?$/);
  if (!match) return null;
  const sequence = resolveSequence(match[1]);
  const index = Number(match[2]) - 1;
  return sequence?.emails[index] ?? null;
}

function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "https://vance-dotson.anadias-dev.workers.dev").replace(/\/$/, "");
}

function appointmentTime(payload: MessagePayload): string {
  if (!payload.startsAt) return "the scheduled time";
  const date = new Date(payload.startsAt);
  if (Number.isNaN(date.getTime())) return "the scheduled time";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: payload.timezone || "America/Chicago",
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function mergeFields(value: string, payload: MessagePayload = {}): string {
  const baseUrl = appBaseUrl();
  return value
    .replaceAll("{{watch_link}}", `${baseUrl}/webinar/room`)
    .replaceAll("{{call_link}}", `${baseUrl}/book`)
    .replaceAll("{{appointment_time}}", appointmentTime(payload))
    .replaceAll("{{timezone}}", payload.timezone || "America/Chicago");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailHtml(body: string, unsubscribeLink?: string): string {
  const escaped = escapeHtml(body);
  const linked = escaped.replace(
    /(https:\/\/[^\s.]+(?:\.[^\s.]+)*(?:\/[^\s]*)?)/g,
    '<a href="$1" style="color:#b56f00">$1</a>',
  );
  return `<div style="background:#f4f6f8;padding:32px 16px;font-family:Arial,sans-serif;color:#102d4f">
    <div style="max-width:600px;margin:auto;background:#fff;border:1px solid #dfe5eb;border-radius:12px;padding:32px">
      <p style="margin:0 0 24px;font-size:13px;font-weight:700;letter-spacing:2px;color:#15549a">VANCE DOTSON</p>
      <p style="margin:0;font-size:17px;line-height:1.65">${linked}</p>
      ${unsubscribeLink ? `<p style="margin:28px 0 0;padding-top:18px;border-top:1px solid #dfe5eb;font-size:12px;color:#66788a">No longer want these follow-ups? <a href="${escapeHtml(unsubscribeLink)}" style="color:#15549a">Unsubscribe</a>.</p>` : ""}
    </div>
  </div>`;
}

function isMarketingTemplate(templateKey: string): boolean {
  return templateKey !== "pre_webinar:1"
    && !templateKey.startsWith("onboarding:")
    && !templateKey.startsWith("booking_rescheduled:")
    && !templateKey.startsWith("booking_reminder:")
    && !templateKey.startsWith("booking_cancelled:");
}

async function claimMessage(email: string, templateKey: string): Promise<ClaimedMessage | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_scheduled_email", {
    p_email: email,
    p_template_key: templateKey,
  });
  if (error) throw new Error(error.message);
  return (data as ClaimedMessage[] | null)?.[0] ?? null;
}

async function markMessage(
  id: string,
  values: {
    status: "sent" | "failed";
    provider_message_id?: string | null;
    last_error?: string | null;
    sent_at?: string | null;
  },
): Promise<void> {
  const { error } = await createAdminClient().rpc("complete_scheduled_email", {
    p_message_id: id,
    p_status: values.status,
    p_provider_message_id: values.provider_message_id ?? null,
    p_last_error: values.last_error ?? null,
    p_sent_at: values.sent_at ?? null,
  });
  if (error) throw new Error(error.message);
}

async function failMessage(
  id: string,
  reason: string,
  retryable: boolean,
): Promise<FailureOutcome> {
  const { data, error } = await createAdminClient().rpc("fail_scheduled_email", {
    p_message_id: id,
    p_last_error: reason.slice(0, 500),
    p_retryable: retryable,
    p_max_attempts: 3,
  });
  if (error) throw new Error(error.message);
  const outcome = (data as FailureOutcome[] | null)?.[0];
  if (!outcome) throw new Error("Could not record email delivery failure");
  return outcome;
}

function isRetryableProviderError(statusCode?: number | null): boolean {
  if (statusCode == null) return true;
  return statusCode === 408 || statusCode === 409 || statusCode === 425
    || statusCode === 429 || statusCode >= 500;
}

async function deliverClaimedMessage(
  claimed: ClaimedMessage,
  intendedRecipient: string,
  templateKey: string,
  message: SequenceEmail,
  payload: MessagePayload = {},
): Promise<DeliveryOutcome> {
  const testMode = (process.env.EMAIL_MODE ?? "test") !== "production";
  const actualRecipient = testMode
    ? process.env.EMAIL_TEST_RECIPIENT
    : intendedRecipient;
  const from = process.env.EMAIL_FROM ?? "Vance Dotson <onboarding@resend.dev>";
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || !actualRecipient) {
    const reason = !apiKey ? "RESEND_API_KEY is not configured" : "EMAIL_TEST_RECIPIENT is not configured";
    await failMessage(claimed.id, reason, false);
    console.error(`[email] ${reason}`);
    return "failed";
  }

  const subject = mergeFields(message.subject, payload);
  const marketing = isMarketingTemplate(templateKey);
  const unsubscribeLink = marketing
    ? `${appBaseUrl()}/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(claimed.id))}`
    : undefined;
  const content = mergeFields(message.body, payload);
  const body = unsubscribeLink
    ? `${content}\n\nUnsubscribe: ${unsubscribeLink}`
    : content;
  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send(
      {
        from,
        to: actualRecipient,
        subject,
        text: body,
        html: emailHtml(content, unsubscribeLink),
        headers: unsubscribeLink ? {
          "List-Unsubscribe": `<${unsubscribeLink.replace("/unsubscribe?", "/api/unsubscribe?")}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        } : undefined,
      },
      { idempotencyKey: `vance-${claimed.id}` },
    );
    if (error || !data?.id) {
      const providerError = new Error(error?.message ?? "Resend returned no message ID") as Error & { statusCode?: number | null };
      providerError.statusCode = error?.statusCode;
      throw providerError;
    }

    await markMessage(claimed.id, {
      status: "sent",
      provider_message_id: data.id,
      last_error: null,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Resend error";
    const statusCode = error instanceof Error && "statusCode" in error
      ? (error as Error & { statusCode?: number | null }).statusCode
      : undefined;
    const failure = await failMessage(claimed.id, reason, isRetryableProviderError(statusCode));
    console.error("[email] Resend delivery attempt failed", {
      templateKey,
      outcome: failure.outcome,
      attempts: failure.attempts,
      retryAt: failure.retry_at,
      statusCode: statusCode ?? null,
    });
    return failure.outcome;
  }

  try {
    await recordEvent({
      event: EVENTS.emailSent,
      email: intendedRecipient,
      props: { subject, templateKey, provider: "resend", testMode },
    });
  } catch (error) {
    console.warn("[email] delivery succeeded but event recording failed", {
      templateKey,
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }
  return "sent";
}

export async function processDueEmails(limit = 10): Promise<{
  claimed: number;
  processed: number;
  sent: number;
  retrying: number;
  failed: number;
}> {
  const safeLimit = Math.max(1, Math.min(10, Math.trunc(limit)));
  const { data, error } = await createAdminClient().rpc("claim_due_scheduled_emails", {
    p_limit: safeLimit,
  });
  if (error) throw new Error(error.message);

  const due = (data ?? []) as DueMessage[];
  let processed = 0;
  let sent = 0;
  let retrying = 0;
  let failed = 0;
  for (const claimed of due) {
    const message = resolveTemplate(claimed.template_key);
    if (!message) {
      await failMessage(claimed.message_id, `Unknown template: ${claimed.template_key}`, false);
      failed += 1;
      processed += 1;
      continue;
    }
    const outcome = await deliverClaimedMessage(
      { id: claimed.message_id, template_key: claimed.template_key, payload: claimed.payload ?? {} },
      claimed.email,
      claimed.template_key,
      message,
      claimed.payload ?? {},
    );
    if (outcome === "sent") sent += 1;
    else if (outcome === "retrying") retrying += 1;
    else failed += 1;
    processed += 1;
  }

  return { claimed: due.length, processed, sent, retrying, failed };
}

export async function enqueueSequence(
  email: string,
  sequenceId: string,
  anchor?: Date,
  payload: MessagePayload = {},
): Promise<void> {
  const seq = resolveSequence(sequenceId);
  if (!seq) {
    console.warn(`[email] unknown sequence "${sequenceId}"; skipping.`);
    return;
  }
  const messages = buildSequenceMessages(sequenceId, anchor, payload);
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("enqueue_funnel_sequence", {
    p_email: email,
    p_sequence_key: seq.id,
    p_messages: messages,
  });
  if (error) throw new Error(error.message);

  await recordEvent({
    event: EVENTS.emailQueued,
    email,
    props: { sequence: seq.id, name: seq.name, emails: seq.emails.length },
  });

  await deliverImmediateSequenceMessage(email, sequenceId, payload);
}

export function buildSequenceMessages(
  sequenceId: string,
  anchor?: Date,
  payload: MessagePayload = {},
) {
  const seq = resolveSequence(sequenceId);
  if (!seq) throw new Error(`Unknown sequence: ${sequenceId}`);
  const bookingSuffix = seq.id === "onboarding" && payload.bookingId
    ? `:${payload.bookingId}`
    : "";
  return seq.emails.map((message, index) => ({
    templateKey: `${seq.id}:${index + 1}${bookingSuffix}`,
    scheduledFor: scheduledFor(message.delay, index, anchor).toISOString(),
    payload,
  }));
}

export async function deliverImmediateSequenceMessage(
  email: string,
  sequenceId: string,
  payload: MessagePayload = {},
): Promise<void> {
  const seq = resolveSequence(sequenceId);
  if (!seq) throw new Error(`Unknown sequence: ${sequenceId}`);
  const bookingSuffix = seq.id === "onboarding" && payload.bookingId
    ? `:${payload.bookingId}`
    : "";
  const immediateIndex = seq.emails.findIndex((message) => message.delay === "immediately");
  if (immediateIndex >= 0) {
    const templateKey = `${seq.id}:${immediateIndex + 1}${bookingSuffix}`;
    const claimed = await claimMessage(email, templateKey);
    if (!claimed) return;
    await deliverClaimedMessage(
      claimed,
      email,
      templateKey,
      seq.emails[immediateIndex],
      claimed.payload ?? payload,
    );
  }
}
