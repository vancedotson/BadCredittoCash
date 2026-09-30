/** Pure payment constants, parsing, and formatting. Safe for client and server. */

export const PAYMENT_MIN_CENTS = 100;
export const PAYMENT_MAX_CENTS = 2_500_000;
export const PAYMENT_DESCRIPTION_MIN = 3;
export const PAYMENT_DESCRIPTION_MAX = 255;

export type PaymentStatus = "open" | "paid" | "cancelled" | "failed";

export type PaymentRequestEvent = {
  action: string;
  actorName: string;
  createdAt: string;
  details: Record<string, unknown>;
};

export type PaymentRequestItem = {
  id: string;
  /** "charge" is a manual card charge (no client link); absent before the charge migration. */
  kind?: "link" | "charge";
  reference: string;
  linkToken: string;
  amountCents: number;
  currency: "USD";
  description: string;
  status: PaymentStatus;
  createdAt: string;
  createdByName: string;
  paidAt: string | null;
  transactionId: string | null;
  transactionStatus: string | null;
  paidAmountCents: number | null;
  cardBrand: string | null;
  cardLast4: string | null;
  payerEmail: string | null;
  failureReason: string | null;
  failedAt: string | null;
  heldTransactionId: string | null;
  cancelledAt: string | null;
  checkoutCount: number;
  lastCheckoutAt: string | null;
  emailSendCount: number;
  lastEmailQueuedAt: string | null;
  lastEmail: { status: string; scheduledFor: string; sentAt: string | null; lastError: string | null } | null;
  events: PaymentRequestEvent[];
};

/** What the public /pay page may know. Never includes the email or link token. */
export type PublicPaymentRequest = {
  id: string;
  reference: string;
  amountCents: number;
  currency: "USD";
  description: string;
  status: PaymentStatus;
  paidAt: string | null;
  transactionId: string | null;
  held: boolean;
  cancelledAt: string | null;
  contactFirstName: string | null;
  payable: boolean;
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  open: "Open",
  paid: "Paid",
  cancelled: "Cancelled",
  failed: "Declined",
};

/**
 * Parse a dollar amount typed by staff ("1,250.5", "$150", 150) into integer
 * cents. Rejects more than two decimals, zero or negative values, and anything
 * outside the allowed range. Uses string arithmetic, never floating point.
 */
export function parseUsdToCents(value: unknown): number | null {
  let text: string;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    text = String(value);
  } else if (typeof value === "string") {
    text = value;
  } else {
    return null;
  }
  text = text.trim().replace(/^\$\s*/, "");
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.replaceAll(",", "").split(".");
  if (whole.length > 9) return null;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < PAYMENT_MIN_CENTS || cents > PAYMENT_MAX_CENTS) return null;
  return cents;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatUsdCents(cents: number): string {
  return usd.format(cents / 100);
}

export function isPaymentLinkToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

/** Trimmed description, or null when empty, too long, or containing control characters. */
export function normalizePaymentDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length < PAYMENT_DESCRIPTION_MIN || text.length > PAYMENT_DESCRIPTION_MAX || /[\u0000-\u001f\u007f-\u009f]/.test(text)) return null;
  return text;
}

/** Matches the database's two-minute "charge in progress" window. */
export const CHARGE_IN_PROGRESS_MS = 2 * 60 * 1000;

/**
 * An open manual charge that may have charged the card: no charge_failed event,
 * and either a charge_unknown event or older than the two-minute in-progress
 * window (the Worker may have died before recording anything). The database
 * blocks new charges for the contact until it is checked or cancelled.
 */
export function isUnresolvedCharge(
  item: Pick<PaymentRequestItem, "kind" | "status" | "events" | "createdAt">,
  now: number = Date.now(),
): boolean {
  if (item.kind !== "charge" || item.status !== "open") return false;
  if (item.events.some((event) => event.action === "charge_failed")) return false;
  if (item.events.some((event) => event.action === "charge_unknown")) return true;
  const created = Date.parse(item.createdAt);
  // An unparseable timestamp is treated as old: blocking is the safe side.
  return !Number.isFinite(created) || now - created >= CHARGE_IN_PROGRESS_MS;
}

export type ChargeOutcome = "approved" | "declined" | "held" | "error" | "unknown";
const CHARGE_OUTCOMES: ReadonlySet<string> = new Set<ChargeOutcome>(["approved", "declined", "held", "error", "unknown"]);

export const CHARGE_UNKNOWN_MESSAGE = "The result could not be confirmed. The card may have been charged. Check the request below with Check status before trying again.";

export type ChargeResponseView =
  | { kind: "not_charged"; error: string }
  | { kind: "result"; outcome: ChargeOutcome; reason: string | null; transactionId: string | null; cardLast4: string | null; itemId: string | null };

/**
 * Interpret the charge route's response in the browser. A failed response
 * means "nothing was charged" ONLY when it is the route's own JSON error
 * (`error` string, no `outcome`). A Worker timeout, 502/504/524 or an HTML error
 * page can arrive after Authorize.net was called, so anything else is unknown.
 */
export function interpretChargeResponse(ok: boolean, payload: Record<string, unknown>): ChargeResponseView {
  const text = (value: unknown) => (typeof value === "string" && value ? value : null);
  const item = payload.item && typeof payload.item === "object" ? payload.item as { id?: unknown } : null;
  const itemId = text(item?.id);
  if (!ok && typeof payload.error === "string" && payload.error && payload.outcome === undefined) {
    return { kind: "not_charged", error: payload.error };
  }
  const outcome = ok && typeof payload.outcome === "string" && CHARGE_OUTCOMES.has(payload.outcome)
    ? payload.outcome as ChargeOutcome : "unknown";
  if (outcome === "unknown") {
    const reason = ok && payload.outcome === "unknown" ? text(payload.reason) : null;
    return { kind: "result", outcome, reason: reason ?? CHARGE_UNKNOWN_MESSAGE, transactionId: null, cardLast4: null, itemId };
  }
  return {
    kind: "result", outcome, reason: text(payload.reason), transactionId: text(payload.transactionId),
    cardLast4: text(payload.cardLast4), itemId,
  };
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let index = digits.length - 1, double = false; index >= 0; index -= 1, double = !double) {
    let digit = digits.charCodeAt(index) - 48;
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * True when the text contains what looks like a payment card number: a
 * Luhn-valid run of 13 to 19 digits, optionally grouped by single spaces or
 * hyphens. Group-aligned sub-runs are checked too, so a card number followed
 * by a security code ("4111 1111 1111 1111 123") is still caught. Ordinary
 * references such as "Invoice 20260929-123456" are allowed.
 */
export function containsCardNumber(value: string): boolean {
  for (const match of value.matchAll(/\d+(?:[ -]\d+)*/g)) {
    const groups = match[0].split(/[ -]/);
    for (let start = 0; start < groups.length; start += 1) {
      let digits = "";
      for (let end = start; end < groups.length && digits.length + groups[end].length <= 19; end += 1) {
        digits += groups[end];
        if (digits.length >= 13 && luhnValid(digits)) return true;
      }
    }
  }
  return false;
}
