import "server-only";

import { randomBytes } from "node:crypto";

import { createAdminClient } from "./supabase/admin";
import { isCrmDemoMode } from "./demo";
import { publicUrl } from "@/config/public-site";
import {
  AuthorizeNetConfigError,
  chargeDetailsForApply,
  chargeOpaqueData,
  findUnsettledTransactionByInvoice,
  getTransactionDetails,
  isDefiniteChargeRejection,
  mapChargeOutcome,
  mapTransactionOutcome,
  transactionDetailsForApply,
  type PaymentOutcome,
} from "./authorize-net";
import { isPaymentLinkToken, type PaymentRequestItem, type PublicPaymentRequest } from "./payments-display";

export type { PaymentRequestItem, PublicPaymentRequest } from "./payments-display";

/** Carries the database's stable exception code (for example payment_request_not_cancellable). */
export class PaymentRequestError extends Error {
  /**
   * Set by chargePaymentRequest when the error happened before Authorize.net
   * was called, so the route may truthfully say that nothing was charged.
   */
  chargeNotStarted = false;

  constructor(readonly code: string, message = "The payment request could not be updated.") {
    super(message);
    this.name = "PaymentRequestError";
  }
}

const KNOWN_ERRORS = new Set([
  "payment_request_actor_invalid",
  "payment_request_contact_unavailable",
  "payment_request_amount_invalid",
  "payment_request_description_invalid",
  "payment_request_missing",
  "payment_request_not_payable",
  "payment_request_not_cancellable",
  "payment_email_suppressed",
  "payment_email_too_soon",
  "payment_charge_in_progress",
  "payment_charge_unresolved",
]);

function rpcFailure(error: { message?: string } | null, fallback: string): never {
  const code = error?.message?.trim() ?? "";
  throw new PaymentRequestError(KNOWN_ERRORS.has(code) ? code : "payment_request_unavailable", fallback);
}

function demoUnavailable(): never {
  throw new PaymentRequestError("payment_request_unavailable", "Payment requests are unavailable in demo mode.");
}

const REFERENCE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** `CRP-` plus 8 unambiguous characters; used as the Authorize.net invoiceNumber. */
export function generatePaymentReference(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  // 256 % 31 leaves a slight bias; acceptable for a human reference that is
  // unique-checked by the database, not a secret.
  return `CRP-${Array.from(bytes, (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]).join("")}`;
}

/** 32 random bytes, base64url (43 characters). A bearer secret: never log it. */
export function generatePaymentLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function paymentLinkUrl(token: string): string {
  return publicUrl(`/pay/${token}`);
}

function asItem(value: unknown): PaymentRequestItem {
  if (!value || typeof value !== "object" || typeof (value as { id?: unknown }).id !== "string") {
    throw new PaymentRequestError("payment_request_unavailable", "The payment request returned invalid data.");
  }
  return value as PaymentRequestItem;
}

export async function createPaymentRequest(input: {
  contactId: string;
  amountCents: number;
  description: string;
  actorId: string;
  /** Defaults to a hosted "link" request; "charge" is a manual card charge. */
  kind?: "link" | "charge";
}): Promise<PaymentRequestItem> {
  if (isCrmDemoMode()) return demoUnavailable();
  const admin = createAdminClient();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await admin.rpc("create_payment_request_v1", {
      p_contact_id: input.contactId,
      p_amount_cents: input.amountCents,
      p_description: input.description,
      p_actor_id: input.actorId,
      p_reference: generatePaymentReference(),
      p_link_token: generatePaymentLinkToken(),
      // Omitted for links so link creation keeps working before the charge migration is applied.
      ...(input.kind === "charge" ? { p_kind: "charge" } : {}),
    });
    if (!error) return asItem(data);
    const collision = (error as { code?: string }).code === "23505";
    if (!collision) rpcFailure(error, "The payment request could not be created.");
  }
  throw new PaymentRequestError("payment_request_unavailable", "The payment request could not be created.");
}

