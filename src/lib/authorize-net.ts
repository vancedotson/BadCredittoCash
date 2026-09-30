import "server-only";

import {
  AUTHORIZE_NET_ENDPOINTS,
  authorizeNetConfigured,
  authorizeNetEnvironment,
  type AuthorizeNetEnvironment,
} from "./authorize-net-config";

/**
 * Server-only Authorize.net JSON API client for Accept Hosted.
 *
 * The JSON API is derived from the XML schema and is ORDER-SENSITIVE: every
 * request object below is written literally in schema order. Do not sort keys,
 * spread objects, or build requests from arbitrary maps. Responses begin with
 * a UTF-8 BOM that must be removed before JSON.parse.
 *
 * Never log request bodies, credentials, or provider responses. Log codes only.
 *
 * Facts that still need sandbox confirmation are isolated and marked
 * "plan section 9" (duplicateWindow, unsettled-list shape).
 */

export class AuthorizeNetError extends Error {
  constructor(readonly code: string, message = "Authorize.net request failed.") {
    super(message);
    this.name = "AuthorizeNetError";
  }
}
/** E00040: the record cannot be found (for example, webhook "Test" pings). */
export class AuthorizeNetNotFoundError extends AuthorizeNetError {
  constructor(message = "Authorize.net record not found.") {
    super("E00040", message);
    this.name = "AuthorizeNetNotFoundError";
  }
}
export class AuthorizeNetConfigError extends Error {
  constructor() {
    super("Authorize.net is not configured.");
    this.name = "AuthorizeNetConfigError";
  }
}

// Plan section 9.11: duplicateWindow (seconds). Whether a declined attempt
// counts toward it is unknown. If a sandbox retry after a ZIP-forced decline is
// rejected as a duplicate (response reason 11), lower this to the default 120.
export const AUTHORIZE_NET_DUPLICATE_WINDOW_SECONDS = 900;

export const APPROVED_TRANSACTION_STATUSES = new Set(["capturedPendingSettlement", "settledSuccessfully"]);
const HELD_TRANSACTION_STATUSES = new Set(["FDSPendingReview", "FDSAuthorizedPendingReview"]);
const DECLINED_TRANSACTION_STATUSES = new Set(["declined"]);
const ERROR_TRANSACTION_STATUSES = new Set(["generalError", "failedReview", "couldNotVoid", "expired"]);
const VOIDED_TRANSACTION_STATUSES = new Set(["voided"]);
const REFUND_TRANSACTION_STATUSES = new Set(["refundPendingSettlement", "refundSettledSuccessfully"]);

type Credentials = { environment: AuthorizeNetEnvironment; name: string; transactionKey: string };

function credentials(): Credentials {
  const environment = authorizeNetEnvironment();
  const name = process.env.AUTHNET_API_LOGIN_ID?.trim();
  const transactionKey = process.env.AUTHNET_TRANSACTION_KEY?.trim();
  if (!authorizeNetConfigured() || !environment || !name || !transactionKey) throw new AuthorizeNetConfigError();
  return { environment, name, transactionKey };
}

