import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizeNetConfigError,
  AuthorizeNetError,
  AuthorizeNetTransportError,
  buildChargeRequest,
  chargeOpaqueData,
  mapChargeOutcome,
} from "./authorize-net";

const fetchMock = vi.fn();

function providerResponse(body: unknown, bom = true) {
  return new Response(`${bom ? "﻿" : ""}${JSON.stringify(body)}`, { status: 200, headers: { "content-type": "application/json" } });
}
const OK = { resultCode: "Ok", message: [{ code: "I00001", text: "Successful." }] };

function sentBody(index = 0): string {
  return String((fetchMock.mock.calls[index][1] as RequestInit).body);
}

const charge = {
  amountCents: 15000,
  reference: "CRP-ABCDEFGH",
  description: "Credit report review",
  opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "opaque-nonce-value" },
  customerEmail: "client@example.test",
  firstName: "Pat",
  lastName: "Client",
  customerIp: "203.0.113.9",
};
const APPROVED = {
  transactionResponse: {
    responseCode: "1", authCode: "ABC123", avsResultCode: "Y", cvvResultCode: "P", transId: "60001",
    accountNumber: "XXXX1111", accountType: "Visa", messages: [{ code: "1", description: "This transaction has been approved." }],
  },
  messages: OK,
};

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