export async function listPaymentRequests(contactId: string): Promise<PaymentRequestItem[]> {
  if (isCrmDemoMode()) return [];
  const { data, error } = await createAdminClient().rpc("list_payment_requests_v1", { p_contact_id: contactId });
  if (error || !Array.isArray(data)) rpcFailure(error, "Payment requests are unavailable.");
  return (data as unknown[]).map(asItem);
}

/**
 * One request by id, however old (the list is capped at 200 rows). Null when it
 * does not exist, belongs to another contact, or the contact is trashed.
 */
export async function getPaymentRequest(requestId: string, contactId: string, actorId: string): Promise<PaymentRequestItem | null> {
  if (isCrmDemoMode()) return null;
  const { data, error } = await createAdminClient().rpc("get_payment_request_v1", {
    p_request_id: requestId, p_contact_id: contactId, p_actor_id: actorId,
  });
  if (error) rpcFailure(error, "The payment request is unavailable.");
  return data === null || data === undefined ? null : asItem(data);
}

export async function cancelPaymentRequest(requestId: string, actorId: string, contactId: string): Promise<void> {
  if (isCrmDemoMode()) return demoUnavailable();
  const { data, error } = await createAdminClient().rpc("cancel_payment_request_v1", {
    p_request_id: requestId, p_actor_id: actorId, p_contact_id: contactId,
  });
  if (error || data !== true) rpcFailure(error, "The payment request could not be cancelled.");
}

export async function findPaymentRequestByToken(token: string): Promise<PublicPaymentRequest | null> {
  if (!isPaymentLinkToken(token) || isCrmDemoMode()) return null;
  const { data, error } = await createAdminClient().rpc("find_payment_request_by_token_v1", { p_token: token });
  if (error) rpcFailure(error, "The payment request is unavailable.");
  return data && typeof data === "object" ? data as PublicPaymentRequest : null;
}

export type CheckoutRequest = { id: string; reference: string; amountCents: number; description: string; contactEmail: string; contactName: string };

export async function beginPaymentCheckout(token: string): Promise<CheckoutRequest> {
  if (isCrmDemoMode()) return demoUnavailable();
  const { data, error } = await createAdminClient().rpc("begin_payment_checkout_v1", { p_token: token });
  const result = data as Partial<CheckoutRequest> | null;
  if (error || typeof result?.id !== "string" || typeof result.reference !== "string") {
    rpcFailure(error, "The checkout could not be started.");
  }
  return result as CheckoutRequest;
}

export async function recordPaymentRequestEvent(requestId: string, action: "checkout_failed" | "charge_failed" | "charge_unknown", actorName: string, details: Record<string, unknown>): Promise<void> {
  const { error } = await createAdminClient().rpc("record_payment_request_event_v1", {
    p_request_id: requestId, p_action: action, p_actor_name: actorName, p_details: details,
  });
  if (error) rpcFailure(error, "The payment event could not be recorded.");
}

export type ApplyResult = "paid" | "already_paid" | "duplicate_payment" | "failed" | "ignored" | "held" | "recorded" | "unknown_reference";

export async function applyPaymentTransaction(input: {
  reference: string;
  transactionId: string;
  outcome: PaymentOutcome;
  details: Record<string, unknown>;
  source: "webhook" | "return_check" | "charge" | "status_check";
}): Promise<ApplyResult> {
  const { data, error } = await createAdminClient().rpc("apply_payment_transaction_v1", {
    p_reference: input.reference,
    p_transaction_id: input.transactionId,
    p_outcome: input.outcome,
    p_details: input.details,
    p_source: input.source,
  });
  if (error || typeof data !== "string") rpcFailure(error, "The payment result could not be recorded.");
  return data as ApplyResult;
}

export async function beginPaymentWebhook(input: { notificationId: string; eventType: string; transactionId: string | null; payload: Record<string, unknown> }): Promise<"new" | "duplicate" | "retry"> {
  const { data, error } = await createAdminClient().rpc("begin_payment_webhook_v1", {
    p_notification_id: input.notificationId,
    p_event_type: input.eventType,
    p_transaction_id: input.transactionId,
    p_payload: input.payload,
  });
  if (error || (data !== "new" && data !== "duplicate" && data !== "retry")) rpcFailure(error, "The webhook could not be recorded.");
  return data;
}

