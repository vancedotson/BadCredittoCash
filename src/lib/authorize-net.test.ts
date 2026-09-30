import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizeNetConfigError,
  AuthorizeNetError,
  AuthorizeNetNotFoundError,
  createHostedPaymentToken,
  dollarsToCents,
  findUnsettledTransactionByInvoice,
  getTransactionDetails,
  mapTransactionOutcome,
  normalizeUtcTimestamp,
  type TransactionDetails,
} from "./authorize-net";

const fetchMock = vi.fn();

function providerResponse(body: unknown, bom = true) {
  return new Response(`${bom ? "﻿" : ""}${JSON.stringify(body)}`, { status: 200, headers: { "content-type": "application/json" } });
}
const OK = { resultCode: "Ok", message: [{ code: "I00001", text: "Successful." }] };

function sentBody(index = 0): string {
  return String((fetchMock.mock.calls[index][1] as RequestInit).body);
}

const input = {
  amountCents: 15000,
  reference: "CRP-ABCDEFGH",
  description: "Credit report review",
  customerEmail: "client@example.test",
  firstName: "Pat",
  lastName: "Client",
  returnUrl: "https://creditrepairparty.com/api/pay/tok/return",
  cancelUrl: "https://creditrepairparty.com/pay/tok?state=cancelled",
};