function merchantAuthentication(creds: Credentials) {
  return { name: creds.name, transactionKey: creds.transactionKey };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/**
 * Transport-level failure: the request may or may not have reached Authorize.net
 * (network error, timeout, non-2xx, unparseable body). For a charge this means
 * the outcome is UNKNOWN and the charge must never be retried automatically.
 */
export class AuthorizeNetTransportError extends AuthorizeNetError {
  constructor(code: string) {
    super(code, "Authorize.net could not be reached.");
    this.name = "AuthorizeNetTransportError";
  }
}

type RawResponse = Record<string, unknown> & { messages: Record<string, unknown> };

function firstMessage(messages: Record<string, unknown>): { code: string; text: string | undefined } {
  const first = Array.isArray(messages.message) && isRecord(messages.message[0]) ? messages.message[0] : {};
  const code = typeof first.code === "string" && /^[A-Z0-9_]{1,20}$/.test(first.code) ? first.code : "UNKNOWN";
  const text = typeof first.text === "string" ? first.text.slice(0, 200) : undefined;
  return { code, text };
}

/**
 * POST one JSON request and return the parsed body, including provider-level
 * errors (resultCode "Error"). Only transport failures throw. Callers that need
 * the transactionResponse of a declined charge use this directly.
 */
export async function apiRequestRaw(body: object): Promise<RawResponse> {
  const creds = credentials();
  let response: Response;
  try {
    response = await fetch(AUTHORIZE_NET_ENDPOINTS[creds.environment].api, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new AuthorizeNetTransportError("NETWORK");
  }
  if (!response.ok) throw new AuthorizeNetTransportError(`HTTP_${response.status}`);
  let text: string;
  try { text = (await response.text()).replace(/^﻿/, ""); } catch { throw new AuthorizeNetTransportError("NETWORK"); }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new AuthorizeNetTransportError("INVALID_JSON"); }
  const messages = isRecord(parsed) && isRecord(parsed.messages) ? parsed.messages : null;
  if (!isRecord(parsed) || !messages) throw new AuthorizeNetTransportError("INVALID_RESPONSE");
  return parsed as RawResponse;
}

/** POST one JSON request to the configured environment's API endpoint. */
export async function apiRequest<T>(body: object): Promise<T> {
  const parsed = await apiRequestRaw(body);
  if (parsed.messages.resultCode !== "Ok") {
    const { code, text } = firstMessage(parsed.messages);
    if (code === "E00040") throw new AuthorizeNetNotFoundError(text);
    throw new AuthorizeNetError(code, text);
  }
  return parsed as T;
}

function hostedSetting(settingName: string, value: object) {
  return { settingName, settingValue: JSON.stringify(value) };
}

export type HostedPaymentInput = {
  amountCents: number;
  reference: string;
  description: string;
  customerEmail?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  returnUrl: string;
  cancelUrl: string;
};

function clip(value: string | null | undefined, max: number): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** Build getHostedPaymentPageRequest in schema order. Exported for tests. */
export function buildHostedPaymentPageRequest(input: HostedPaymentInput, creds: { name: string; transactionKey: string }) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Invalid amount.");
  const email = clip(input.customerEmail, 255);
  const firstName = clip(input.firstName, 50);
  const lastName = clip(input.lastName, 50);
  const transactionRequest = {
    transactionType: "authCaptureTransaction",
    // The only float conversion for money in this feature.
    amount: (input.amountCents / 100).toFixed(2),
    order: { invoiceNumber: input.reference, description: input.description.slice(0, 255) },
    ...(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { customer: { type: "individual", email } } : {}),
    ...(firstName || lastName ? { billTo: { ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}) } } : {}),
    transactionSettings: {
      setting: [
        { settingName: "duplicateWindow", settingValue: String(AUTHORIZE_NET_DUPLICATE_WINDOW_SECONDS) },
        { settingName: "emailCustomer", settingValue: "true" },
      ],
    },
  };
  return {
    getHostedPaymentPageRequest: {
      merchantAuthentication: { name: creds.name, transactionKey: creds.transactionKey },
      refId: input.reference,
      transactionRequest,
      hostedPaymentSettings: {
        setting: [
          hostedSetting("hostedPaymentReturnOptions", {
            showReceipt: true, url: input.returnUrl, urlText: "Return to Vance Dotson",
            cancelUrl: input.cancelUrl, cancelUrlText: "Cancel",
          }),
          hostedSetting("hostedPaymentButtonOptions", { text: "Pay" }),
          hostedSetting("hostedPaymentOrderOptions", { show: true, merchantName: "Vance Dotson" }),
          hostedSetting("hostedPaymentPaymentOptions", { cardCodeRequired: true, showCreditCard: true, showBankAccount: false }),
          hostedSetting("hostedPaymentBillingAddressOptions", { show: true, required: false }),
          hostedSetting("hostedPaymentCustomerOptions", { showEmail: true, requiredEmail: true, addPaymentProfile: false }),
          hostedSetting("hostedPaymentShippingAddressOptions", { show: false, required: false }),
          hostedSetting("hostedPaymentSecurityOptions", { captcha: false }),
        ],
      },
    },
  };
}

/** Request a short-lived (about 15 minutes) Accept Hosted form token. */
export async function createHostedPaymentToken(input: HostedPaymentInput): Promise<{ token: string; hostedFormUrl: string }> {
  const creds = credentials();
  const response = await apiRequest<{ token?: unknown }>(buildHostedPaymentPageRequest(input, merchantAuthentication(creds)));
  const token = typeof response.token === "string" ? response.token : "";
  if (!token || token.length > 4096) throw new AuthorizeNetError("MISSING_TOKEN");
  return { token, hostedFormUrl: AUTHORIZE_NET_ENDPOINTS[creds.environment].hostedForm };
}

export type ChargeInput = {
  amountCents: number;
  reference: string;
  description: string;
  /** Accept.js / AcceptUI payment nonce. Never log it. */
  opaqueData: { dataDescriptor: string; dataValue: string };
  customerEmail?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  customerIp?: string | null;
};