export async function finishPaymentWebhook(notificationId: string, outcome: "processed" | "ignored" | "retry", requestId: string | null = null): Promise<void> {
  const { error } = await createAdminClient().rpc("finish_payment_webhook_v1", {
    p_notification_id: notificationId, p_outcome: outcome, p_request_id: requestId,
  });
  if (error) rpcFailure(error, "The webhook outcome could not be recorded.");
}

/**
 * Return-page fallback when the webhook has not arrived yet: look for an
 * approved unsettled transaction carrying our invoice number, confirm it with
 * getTransactionDetails, and apply it idempotently. Never throws.
 */
export async function confirmPaymentRequestFromProvider(token: string): Promise<"paid" | "pending" | "not_applicable"> {
  try {
    const found = await findPaymentRequestByToken(token);
    if (!found) return "not_applicable";
    if (found.status === "paid") return "paid";
    if (!found.payable && !found.held) return "not_applicable";
    const summary = await findUnsettledTransactionByInvoice(found.reference);
    if (!summary) return "pending";
    const details = await getTransactionDetails(summary.transId);
    if (details.invoiceNumber !== found.reference || mapTransactionOutcome(null, details) !== "approved") return "pending";
    const result = await applyPaymentTransaction({
      reference: found.reference,
      transactionId: details.transId,
      outcome: "approved",
      details: transactionDetailsForApply(details),
      source: "return_check",
    });
    return result === "paid" || result === "already_paid" ? "paid" : "pending";
  } catch (error) {
    console.warn("[payments] return confirmation deferred to webhook", {
      code: error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : "unknown",
    });
    return "pending";
  }
}

export type ChargeAttemptOutcome = "approved" | "declined" | "held" | "error" | "unknown";

export type ChargeResponse = {
  item: PaymentRequestItem;
  outcome: ChargeAttemptOutcome;
  reason: string | null;
  transactionId: string | null;
  cardLast4: string | null;
};

function errorCodeOf(error: unknown): string {
  return error && typeof error === "object" && "code" in error && typeof (error as { code: unknown }).code === "string"
    ? (error as { code: string }).code : "unknown";
}

/**
 * Charge a card from an AcceptUI opaque-data nonce.
 *
 * The request row is created BEFORE Authorize.net is called so every attempt
 * has an invoice number and audit trail. apply_payment_transaction_v1 is the
 * only writer of paid state. A transport failure leaves the outcome UNKNOWN
 * (the card may have been charged): it is recorded and never retried
 * automatically; staff use checkPaymentRequestStatus or the webhook resolves it.
 * Card data is never seen here; the opaque data is passed straight through and
 * never logged or stored.
 */
