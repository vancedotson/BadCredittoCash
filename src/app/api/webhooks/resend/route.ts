import { NextResponse } from "next/server";
import { Resend } from "resend";

import { createAdminClient } from "@/lib/supabase/admin";

const MAX_WEBHOOK_BYTES = 256 * 1024;
const HANDLED_EVENTS = new Set([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
  "email.opened",
  "email.clicked",
]);

type EmailWebhook = {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    bounce?: { message?: string; type?: string; subType?: string };
    failed?: { reason?: string };
    suppressed?: { message?: string; type?: string };
  };
};

function eventDetails(event: EmailWebhook): Record<string, string> {
  if (event.data.bounce) return {
    reason: event.data.bounce.message?.slice(0, 500) ?? "Bounced",
    type: event.data.bounce.type?.slice(0, 100) ?? "",
    subtype: event.data.bounce.subType?.slice(0, 100) ?? "",
  };
  if (event.data.failed) return {
    reason: event.data.failed.reason?.slice(0, 500) ?? "Delivery failed",
  };
  if (event.data.suppressed) return {
    reason: event.data.suppressed.message?.slice(0, 500) ?? "Suppressed by provider",
    type: event.data.suppressed.type?.slice(0, 100) ?? "",
  };
  return {};
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_WEBHOOK_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }

  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[resend-webhook] signing secret is not configured");
    return new NextResponse("Webhook unavailable", { status: 503 });
  }

  const payload = await request.text();
  if (Buffer.byteLength(payload) > MAX_WEBHOOK_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }

  let event: EmailWebhook;
  try {
    event = new Resend().webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret,
    }) as EmailWebhook;
  } catch {
    return new NextResponse("Invalid webhook", { status: 400 });
  }

  const providerMessageId = event.data.email_id;
  if (!HANDLED_EVENTS.has(event.type) || !providerMessageId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const eventId = request.headers.get("svix-id");
  if (!eventId || eventId.length > 200) {
    return new NextResponse("Invalid webhook ID", { status: 400 });
  }

  const { error } = await createAdminClient().rpc("apply_resend_email_event", {
    p_event_id: eventId,
    p_event_type: event.type,
    p_provider_message_id: providerMessageId,
    p_occurred_at: event.created_at,
    p_details: eventDetails(event),
    p_allow_suppression: process.env.EMAIL_MODE === "production",
  });
  if (error) {
    console.error("[resend-webhook] database update failed", { code: error.code });
    return new NextResponse("Webhook processing failed", { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

