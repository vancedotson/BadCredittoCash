import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), demo: vi.fn(), findUnsettled: vi.fn(), details: vi.fn(),
}));
vi.mock("./supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("./demo", () => ({ isCrmDemoMode: mocks.demo }));
vi.mock("./authorize-net", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authorize-net")>();
  return { ...actual, findUnsettledTransactionByInvoice: mocks.findUnsettled, getTransactionDetails: mocks.details };
});

import {
  PaymentRequestError,
  applyPaymentTransaction,
  beginPaymentCheckout,
  cancelPaymentRequest,
  confirmPaymentRequestFromProvider,
  createPaymentRequest,
  findPaymentRequestByToken,
  generatePaymentLinkToken,
  generatePaymentReference,
  listPaymentRequests,
  paymentLinkUrl,
} from "./payment-requests";

const contactId = "ef4a6410-8716-495e-b3be-70a54c8e1598";
const actorId = "dc76c552-e1d0-49f7-8242-cb458bdb729b";
const requestId = "c8f29a0f-0585-4b02-a5fc-e9bf2db660a5";
const token = "a".repeat(43);
const item = { id: requestId, reference: "CRP-ABCDEFGH", linkToken: token, status: "open", events: [] };
const found = { id: requestId, reference: "CRP-ABCDEFGH", status: "open", payable: true, held: false, amountCents: 15000 };

describe("payment reference and link token generation", () => {
  it("creates Authorize.net-safe references and 43-character tokens", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generatePaymentReference()).toMatch(/^CRP-[2-9A-HJKMNP-Z]{8}$/);
      expect(generatePaymentLinkToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
    expect(generatePaymentReference().length).toBeLessThanOrEqual(20);
  });

  it("builds the public link on the canonical origin", () => {
    expect(paymentLinkUrl(token)).toBe(`https://creditrepairparty.com/pay/${token}`);
  });
});