export async function chargePaymentRequest(input: {
  contactId: string;
  actorId: string;
  actorName?: string;
  amountCents: number;
  description: string;
  opaqueData: { dataDescriptor: string; dataValue: string };
  customerEmail?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  customerIp?: string | null;
}): Promise<ChargeResponse> {
  const actorName = input.actorName?.trim() || "CRM user";
  let created: PaymentRequestItem;
  try {
    if (isCrmDemoMode()) demoUnavailable();
    created = await createPaymentRequest({
      contactId: input.contactId, amountCents: input.amountCents, description: input.description,
      actorId: input.actorId, kind: "charge",
    });
  } catch (error) {
    // Authorize.net has not been called yet: this failure is known to be safe.
    const tagged = error instanceof PaymentRequestError
      ? error : new PaymentRequestError("payment_request_unavailable", "The charge could not be started.");
    tagged.chargeNotStarted = true;
    throw tagged;
  }
  const reload = async () => (await getPaymentRequest(created.id, input.contactId, input.actorId).catch(() => null)) ?? created;

  let result: Awaited<ReturnType<typeof chargeOpaqueData>>;
  try {
    result = await chargeOpaqueData({
      amountCents: input.amountCents,
      reference: created.reference,
      description: input.description,
      opaqueData: input.opaqueData,
      customerEmail: input.customerEmail,
      firstName: input.firstName,
      lastName: input.lastName,
      customerIp: input.customerIp,
    });
  } catch (error) {
    // Only configuration errors and allowlisted validation/credential codes prove
    // nothing was charged; provider internal or busy errors (E00001, E00053, ...)
    // and anything unrecognised are unknown outcomes.
    const definite = isDefiniteChargeRejection(error);
    const code = error instanceof AuthorizeNetConfigError ? "CONFIG" : errorCodeOf(error);
    console.warn("[payments] charge did not complete", { code, definite });
    if (definite) {
      // Authorize.net rejected the request before processing: nothing was charged.
      // charge_failed is what releases the database's charge guard for this row.
      try { await recordPaymentRequestEvent(created.id, "charge_failed", actorName, { code }); } catch { /* audit is best-effort */ }
      try { await cancelPaymentRequest(created.id, input.actorId, input.contactId); } catch { /* charge_failed alone releases the guard; if both failed the row keeps blocking until staff cancel it */ }
      return {
        item: await reload(), outcome: "error", transactionId: null, cardLast4: null,
        reason: "Authorize.net could not process this charge. Nothing was charged.",
      };
    }
    try { await recordPaymentRequestEvent(created.id, "charge_unknown", actorName, { code }); } catch { /* audit is best-effort */ }
    return {
      item: await reload(), outcome: "unknown", transactionId: null, cardLast4: null,
      reason: "The result is unknown. The card may have been charged. Use Check status before trying again.",
    };
  }

  const outcome = mapChargeOutcome(result);
  try {
    await applyPaymentTransaction({
      reference: created.reference,
      transactionId: result.transId,
      outcome,
      details: chargeDetailsForApply(result, input.amountCents, input.customerEmail ?? null),
      source: "charge",
    });
  } catch (error) {
    // Authorize.net answered but the result could not be saved. The webhook and
    // Check status will reconcile an approval.
    console.error("[payments] charge result could not be recorded", { code: errorCodeOf(error) });
    // Marks the row unresolved so no new charge starts until staff check or cancel it.
    try { await recordPaymentRequestEvent(created.id, "charge_unknown", actorName, { code: "RESULT_NOT_SAVED" }); } catch { /* audit is best-effort */ }
    return {
      item: await reload(), outcome: "unknown", transactionId: null, cardLast4: null,
      reason: "The card was processed but the result could not be saved. Use Check status.",
    };
  }
  return {
    item: await reload(),
    outcome,
    reason: result.reason,
    transactionId: outcome === "approved" || outcome === "held" ? result.transId : null,
    cardLast4: result.cardLast4,
  };
}

/**
 * Resolve an unknown or pending request by asking Authorize.net for an approved
 * unsettled transaction carrying our invoice number, then applying it
 * idempotently. Throws on provider or database failure.
 */
export async function checkPaymentRequestStatus(requestId: string, contactId: string, actorId: string): Promise<"paid" | "not_found"> {
  if (isCrmDemoMode()) return demoUnavailable();
  const item = await getPaymentRequest(requestId, contactId, actorId);
  if (!item) throw new PaymentRequestError("payment_request_missing", "Payment request not found.");
  if (item.status === "paid") return "paid";
  const summary = await findUnsettledTransactionByInvoice(item.reference);
  if (!summary) return "not_found";
  const details = await getTransactionDetails(summary.transId);
  if (details.invoiceNumber !== item.reference || mapTransactionOutcome(null, details) !== "approved") return "not_found";
  const result = await applyPaymentTransaction({
    reference: item.reference,
    transactionId: details.transId,
    outcome: "approved",
    details: transactionDetailsForApply(details),
    source: "status_check",
  });
  return result === "paid" || result === "already_paid" ? "paid" : "not_found";
}