export type ChargeResult = {
  transId: string;
  responseCode: number;
  reason: string | null;
  authCode: string | null;
  avs: string | null;
  cvv: string | null;
  cardLast4: string | null;
  cardBrand: string | null;
};

/** Build createTransactionRequest in schema order. Exported for tests. */
export function buildChargeRequest(input: ChargeInput, creds: { name: string; transactionKey: string }) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Invalid amount.");
  const email = clip(input.customerEmail, 255);
  const firstName = clip(input.firstName, 50);
  const lastName = clip(input.lastName, 50);
  const customerIp = clip(input.customerIp, 45);
  return {
    createTransactionRequest: {
      merchantAuthentication: { name: creds.name, transactionKey: creds.transactionKey },
      refId: input.reference,
      transactionRequest: {
        transactionType: "authCaptureTransaction",
        amount: (input.amountCents / 100).toFixed(2),
        payment: { opaqueData: { dataDescriptor: input.opaqueData.dataDescriptor, dataValue: input.opaqueData.dataValue } },
        order: { invoiceNumber: input.reference, description: input.description.slice(0, 255) },
        ...(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { customer: { type: "individual", email } } : {}),
        ...(firstName || lastName ? { billTo: { ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}) } } : {}),
        ...(customerIp && /^[0-9a-fA-F:.]+$/.test(customerIp) ? { customerIP: customerIp } : {}),
        transactionSettings: {
          setting: [
            { settingName: "duplicateWindow", settingValue: String(AUTHORIZE_NET_DUPLICATE_WINDOW_SECONDS) },
            { settingName: "emailCustomer", settingValue: "true" },
          ],
        },
      },
    },
  };
}

function firstText(list: unknown, key: string): string | null {
  const first = Array.isArray(list) && isRecord(list[0]) ? list[0] : null;
  return first ? stringValue(first[key])?.slice(0, 255) ?? null : null;
}

/**
 * Provider-level error codes (resultCode "Error" with no transactionResponse)
 * that mean the request was rejected while being authenticated or validated,
 * before any transaction could be attempted, so nothing was charged:
 *   E00003 request could not be parsed
 *   E00007 authentication failed (invalid API login or transaction key)
 *   E00008 the account or API user is inactive
 *   E00013 a field value is invalid
 *   E00014 a required field is missing
 *   E00015 a field length is invalid
 * Deliberately excluded: E00001 (internal error) and E00053 (server busy) and
 * any other or unrecognised code, because they do not guarantee the card was
 * not charged. E00027 normally arrives WITH a transactionResponse and is
 * handled there; without one it is treated as unknown. Keep this list small: a
 * code wrongly listed here lets staff charge the card a second time.
 */
export const DEFINITE_CHARGE_REJECTION_CODES: ReadonlySet<string> = new Set([
  "E00003", "E00007", "E00008", "E00013", "E00014", "E00015",
]);

/**
 * True only when a charge error proves nothing was charged: Authorize.net was
 * never called (missing configuration) or it rejected the request with a code
 * from DEFINITE_CHARGE_REJECTION_CODES. Everything else is an unknown outcome.
 */
export function isDefiniteChargeRejection(error: unknown): boolean {
  if (error instanceof AuthorizeNetConfigError) return true;
  return error instanceof AuthorizeNetError
    && !(error instanceof AuthorizeNetTransportError)
    && DEFINITE_CHARGE_REJECTION_CODES.has(error.code);
}

/**
 * Charge a card through an opaque-data nonce. Declines arrive as resultCode
 * "Error" (E00027) WITH a transactionResponse, so the transactionResponse is
 * parsed before any error is thrown. Throws AuthorizeNetTransportError when the
 * outcome is unknown, and AuthorizeNetError when Authorize.net answered without
 * any transactionResponse. Only codes in DEFINITE_CHARGE_REJECTION_CODES prove
 * that nothing was charged; see isDefiniteChargeRejection.
 */