describe("payment request persistence adapter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.demo.mockReturnValue(false);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("creates through one RPC with a generated reference and token", async () => {
    mocks.rpc.mockResolvedValue({ data: item, error: null });
    await expect(createPaymentRequest({ contactId, amountCents: 15000, description: "Review", actorId })).resolves.toEqual(item);
    expect(mocks.rpc).toHaveBeenCalledWith("create_payment_request_v1", expect.objectContaining({
      p_contact_id: contactId, p_amount_cents: 15000, p_description: "Review", p_actor_id: actorId,
      p_reference: expect.stringMatching(/^CRP-[2-9A-HJKMNP-Z]{8}$/), p_link_token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    }));
  });

  it("retries a reference collision with a new reference", async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint \"payment_requests_reference_key\"" } })
      .mockResolvedValueOnce({ data: item, error: null });
    await expect(createPaymentRequest({ contactId, amountCents: 15000, description: "Review", actorId })).resolves.toEqual(item);
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc.mock.calls[0][1].p_reference).not.toBe(mocks.rpc.mock.calls[1][1].p_reference);
  });

  it("surfaces stable database error codes", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "payment_request_not_cancellable" } });
    const error = await cancelPaymentRequest(requestId, actorId, contactId).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(PaymentRequestError);
    expect((error as PaymentRequestError).code).toBe("payment_request_not_cancellable");
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_payment_request_v1", { p_request_id: requestId, p_actor_id: actorId, p_contact_id: contactId });
  });

  it("maps unknown database errors to a generic code", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });
    await expect(beginPaymentCheckout(token)).rejects.toMatchObject({ code: "payment_request_unavailable" });
  });

  it("lists, looks up, and applies through RPCs", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [item], error: null });
    await expect(listPaymentRequests(contactId)).resolves.toEqual([item]);
    mocks.rpc.mockResolvedValueOnce({ data: found, error: null });
    await expect(findPaymentRequestByToken(token)).resolves.toEqual(found);
    mocks.rpc.mockResolvedValueOnce({ data: "paid", error: null });
    await expect(applyPaymentTransaction({ reference: "CRP-ABCDEFGH", transactionId: "1", outcome: "approved", details: {}, source: "webhook" })).resolves.toBe("paid");
    expect(mocks.rpc).toHaveBeenLastCalledWith("apply_payment_transaction_v1", {
      p_reference: "CRP-ABCDEFGH", p_transaction_id: "1", p_outcome: "approved", p_details: {}, p_source: "webhook",
    });
  });

  it("does not query for malformed tokens", async () => {
    await expect(findPaymentRequestByToken("short")).resolves.toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps demo CRM isolated from live payment data", async () => {
    mocks.demo.mockReturnValue(true);
    await expect(listPaymentRequests(contactId)).resolves.toEqual([]);
    await expect(createPaymentRequest({ contactId, amountCents: 15000, description: "Review", actorId })).rejects.toThrow("unavailable in demo mode");
    await expect(cancelPaymentRequest(requestId, actorId, contactId)).rejects.toThrow("unavailable in demo mode");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("return-page provider confirmation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.demo.mockReturnValue(false);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("confirms an approved unsettled transaction and applies it idempotently", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "find_payment_request_by_token_v1"
      ? { data: found, error: null } : { data: "paid", error: null });
    mocks.findUnsettled.mockResolvedValue({ transId: "6001", transactionStatus: "capturedPendingSettlement", submitTimeUtc: null });
    mocks.details.mockResolvedValue({
      transId: "6001", transactionType: "authCaptureTransaction", transactionStatus: "capturedPendingSettlement", responseCode: 1,
      authAmountCents: 15000, settleAmountCents: null, invoiceNumber: "CRP-ABCDEFGH", description: null, customerEmail: "p@example.test",
      cardType: "Visa", cardLast4: "1111", submitTimeUtc: "2026-09-29T12:00:00.000Z", reason: null,
    });
    await expect(confirmPaymentRequestFromProvider(token)).resolves.toBe("paid");
    expect(mocks.findUnsettled).toHaveBeenCalledWith("CRP-ABCDEFGH");
    expect(mocks.rpc).toHaveBeenCalledWith("apply_payment_transaction_v1", expect.objectContaining({
      p_reference: "CRP-ABCDEFGH", p_transaction_id: "6001", p_outcome: "approved", p_source: "return_check",
      p_details: expect.objectContaining({ amountCents: 15000, cardLast4: "1111" }),
    }));
  });

  it("ignores a transaction whose confirmed invoice number differs", async () => {
    mocks.rpc.mockResolvedValue({ data: found, error: null });
    mocks.findUnsettled.mockResolvedValue({ transId: "6001", transactionStatus: "capturedPendingSettlement", submitTimeUtc: null });
    mocks.details.mockResolvedValue({ transId: "6001", transactionStatus: "capturedPendingSettlement", responseCode: 1, invoiceNumber: "CRP-OTHERXXX" });
    await expect(confirmPaymentRequestFromProvider(token)).resolves.toBe("pending");
    expect(mocks.rpc).not.toHaveBeenCalledWith("apply_payment_transaction_v1", expect.anything());
  });

  it("returns pending and swallows provider errors", async () => {
    mocks.rpc.mockResolvedValue({ data: found, error: null });
    mocks.findUnsettled.mockRejectedValue(Object.assign(new Error("boom"), { code: "E00007" }));
    await expect(confirmPaymentRequestFromProvider(token)).resolves.toBe("pending");
  });

  it("does not call the provider for paid or cancelled requests", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ...found, status: "paid", payable: false }, error: null });
    await expect(confirmPaymentRequestFromProvider(token)).resolves.toBe("paid");
    mocks.rpc.mockResolvedValueOnce({ data: { ...found, status: "cancelled", payable: false }, error: null });
    await expect(confirmPaymentRequestFromProvider(token)).resolves.toBe("not_applicable");
    expect(mocks.findUnsettled).not.toHaveBeenCalled();
  });
});
