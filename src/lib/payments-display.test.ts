import { describe, expect, it } from "vitest";
import {
  CHARGE_UNKNOWN_MESSAGE,
  PAYMENT_MAX_CENTS,
  PAYMENT_MIN_CENTS,
  PAYMENT_STATUS_LABELS,
  containsCardNumber,
  formatUsdCents,
  interpretChargeResponse,
  isPaymentLinkToken,
  isUnresolvedCharge,
  normalizePaymentDescription,
  parseUsdToCents,
} from "./payments-display";

describe("payment amount parsing", () => {
  it.each([
    ["150", 15000],
    ["$150", 15000],
    ["$ 150.00", 15000],
    ["1,250.5", 125050],
    ["1,250.05", 125005],
    ["0.99", null],
    ["1", 100],
    ["25000", 2_500_000],
    ["25,000.00", 2_500_000],
    ["25000.01", null],
    ["12.345", null],
    ["$0", null],
    ["-5", null],
    ["1,25", null],
    ["12,3456", null],
    ["abc", null],
    ["", null],
    ["1e3", null],
    [150, 15000],
    [150.5, 15050],
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
    [null, null],
    [undefined, null],
  ] as const)("parses %s as %s", (input, expected) => {
    expect(parseUsdToCents(input)).toBe(expected);
  });

  it("keeps the configured bounds", () => {
    expect(PAYMENT_MIN_CENTS).toBe(100);
    expect(PAYMENT_MAX_CENTS).toBe(2_500_000);
  });
});

describe("payment display helpers", () => {
  it("formats integer cents as USD", () => {
    expect(formatUsdCents(15000)).toBe("$150.00");
    expect(formatUsdCents(2_500_000)).toBe("$25,000.00");
    expect(formatUsdCents(105)).toBe("$1.05");
  });

  it("recognises 43-character base64url link tokens only", () => {
    expect(isPaymentLinkToken("a".repeat(43))).toBe(true);
    expect(isPaymentLinkToken(`${"A-_".repeat(14)}z`)).toBe(true);
    expect(isPaymentLinkToken("a".repeat(42))).toBe(false);
    expect(isPaymentLinkToken(`${"a".repeat(42)}=`)).toBe(false);
    expect(isPaymentLinkToken(null)).toBe(false);
  });

  it("normalizes descriptions", () => {
    expect(normalizePaymentDescription("  Credit review  ")).toBe("Credit review");
    expect(normalizePaymentDescription("ab")).toBeNull();
    expect(normalizePaymentDescription("x".repeat(256))).toBeNull();
    expect(normalizePaymentDescription("line\nbreak")).toBeNull();
    expect(normalizePaymentDescription(42)).toBeNull();
  });

  it("labels a failed request as declined", () => {
    expect(PAYMENT_STATUS_LABELS.failed).toBe("Declined");
  });
});

describe("card numbers in descriptions", () => {
  it.each([
    "Card 4111 1111 1111 1111 for review",
    "4111-1111-1111-1111",
    "pay with 4111111111111111",
    "5555555555554444",
    "Amex 378282246310005",
    "4111 1111 1111 1111 123",
    "cvv 123 4111 1111 1111 1111",
  ])("rejects %s", (text) => {
    expect(containsCardNumber(text)).toBe(true);
  });

  it.each([
    "Invoice 20260929-123456",
    "Invoice 20260929 000001",
    "Order 1234567890123",
    "Case 12345678901234567",
    "Phone 555-123-4567, ref 2026-09-29",
    "4111 1111 1111 1112",
    "Credit report review",
  ])("allows %s", (text) => {
    expect(containsCardNumber(text)).toBe(false);
  });
});