export async function chargeOpaqueData(input: ChargeInput): Promise<ChargeResult> {
  const creds = credentials();
  const parsed = await apiRequestRaw(buildChargeRequest(input, merchantAuthentication(creds)));
  const transaction = isRecord(parsed.transactionResponse) ? parsed.transactionResponse : null;
  if (!transaction) {
    if (parsed.messages.resultCode === "Ok") throw new AuthorizeNetTransportError("INVALID_RESPONSE");
    const { code, text } = firstMessage(parsed.messages);
    throw new AuthorizeNetError(code, text);
  }
  const transId = stringValue(transaction.transId);
  const responseCode = Number(stringValue(transaction.responseCode));
  if (!transId || !/^[A-Za-z0-9_-]{1,64}$/.test(transId) || !Number.isInteger(responseCode)) {
    throw new AuthorizeNetTransportError("INVALID_RESPONSE");
  }
  let reason = firstText(transaction.errors, "errorText") ?? firstText(transaction.messages, "description");
  // Sandbox "Test Mode" approves everything with transaction id 0 and charges nothing.
  if (responseCode === 1 && transId === "0") reason = "Authorize.net test mode is on; nothing was charged.";
  return {
    transId,
    responseCode,
    reason,
    authCode: stringValue(transaction.authCode)?.slice(0, 20) ?? null,
    avs: stringValue(transaction.avsResultCode)?.slice(0, 5) ?? null,
    cvv: stringValue(transaction.cvvResultCode)?.slice(0, 5) ?? null,
    cardLast4: stringValue(transaction.accountNumber)?.match(/(\d{4})$/)?.[1] ?? null,
    cardBrand: stringValue(transaction.accountType)?.slice(0, 40) ?? null,
  };
}

export type ChargeOutcome = "approved" | "declined" | "error" | "held";

/** An approval with transaction id 0 is Test Mode and is an error, never a payment. */
export function mapChargeOutcome(result: Pick<ChargeResult, "responseCode" | "transId">): ChargeOutcome {
  if (result.responseCode === 1) return result.transId === "0" ? "error" : "approved";
  if (result.responseCode === 2) return "declined";
  if (result.responseCode === 4) return "held";
  return "error";
}

/** The detail keys apply_payment_transaction_v1 reads, for a charge response. */
export function chargeDetailsForApply(result: ChargeResult, amountCents: number, payerEmail: string | null) {
  return {
    amountCents,
    transactionStatus: null,
    cardBrand: result.cardBrand,
    cardLast4: result.cardLast4,
    payerEmail,
    submittedAt: null,
    responseCode: result.responseCode,
    reason: result.reason,
  };
}

export type TransactionDetails = {
  transId: string;
  transactionType: string | null;
  transactionStatus: string | null;
  responseCode: number | null;
  authAmountCents: number | null;
  settleAmountCents: number | null;
  invoiceNumber: string | null;
  description: string | null;
  customerEmail: string | null;
  cardType: string | null;
  cardLast4: string | null;
  submitTimeUtc: string | null;
  reason: string | null;
};

