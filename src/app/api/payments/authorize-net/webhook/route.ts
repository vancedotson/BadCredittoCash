import { NextResponse } from "next/server";

import { paymentsEnabled, authorizeNetConfigured } from "@/lib/authorize-net-config";
import {
  AuthorizeNetNotFoundError,
  getTransactionDetails,
  mapTransactionOutcome,
  transactionDetailsForApply,
} from "@/lib/authorize-net";
import {
  AUTHORIZE_NET_SIGNATURE_HEADER,
  parseAuthorizeNetNotification,
  verifyAuthorizeNetSignature,
} from "@/lib/authorize-net-webhook";
import {
  applyPaymentTransaction,
  beginPaymentWebhook,
  finishPaymentWebhook,
} from "@/lib/payment-requests";

export const dynamic = "force-dynamic";

const MAX_WEBHOOK_BYTES = 64 * 1024;
const HANDLED_EVENTS = new Set([
  "net.authorize.payment.authcapture.created",
  "net.authorize.payment.fraud.approved",
  "net.authorize.payment.fraud.declined",
  "net.authorize.payment.fraud.held",
  "net.authorize.payment.void.created",
  "net.authorize.payment.refund.created",
]);
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function text(body: string, status: number) { return new NextResponse(body, { status, headers: HEADERS }); }
function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: HEADERS }); }
function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "unknown";
}

/**
 * Authorize.net webhook. The notification is only a trigger: the signature is
 * verified before parsing, and state changes always come from
 * getTransactionDetails matched to our invoice number. Never log bodies.
 */
export async function POST(request: Request) {
  const signatureKey = process.env.AUTHNET_SIGNATURE_KEY?.trim();
  if (!paymentsEnabled() || !authorizeNetConfigured() || !signatureKey) return text("Webhook unavailable", 503);

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_WEBHOOK_BYTES) return text("Payload too large", 413);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_WEBHOOK_BYTES) return text("Payload too large", 413);

  if (!verifyAuthorizeNetSignature(raw, request.headers.get(AUTHORIZE_NET_SIGNATURE_HEADER), signatureKey)) {
    return text("Invalid webhook", 400);
  }
  const notification = parseAuthorizeNetNotification(raw);
  if (!notification) return text("Invalid webhook", 400);

  const transactionId = notification.payload.id;
  if (!HANDLED_EVENTS.has(notification.eventType) || notification.payload.entityName !== "transaction" || !transactionId) {
    return json({ ok: true, ignored: true });
  }

  let begin: "new" | "duplicate" | "retry";
  try {
    begin = await beginPaymentWebhook({
      notificationId: notification.notificationId,
      eventType: notification.eventType,
      transactionId,
      // Only the parsed subset is stored, never the raw body.
      payload: { eventDate: notification.eventDate, ...notification.payload },
    });
  } catch (error) {
    console.error("[payments-webhook] could not record notification", { code: errorCode(error) });
    return text("Webhook processing failed", 500);
  }
  if (begin === "duplicate") return json({ ok: true, duplicate: true });

  try {
    const details = await getTransactionDetails(transactionId);
    const outcome = mapTransactionOutcome(notification.eventType, details);
    if (!outcome || !details.invoiceNumber) {
      await finishPaymentWebhook(notification.notificationId, "ignored");
      return json({ ok: true, ignored: true });
    }
    const result = await applyPaymentTransaction({
      reference: details.invoiceNumber,
      transactionId: details.transId,
      outcome,
      details: transactionDetailsForApply(details),
      source: "webhook",
    });
    await finishPaymentWebhook(notification.notificationId, result === "unknown_reference" ? "ignored" : "processed");
    return json({ ok: true, result });
  } catch (error) {
    if (error instanceof AuthorizeNetNotFoundError) {
      // Authorize.net's "Test" button sends a transaction id that does not exist.
      try { await finishPaymentWebhook(notification.notificationId, "ignored"); } catch { /* retry later is harmless */ }
      return json({ ok: true, ignored: true });
    }
    console.error("[payments-webhook] processing deferred for retry", { code: errorCode(error) });
    try { await finishPaymentWebhook(notification.notificationId, "retry"); } catch { /* keep the 500 */ }
    return text("Webhook processing failed", 500);
  }
}