describe("card charge (AcceptUI opaque data)", () => {
  it("posts createTransactionRequest in schema order with the opaque data and no card fields", async () => {
    fetchMock.mockResolvedValue(providerResponse(APPROVED));
    await chargeOpaqueData(charge);
    expect(fetchMock.mock.calls[0][0]).toBe("https://apitest.authorize.net/xml/v1/request.api");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = sentBody();
    const order = ['"merchantAuthentication"', '"refId"', '"transactionRequest"', '"transactionType"', '"amount"', '"payment"',
      '"opaqueData"', '"dataDescriptor"', '"dataValue"', '"order"', '"invoiceNumber"', '"customer"', '"billTo"', '"customerIP"', '"transactionSettings"'];
    const positions = order.map((key) => body.indexOf(key));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    const request = JSON.parse(body).createTransactionRequest;
    expect(request.transactionRequest).toMatchObject({
      transactionType: "authCaptureTransaction", amount: "150.00",
      payment: { opaqueData: charge.opaqueData },
      order: { invoiceNumber: "CRP-ABCDEFGH", description: "Credit report review" },
      customer: { type: "individual", email: "client@example.test" },
      billTo: { firstName: "Pat", lastName: "Client" }, customerIP: "203.0.113.9",
    });
    expect(request.refId).toBe("CRP-ABCDEFGH");
    expect(request.transactionRequest.transactionSettings.setting).toEqual([
      { settingName: "duplicateWindow", settingValue: "900" }, { settingName: "emailCustomer", settingValue: "true" },
    ]);
    expect(body).not.toMatch(/cardNumber|cardCode|expirationDate/);
  });

  it("omits optional customer fields and rejects a non-positive amount", () => {
    const request = buildChargeRequest(
      { ...charge, customerEmail: "not-an-email", firstName: null, lastName: null, customerIp: "bad ip" },
      { name: "n", transactionKey: "k" },
    );
    expect(Object.keys(request.createTransactionRequest.transactionRequest)).toEqual(
      ["transactionType", "amount", "payment", "order", "transactionSettings"]);
    expect(() => buildChargeRequest({ ...charge, amountCents: 0 }, { name: "n", transactionKey: "k" })).toThrow("Invalid amount.");
  });

  it("returns an approved transaction", async () => {
    fetchMock.mockResolvedValue(providerResponse(APPROVED));
    const result = await chargeOpaqueData(charge);
    expect(result).toEqual({
      transId: "60001", responseCode: 1, reason: "This transaction has been approved.", authCode: "ABC123",
      avs: "Y", cvv: "P", cardLast4: "1111", cardBrand: "Visa",
    });
    expect(mapChargeOutcome(result)).toBe("approved");
  });

  it("parses a decline that arrives as resultCode Error (E00027) with a transactionResponse", async () => {
    fetchMock.mockResolvedValue(providerResponse({
      transactionResponse: {
        responseCode: "2", transId: "0", accountNumber: "XXXX0002", accountType: "Visa",
        errors: [{ errorCode: "2", errorText: "This transaction has been declined." }],
      },
      messages: { resultCode: "Error", message: [{ code: "E00027", text: "The transaction was unsuccessful." }] },
    }));
    const result = await chargeOpaqueData(charge);
    expect(result).toMatchObject({ transId: "0", responseCode: 2, reason: "This transaction has been declined.", cardLast4: "0002" });
    expect(mapChargeOutcome(result)).toBe("declined");
  });

  it("maps a fraud hold to held and other codes to error", async () => {
    fetchMock.mockResolvedValue(providerResponse({
      transactionResponse: { responseCode: "4", transId: "60002", messages: [{ code: "253", description: "Held for review." }] },
      messages: OK,
    }));
    const held = await chargeOpaqueData(charge);
    expect(mapChargeOutcome(held)).toBe("held");
    expect(mapChargeOutcome({ responseCode: 3, transId: "60003" })).toBe("error");
    expect(mapChargeOutcome({ responseCode: 2, transId: "0" })).toBe("declined");
  });

  it("treats an approval with transaction id 0 (sandbox Test Mode) as an error, never a payment", async () => {
    fetchMock.mockResolvedValue(providerResponse({
      transactionResponse: { responseCode: "1", transId: "0", messages: [{ code: "1", description: "Approved." }] },
      messages: OK,
    }));
    const result = await chargeOpaqueData(charge);
    expect(result.reason).toContain("test mode");
    expect(mapChargeOutcome(result)).toBe("error");
  });

  it("throws a definite error only when there is no transactionResponse", async () => {
    fetchMock.mockResolvedValue(providerResponse({ messages: { resultCode: "Error", message: [{ code: "E00007", text: "User authentication failed." }] } }));
    const error = await chargeOpaqueData(charge).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(AuthorizeNetError);
    expect(error).not.toBeInstanceOf(AuthorizeNetTransportError);
    expect((error as AuthorizeNetError).code).toBe("E00007");
  });

  it.each([
    ["a network failure", () => fetchMock.mockRejectedValue(new TypeError("fetch failed"))],
    ["an HTTP 500", () => fetchMock.mockResolvedValue(new Response("oops", { status: 500 }))],
    ["an unparseable body", () => fetchMock.mockResolvedValue(new Response("<html>", { status: 200 }))],
    ["an Ok response without a transactionResponse", () => fetchMock.mockResolvedValue(providerResponse({ messages: OK }))],
    ["a transactionResponse without an id", () => fetchMock.mockResolvedValue(providerResponse({ transactionResponse: { responseCode: "1" }, messages: OK }))],
  ])("reports an UNKNOWN outcome (transport error) for %s", async (_name, arrange) => {
    arrange();
    await expect(chargeOpaqueData(charge)).rejects.toBeInstanceOf(AuthorizeNetTransportError);
  });

  it.each([
    ["PAYMENTS_ENABLED", "false"],
    ["AUTHNET_ENV", "Sandbox"],
    ["AUTHNET_API_LOGIN_ID", ""],
    ["AUTHNET_TRANSACTION_KEY", ""],
    ["AUTHNET_PUBLIC_CLIENT_KEY", ""],
  ])("throws a config error before any network call when %s is %j", async (name, value) => {
    vi.stubEnv(name, value);
    await expect(chargeOpaqueData(charge)).rejects.toBeInstanceOf(AuthorizeNetConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never logs or leaks credentials or the opaque data", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
    fetchMock.mockResolvedValue(providerResponse({ messages: { resultCode: "Error", message: [{ code: "E00007", text: "User authentication failed." }] } }));
    const error = await chargeOpaqueData(charge).catch((cause: unknown) => cause);
    const text = JSON.stringify({ message: (error as Error).message, code: (error as AuthorizeNetError).code, logs: spies.map((spy) => spy.mock.calls) });
    for (const secret of ["test-transaction-key", "test-login", "test-signature-key", "test-client-key", "opaque-nonce-value"]) {
      expect(text).not.toContain(secret);
    }
    spies.forEach((spy) => spy.mockRestore());
  });
});