/** Decimal dollars from the provider to integer cents without float math. */
export function dollarsToCents(value: unknown): number | null {
  const text = stringValue(value)?.trim();
  const match = text?.match(/^(\d{1,9})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** Provider UTC timestamps sometimes omit the zone designator. */
export function normalizeUtcTimestamp(value: unknown): string | null {
  const text = stringValue(value)?.trim();
  if (!text || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/.test(text)) return null;
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(text) ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeTransactionDetails(transaction: unknown): TransactionDetails {
  if (!isRecord(transaction)) throw new AuthorizeNetError("INVALID_RESPONSE");
  const transId = stringValue(transaction.transId);
  if (!transId || !/^[A-Za-z0-9_-]{1,64}$/.test(transId)) throw new AuthorizeNetError("INVALID_RESPONSE");
  const order = isRecord(transaction.order) ? transaction.order : {};
  const customer = isRecord(transaction.customer) ? transaction.customer : {};
  const payment = isRecord(transaction.payment) ? transaction.payment : {};
  const card = isRecord(payment.creditCard) ? payment.creditCard : {};
  const responseCode = Number(stringValue(transaction.responseCode));
  const cardNumber = stringValue(card.cardNumber);
  return {
    transId,
    transactionType: stringValue(transaction.transactionType)?.slice(0, 60) ?? null,
    transactionStatus: stringValue(transaction.transactionStatus)?.slice(0, 60) ?? null,
    responseCode: Number.isInteger(responseCode) ? responseCode : null,
    authAmountCents: dollarsToCents(transaction.authAmount),
    settleAmountCents: dollarsToCents(transaction.settleAmount),
    invoiceNumber: stringValue(order.invoiceNumber)?.slice(0, 20) ?? null,
    description: stringValue(order.description)?.slice(0, 255) ?? null,
    customerEmail: stringValue(customer.email)?.slice(0, 254) ?? null,
    cardType: stringValue(card.cardType)?.slice(0, 40) ?? null,
    cardLast4: cardNumber?.match(/(\d{4})$/)?.[1] ?? null,
    submitTimeUtc: normalizeUtcTimestamp(transaction.submitTimeUTC),
    reason: stringValue(transaction.responseReasonDescription)?.slice(0, 255) ?? null,
  };
}

export async function getTransactionDetails(transId: string): Promise<TransactionDetails> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(transId)) throw new AuthorizeNetError("INVALID_TRANSACTION_ID");
  const creds = credentials();
  const response = await apiRequest<{ transaction?: unknown }>({
    getTransactionDetailsRequest: {
      merchantAuthentication: merchantAuthentication(creds),
      transId,
    },
  });
  return normalizeTransactionDetails(response.transaction);
}

type UnsettledSummary = { transId: string; transactionStatus: string; submitTimeUtc: string | null; invoiceNumber: string };

// Plan section 9.6 (medium confidence): the unsettled list is expected as
// `transactions: [...]`; the XML-shaped `transactions: { transaction: [...] }`
// is also accepted. Anything else degrades to "not found" (the webhook still
// confirms the payment).
export function unsettledTransactionSummaries(response: unknown): UnsettledSummary[] {
  if (!isRecord(response)) return [];
  const container = response.transactions;
  const list = Array.isArray(container) ? container
    : isRecord(container) && Array.isArray(container.transaction) ? container.transaction : [];
  return list.flatMap((entry): UnsettledSummary[] => {
    if (!isRecord(entry)) return [];
    const transId = stringValue(entry.transId);
    const transactionStatus = stringValue(entry.transactionStatus);
    const invoiceNumber = stringValue(entry.invoiceNumber);
    if (!transId || !transactionStatus || !invoiceNumber) return [];
    return [{ transId, transactionStatus, invoiceNumber, submitTimeUtc: normalizeUtcTimestamp(entry.submitTimeUTC) }];
  });
}

/** Newest approved unsettled transaction for our invoice number, or null. */
export async function findUnsettledTransactionByInvoice(reference: string): Promise<{ transId: string; transactionStatus: string; submitTimeUtc: string | null } | null> {
  const creds = credentials();
  const response = await apiRequest<unknown>({
    getUnsettledTransactionListRequest: {
      merchantAuthentication: merchantAuthentication(creds),
      sorting: { orderBy: "submitTimeUTC", orderDescending: true },
      paging: { limit: 100, offset: 1 },
    },
  });
  const match = unsettledTransactionSummaries(response)
    .filter((entry) => entry.invoiceNumber === reference && APPROVED_TRANSACTION_STATUSES.has(entry.transactionStatus))
    .sort((a, b) => (b.submitTimeUtc ?? "").localeCompare(a.submitTimeUtc ?? ""))[0];
  return match ? { transId: match.transId, transactionStatus: match.transactionStatus, submitTimeUtc: match.submitTimeUtc } : null;
}

export type PaymentOutcome = "approved" | "declined" | "error" | "held" | "voided" | "refunded";

/**
 * Map a webhook event (or null for the return-page check) plus the confirmed
 * transaction details to the outcome applied by apply_payment_transaction_v1.
 */
export function mapTransactionOutcome(eventType: string | null, details: TransactionDetails): PaymentOutcome | null {
  if (eventType === "net.authorize.payment.void.created") return "voided";
  if (eventType === "net.authorize.payment.refund.created") return "refunded";
  if (eventType === "net.authorize.payment.fraud.declined") return "declined";
  const status = details.transactionStatus ?? "";
  if (eventType === "net.authorize.payment.fraud.held") return "held";
  if (HELD_TRANSACTION_STATUSES.has(status) || details.responseCode === 4) return "held";
  if (APPROVED_TRANSACTION_STATUSES.has(status) && details.responseCode === 1) return "approved";
  if (DECLINED_TRANSACTION_STATUSES.has(status) || details.responseCode === 2) return "declined";
  if (ERROR_TRANSACTION_STATUSES.has(status) || details.responseCode === 3) return "error";
  if (VOIDED_TRANSACTION_STATUSES.has(status)) return "voided";
  if (REFUND_TRANSACTION_STATUSES.has(status)) return "refunded";
  return null;
}

/** The detail keys apply_payment_transaction_v1 reads. */
export function transactionDetailsForApply(details: TransactionDetails) {
  return {
    amountCents: details.authAmountCents ?? details.settleAmountCents,
    transactionStatus: details.transactionStatus,
    cardBrand: details.cardType,
    cardLast4: details.cardLast4,
    payerEmail: details.customerEmail,
    submittedAt: details.submitTimeUtc,
    responseCode: details.responseCode,
    reason: details.reason,
  };
}