function details(overrides: Partial<TransactionDetails> = {}): TransactionDetails {
  return {
    transId: "6001", transactionType: "authCaptureTransaction", transactionStatus: "capturedPendingSettlement",
    responseCode: 1, authAmountCents: 15000, settleAmountCents: 15000, invoiceNumber: "CRP-ABCDEFGH",
    description: null, customerEmail: null, cardType: "Visa", cardLast4: "1111", submitTimeUtc: null, reason: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.stubEnv("PAYMENTS_ENABLED", "true");
  vi.stubEnv("AUTHNET_ENV", "sandbox");
  vi.stubEnv("AUTHNET_API_LOGIN_ID", "test-login");
  vi.stubEnv("AUTHNET_TRANSACTION_KEY", "test-transaction-key");
  vi.stubEnv("AUTHNET_SIGNATURE_KEY", "test-signature-key");
  vi.stubEnv("AUTHNET_PUBLIC_CLIENT_KEY", "test-client-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Accept Hosted token request", () => {
  it("posts a schema-ordered request to the sandbox API and strips the BOM", async () => {
    fetchMock.mockResolvedValue(providerResponse({ token: "hosted-token", messages: OK }));
    await expect(createHostedPaymentToken(input)).resolves.toEqual({
      token: "hosted-token", hostedFormUrl: "https://test.authorize.net/payment/payment",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("https://apitest.authorize.net/xml/v1/request.api");
    expect((fetchMock.mock.calls[0][1] as RequestInit).cache).toBe("no-store");
    const body = sentBody();
    expect(body).toContain('"amount":"150.00"');
    expect(body).toContain('"invoiceNumber":"CRP-ABCDEFGH"');
    expect(body.indexOf('"merchantAuthentication"')).toBeLessThan(body.indexOf('"refId"'));
    expect(body.indexOf('"refId"')).toBeLessThan(body.indexOf('"transactionRequest"'));
    expect(body.indexOf('"transactionRequest"')).toBeLessThan(body.indexOf('"hostedPaymentSettings"'));
    expect(body.indexOf('"transactionType"')).toBeLessThan(body.indexOf('"amount"'));
    expect(body.indexOf('"order"')).toBeLessThan(body.indexOf('"customer"'));
    expect(body.indexOf('"customer"')).toBeLessThan(body.indexOf('"billTo"'));
    expect(body.indexOf('"billTo"')).toBeLessThan(body.indexOf('"transactionSettings"'));
    const parsed = JSON.parse(body);
    const settings = parsed.getHostedPaymentPageRequest.hostedPaymentSettings.setting as Array<{ settingName: string; settingValue: string }>;
    const returnOptions = JSON.parse(settings.find((setting) => setting.settingName === "hostedPaymentReturnOptions")!.settingValue);
    expect(returnOptions).toMatchObject({ url: input.returnUrl, cancelUrl: input.cancelUrl, showReceipt: true });
    expect(settings.every((setting) => typeof setting.settingValue === "string")).toBe(true);
    expect(parsed.getHostedPaymentPageRequest.transactionRequest.transactionSettings.setting).toContainEqual({ settingName: "duplicateWindow", settingValue: "900" });
  });

  it("uses the production endpoints only when configured exactly", async () => {
    vi.stubEnv("AUTHNET_ENV", "production");
    fetchMock.mockResolvedValue(providerResponse({ token: "t", messages: OK }, false));
    await expect(createHostedPaymentToken(input)).resolves.toMatchObject({ hostedFormUrl: "https://accept.authorize.net/payment/payment" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.authorize.net/xml/v1/request.api");
  });

  it.each([
    ["PAYMENTS_ENABLED", "false"],
    ["AUTHNET_ENV", "Production"],
    ["AUTHNET_API_LOGIN_ID", ""],
    ["AUTHNET_TRANSACTION_KEY", ""],
    ["AUTHNET_SIGNATURE_KEY", ""],
    ["AUTHNET_PUBLIC_CLIENT_KEY", ""],
  ])("throws before any network call when %s is %j", async (name, value) => {
    vi.stubEnv(name, value);
    await expect(createHostedPaymentToken(input)).rejects.toBeInstanceOf(AuthorizeNetConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws the provider error code without exposing the request", async () => {
    fetchMock.mockResolvedValue(providerResponse({ messages: { resultCode: "Error", message: [{ code: "E00007", text: "User authentication failed." }] } }));
    const error = await createHostedPaymentToken(input).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(AuthorizeNetError);
    expect((error as AuthorizeNetError).code).toBe("E00007");
    expect(String((error as Error).message)).not.toContain("test-transaction-key");
  });
});

describe("transaction details", () => {
  it("normalizes the confirmed transaction", async () => {
    fetchMock.mockResolvedValue(providerResponse({
      transaction: {
        transId: "60123", submitTimeUTC: "2026-09-29T12:00:00.123", transactionType: "authCaptureTransaction",
        transactionStatus: "capturedPendingSettlement", responseCode: 1, authAmount: 150.0, settleAmount: "150.00",
        order: { invoiceNumber: "CRP-ABCDEFGH", description: "Credit report review" },
        customer: { email: "payer@example.test" },
        payment: { creditCard: { cardNumber: "XXXX1111", cardType: "Visa" } },
      },
      messages: OK,
    }));
    await expect(getTransactionDetails("60123")).resolves.toEqual({
      transId: "60123", transactionType: "authCaptureTransaction", transactionStatus: "capturedPendingSettlement",
      responseCode: 1, authAmountCents: 15000, settleAmountCents: 15000, invoiceNumber: "CRP-ABCDEFGH",
      description: "Credit report review", customerEmail: "payer@example.test", cardType: "Visa", cardLast4: "1111",
      submitTimeUtc: "2026-09-29T12:00:00.123Z", reason: null,
    });
    expect(JSON.parse(sentBody()).getTransactionDetailsRequest.transId).toBe("60123");
  });

  it("maps E00040 to a not-found error", async () => {
    fetchMock.mockResolvedValue(providerResponse({ messages: { resultCode: "Error", message: [{ code: "E00040", text: "The record cannot be found." }] } }));
    await expect(getTransactionDetails("1")).rejects.toBeInstanceOf(AuthorizeNetNotFoundError);
  });

  it("rejects unsafe transaction ids before calling the provider", async () => {
    await expect(getTransactionDetails("1/2")).rejects.toBeInstanceOf(AuthorizeNetError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("unsettled transaction lookup", () => {
  it("returns the newest approved transaction for our invoice number", async () => {
    fetchMock.mockResolvedValue(providerResponse({
      transactions: [
        { transId: "1", invoiceNumber: "CRP-OTHERXXX", transactionStatus: "capturedPendingSettlement", submitTimeUTC: "2026-09-29T12:05:00Z" },
        { transId: "2", invoiceNumber: "CRP-ABCDEFGH", transactionStatus: "declined", submitTimeUTC: "2026-09-29T12:04:00Z" },
        { transId: "3", invoiceNumber: "CRP-ABCDEFGH", transactionStatus: "capturedPendingSettlement", submitTimeUTC: "2026-09-29T12:03:00Z" },
      ],
      messages: OK,
    }));
    await expect(findUnsettledTransactionByInvoice("CRP-ABCDEFGH")).resolves.toEqual({
      transId: "3", transactionStatus: "capturedPendingSettlement", submitTimeUtc: "2026-09-29T12:03:00.000Z",
    });
  });

  it("degrades to null when the list shape is absent", async () => {
    fetchMock.mockResolvedValue(providerResponse({ messages: OK }));
    await expect(findUnsettledTransactionByInvoice("CRP-ABCDEFGH")).resolves.toBeNull();
  });
});

describe("outcome mapping", () => {
  it.each([
    [null, details(), "approved"],
    ["net.authorize.payment.authcapture.created", details({ transactionStatus: "settledSuccessfully" }), "approved"],
    ["net.authorize.payment.authcapture.created", details({ transactionStatus: "declined", responseCode: 2 }), "declined"],
    ["net.authorize.payment.authcapture.created", details({ transactionStatus: "generalError", responseCode: 3 }), "error"],
    ["net.authorize.payment.authcapture.created", details({ transactionStatus: "FDSPendingReview", responseCode: 4 }), "held"],
    ["net.authorize.payment.fraud.held", details({ transactionStatus: "FDSAuthorizedPendingReview" }), "held"],
    ["net.authorize.payment.fraud.approved", details(), "approved"],
    ["net.authorize.payment.fraud.declined", details({ transactionStatus: "declined", responseCode: 2 }), "declined"],
    ["net.authorize.payment.void.created", details({ transactionStatus: "voided" }), "voided"],
    ["net.authorize.payment.refund.created", details({ transactionStatus: "refundPendingSettlement" }), "refunded"],
    ["net.authorize.payment.authcapture.created", details({ transactionStatus: "somethingNew", responseCode: null }), null],
  ] as const)("maps %s with the confirmed details", (eventType, value, expected) => {
    expect(mapTransactionOutcome(eventType, value)).toBe(expected);
  });
});

describe("provider value normalization", () => {
  it.each([["150.00", 15000], [150, 15000], ["0.5", 50], ["1.234", null], ["abc", null], [null, null]] as const)(
    "converts %s dollars to %s cents", (value, expected) => { expect(dollarsToCents(value)).toBe(expected); },
  );

  it("normalizes provider timestamps to ISO UTC", () => {
    expect(normalizeUtcTimestamp("2026-09-29T12:00:00")).toBe("2026-09-29T12:00:00.000Z");
    expect(normalizeUtcTimestamp("2026-09-29T12:00:00.5Z")).toBe("2026-09-29T12:00:00.500Z");
    expect(normalizeUtcTimestamp("yesterday")).toBeNull();
  });
});