describe("unresolved charges", () => {
  const unknownEvent = { action: "charge_unknown", actorName: "Vance", createdAt: "2026-09-29T12:00:00Z", details: {} };
  const failedEvent = { action: "charge_failed", actorName: "Vance", createdAt: "2026-09-29T12:00:05Z", details: {} };
  const createdAt = "2026-09-29T12:00:00Z";
  const now = Date.parse(createdAt);
  const fresh = now + 60_000;
  const stale = now + 2 * 60_000;

  it("flags an open charge with a charge_unknown event at any age", () => {
    expect(isUnresolvedCharge({ kind: "charge", status: "open", createdAt, events: [unknownEvent] }, fresh)).toBe(true);
    expect(isUnresolvedCharge({ kind: "charge", status: "open", createdAt, events: [unknownEvent] }, stale)).toBe(true);
  });

  it("flags an open charge with no marker once it is two minutes old (the Worker may have died mid-charge)", () => {
    expect(isUnresolvedCharge({ kind: "charge", status: "open", createdAt, events: [] }, fresh)).toBe(false);
    expect(isUnresolvedCharge({ kind: "charge", status: "open", createdAt, events: [] }, stale)).toBe(true);
    expect(isUnresolvedCharge({ kind: "charge", status: "open", createdAt: "not a date", events: [] }, fresh)).toBe(true);
  });

  it("never flags a charge with a charge_failed event, a closed row, or a link request", () => {
    expect(isUnresolvedCharge({ kind: "charge", status: "open", createdAt, events: [failedEvent, unknownEvent] }, stale)).toBe(false);
    expect(isUnresolvedCharge({ kind: "charge", status: "paid", createdAt, events: [unknownEvent] }, stale)).toBe(false);
    expect(isUnresolvedCharge({ kind: "charge", status: "failed", createdAt, events: [] }, stale)).toBe(false);
    expect(isUnresolvedCharge({ kind: "charge", status: "cancelled", createdAt, events: [unknownEvent] }, stale)).toBe(false);
    expect(isUnresolvedCharge({ kind: "link", status: "open", createdAt, events: [unknownEvent] }, stale)).toBe(false);
  });
});

describe("charge response interpretation", () => {
  it("treats only the route's own JSON error as nothing charged", () => {
    expect(interpretChargeResponse(false, { error: "Enter an amount." })).toEqual({ kind: "not_charged", error: "Enter an amount." });
    expect(interpretChargeResponse(false, { error: "Blocked." })).toMatchObject({ kind: "not_charged" });
  });

  it.each([
    ["an HTML or empty error page (Worker timeout, 502, 504, 524)", {}],
    ["a JSON body without an error string", { message: "Bad gateway" }],
    ["a non-string error", { error: { code: 524 } }],
    ["an empty error", { error: "" }],
    ["the route's unknown-outcome body", { outcome: "unknown", reason: "Server said so", item: null }],
    ["an error alongside an outcome", { error: "x", outcome: "approved" }],
  ])("treats %s as an unknown outcome", (_name, payload) => {
    expect(interpretChargeResponse(false, payload)).toEqual({
      kind: "result", outcome: "unknown", reason: CHARGE_UNKNOWN_MESSAGE, transactionId: null, cardLast4: null, itemId: null,
    });
  });

  it("reads successful outcomes and keeps the server's unknown reason", () => {
    expect(interpretChargeResponse(true, {
      outcome: "approved", reason: "Approved.", transactionId: "6001", cardLast4: "1111", item: { id: "req-1" },
    })).toEqual({ kind: "result", outcome: "approved", reason: "Approved.", transactionId: "6001", cardLast4: "1111", itemId: "req-1" });
    expect(interpretChargeResponse(true, { outcome: "unknown", reason: "Use Check status.", item: { id: "req-1" } }))
      .toMatchObject({ outcome: "unknown", reason: "Use Check status.", itemId: "req-1" });
  });

  it("treats a success response with a missing or strange outcome as unknown", () => {
    expect(interpretChargeResponse(true, {})).toMatchObject({ kind: "result", outcome: "unknown", reason: CHARGE_UNKNOWN_MESSAGE });
    expect(interpretChargeResponse(true, { outcome: "paid" })).toMatchObject({ outcome: "unknown" });
  });
});
