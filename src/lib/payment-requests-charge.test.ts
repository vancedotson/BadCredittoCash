import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(), demo: vi.fn(), findUnsettled: vi.fn(), details: vi.fn(), charge: vi.fn(),
}));
vi.mock("./supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("./demo", () => ({ isCrmDemoMode: mocks.demo }));
vi.mock("./authorize-net", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authorize-net")>();
  return { ...actual, findUnsettledTransactionByInvoice: mocks.findUnsettled, getTransactionDetails: mocks.details, chargeOpaqueData: mocks.charge };
});

import { AuthorizeNetConfigError, AuthorizeNetError, AuthorizeNetTransportError } from "./authorize-net";
import { chargePaymentRequest, checkPaymentRequestStatus, createPaymentRequest } from "./payment-requests";

const contactId = "ef4a6410-8716-495e-b3be-70a54c8e1598";
const actorId = "dc76c552-e1d0-49f7-8242-cb458bdb729b";
const requestId = "c8f29a0f-0585-4b02-a5fc-e9bf2db660a5";
const token = "a".repeat(43);

describe("manual card charges", () => {
  const chargeItem = { id: requestId, kind: "charge", reference: "CRP-ABCDEFGH", linkToken: token, status: "open", events: [] };
  const input = {
    contactId, actorId, actorName: "Vance", amountCents: 15000, description: "Credit report review",
    opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "nonce" },
    customerEmail: "client@example.test", firstName: "Pat", lastName: "Client", customerIp: "203.0.113.9",
  };
  const approved = { transId: "6001", responseCode: 1, reason: "Approved.", authCode: "A", avs: "Y", cvv: "P", cardLast4: "1111", cardBrand: "Visa" };

  function rpcNames(): string[] { return mocks.rpc.mock.calls.map((call) => call[0] as string); }

  beforeEach(() => {
    vi.resetAllMocks();
    mocks.demo.mockReturnValue(false);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "create_payment_request_v1") return { data: chargeItem, error: null };
      if (name === "get_payment_request_v1") return { data: { ...chargeItem, status: "paid" }, error: null };
      if (name === "apply_payment_transaction_v1") return { data: "paid", error: null };
      return { data: true, error: null };
    });
  });

  it("creates the charge row first with p_kind charge, then applies an approval with source charge", async () => {
    mocks.charge.mockResolvedValue(approved);
    const response = await chargePaymentRequest(input);
    expect(rpcNames().slice(0, 2)).toEqual(["create_payment_request_v1", "apply_payment_transaction_v1"]);
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_kind: "charge", p_amount_cents: 15000, p_contact_id: contactId });
    expect(mocks.charge).toHaveBeenCalledWith(expect.objectContaining({
      reference: "CRP-ABCDEFGH", amountCents: 15000, opaqueData: input.opaqueData, customerIp: "203.0.113.9",
    }));
    expect(mocks.rpc).toHaveBeenCalledWith("apply_payment_transaction_v1", expect.objectContaining({
      p_reference: "CRP-ABCDEFGH", p_transaction_id: "6001", p_outcome: "approved", p_source: "charge",
      p_details: expect.objectContaining({ amountCents: 15000, cardLast4: "1111", cardBrand: "Visa", payerEmail: "client@example.test" }),
    }));
    expect(response).toMatchObject({ outcome: "approved", transactionId: "6001", cardLast4: "1111", reason: "Approved." });
    expect(response.item.status).toBe("paid");
  });

  it("does not send p_kind for ordinary link requests", async () => {
    mocks.rpc.mockResolvedValue({ data: chargeItem, error: null });
    await createPaymentRequest({ contactId, amountCents: 15000, description: "Review", actorId });
    expect(mocks.rpc.mock.calls[0][1]).not.toHaveProperty("p_kind");
  });

  it.each([
    [{ ...approved, transId: "0", responseCode: 2, reason: "This transaction has been declined." }, "declined"],
    [{ ...approved, transId: "6002", responseCode: 4, reason: "Held." }, "held"],
    [{ ...approved, transId: "0", responseCode: 1 }, "error"],
    [{ ...approved, transId: "6003", responseCode: 3, reason: "Error." }, "error"],
  ])("applies %j as %s", async (result, outcome) => {
    mocks.charge.mockResolvedValue(result);
    const response = await chargePaymentRequest(input);
    expect(mocks.rpc).toHaveBeenCalledWith("apply_payment_transaction_v1", expect.objectContaining({ p_outcome: outcome, p_source: "charge" }));
    expect(response.outcome).toBe(outcome);
    if (outcome !== "held") expect(response.transactionId).toBeNull();
  });

  it("records charge_unknown and never retries on a transport failure", async () => {
    mocks.charge.mockRejectedValue(new AuthorizeNetTransportError("NETWORK"));
    const response = await chargePaymentRequest(input);
    expect(response.outcome).toBe("unknown");
    expect(response.reason).toContain("may have been charged");
    expect(mocks.charge).toHaveBeenCalledTimes(1);
    expect(rpcNames()).not.toContain("apply_payment_transaction_v1");
    expect(rpcNames()).not.toContain("cancel_payment_request_v1");
    expect(mocks.rpc).toHaveBeenCalledWith("record_payment_request_event_v1", expect.objectContaining({
      p_request_id: requestId, p_action: "charge_unknown", p_details: { code: "NETWORK" },
    }));
  });

  it("treats an unexpected error as unknown, not as safe", async () => {
    mocks.charge.mockRejectedValue(new Error("boom"));
    expect((await chargePaymentRequest(input)).outcome).toBe("unknown");
    expect(rpcNames()).not.toContain("cancel_payment_request_v1");
  });

  it("records charge_failed and cancels the row when Authorize.net rejected the request before processing", async () => {
    mocks.charge.mockRejectedValue(new AuthorizeNetError("E00007"));
    const response = await chargePaymentRequest(input);
    expect(response).toMatchObject({ outcome: "error", transactionId: null });
    expect(response.reason).toContain("Nothing was charged");
    expect(mocks.rpc).toHaveBeenCalledWith("record_payment_request_event_v1", expect.objectContaining({ p_action: "charge_failed", p_details: { code: "E00007" } }));
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_payment_request_v1", { p_request_id: requestId, p_actor_id: actorId, p_contact_id: contactId });
  });

  it.each(["E00003", "E00008", "E00013", "E00014", "E00015"])("treats allowlisted provider code %s as definite", async (code) => {
    mocks.charge.mockRejectedValue(new AuthorizeNetError(code));
    const response = await chargePaymentRequest(input);
    expect(response.outcome).toBe("error");
    expect(mocks.rpc).toHaveBeenCalledWith("record_payment_request_event_v1", expect.objectContaining({ p_action: "charge_failed", p_details: { code } }));
    expect(rpcNames()).toContain("cancel_payment_request_v1");
  });

  it("treats a missing configuration as definite: Authorize.net was never called", async () => {
    mocks.charge.mockRejectedValue(new AuthorizeNetConfigError());
    const response = await chargePaymentRequest(input);
    expect(response.outcome).toBe("error");
    expect(mocks.rpc).toHaveBeenCalledWith("record_payment_request_event_v1", expect.objectContaining({ p_action: "charge_failed", p_details: { code: "CONFIG" } }));
  });

  it.each(["E00001", "E00053", "E00027", "E00114", "UNKNOWN"])(
    "treats provider code %s without a transactionResponse as unknown: charge_unknown, no cancel, no retry",
    async (code) => {
      mocks.charge.mockRejectedValue(new AuthorizeNetError(code));
      const response = await chargePaymentRequest(input);
      expect(response.outcome).toBe("unknown");
      expect(response.reason).toContain("may have been charged");
      expect(response.reason).not.toContain("Nothing was charged");
      expect(mocks.charge).toHaveBeenCalledTimes(1);
      expect(mocks.rpc).toHaveBeenCalledWith("record_payment_request_event_v1", expect.objectContaining({
        p_request_id: requestId, p_action: "charge_unknown", p_details: { code },
      }));
      expect(rpcNames()).not.toContain("cancel_payment_request_v1");
      expect(mocks.rpc).not.toHaveBeenCalledWith("record_payment_request_event_v1", expect.objectContaining({ p_action: "charge_failed" }));
    },
  );

  it("returns unknown when the approved result cannot be saved, so it is reconciled later", async () => {
    mocks.charge.mockResolvedValue(approved);
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "create_payment_request_v1") return { data: chargeItem, error: null };
      if (name === "apply_payment_transaction_v1") return { data: null, error: { message: "connection reset" } };
      if (name === "get_payment_request_v1") return { data: chargeItem, error: null };
      return { data: true, error: null };
    });
    const response = await chargePaymentRequest(input);
    expect(response.outcome).toBe("unknown");
    expect(response.reason).toContain("Check status");
    // The row is marked unresolved so the database blocks a second charge.
    expect(mocks.rpc).toHaveBeenCalledWith("record_payment_request_event_v1", expect.objectContaining({
      p_request_id: requestId, p_action: "charge_unknown", p_details: { code: "RESULT_NOT_SAVED" },
    }));
    expect(rpcNames()).not.toContain("cancel_payment_request_v1");
  });

  it("reloads the charge row by id through get_payment_request_v1, not the capped list", async () => {
    mocks.charge.mockResolvedValue(approved);
    await chargePaymentRequest(input);
    expect(mocks.rpc).toHaveBeenCalledWith("get_payment_request_v1", { p_request_id: requestId, p_contact_id: contactId, p_actor_id: actorId });
    expect(rpcNames()).not.toContain("list_payment_requests_v1");
  });

  it.each(["payment_charge_in_progress", "payment_charge_unresolved"])("surfaces %s before contacting Authorize.net, tagged as not started", async (code) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: code } });
    await expect(chargePaymentRequest(input)).rejects.toMatchObject({ code, chargeNotStarted: true });
    expect(mocks.charge).not.toHaveBeenCalled();
  });

  it("tags any row-creation failure as not started, including unexpected throws", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });
    await expect(chargePaymentRequest(input)).rejects.toMatchObject({ code: "payment_request_unavailable", chargeNotStarted: true });
    mocks.rpc.mockRejectedValue(new Error("fetch failed"));
    await expect(chargePaymentRequest(input)).rejects.toMatchObject({ code: "payment_request_unavailable", chargeNotStarted: true });
    expect(mocks.charge).not.toHaveBeenCalled();
  });

  it("is unavailable in demo mode", async () => {
    mocks.demo.mockReturnValue(true);
    await expect(chargePaymentRequest(input)).rejects.toThrow("unavailable in demo mode");
    await expect(checkPaymentRequestStatus(requestId, contactId, actorId)).rejects.toThrow("unavailable in demo mode");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.charge).not.toHaveBeenCalled();
  });
});

describe("payment status check", () => {
  const openItem = { id: requestId, kind: "charge", reference: "CRP-ABCDEFGH", status: "open" };
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.demo.mockReturnValue(false);
  });

  it("applies an approved unsettled transaction with source status_check", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "get_payment_request_v1"
      ? { data: openItem, error: null } : { data: "paid", error: null });
    mocks.findUnsettled.mockResolvedValue({ transId: "6001", transactionStatus: "capturedPendingSettlement", submitTimeUtc: null });
    mocks.details.mockResolvedValue({
      transId: "6001", transactionStatus: "capturedPendingSettlement", responseCode: 1, authAmountCents: 15000,
      invoiceNumber: "CRP-ABCDEFGH", cardType: "Visa", cardLast4: "1111", customerEmail: null, submitTimeUtc: null, reason: null,
    });
    await expect(checkPaymentRequestStatus(requestId, contactId, actorId)).resolves.toBe("paid");
    expect(mocks.rpc).toHaveBeenCalledWith("get_payment_request_v1", { p_request_id: requestId, p_contact_id: contactId, p_actor_id: actorId });
    expect(mocks.rpc).toHaveBeenCalledWith("apply_payment_transaction_v1", expect.objectContaining({
      p_reference: "CRP-ABCDEFGH", p_transaction_id: "6001", p_outcome: "approved", p_source: "status_check",
    }));
  });

  it("reports not_found without applying anything when Authorize.net has no approved transaction", async () => {
    mocks.rpc.mockResolvedValue({ data: openItem, error: null });
    mocks.findUnsettled.mockResolvedValue(null);
    await expect(checkPaymentRequestStatus(requestId, contactId, actorId)).resolves.toBe("not_found");
    expect(mocks.rpc).not.toHaveBeenCalledWith("apply_payment_transaction_v1", expect.anything());
  });

  it("does not ask Authorize.net about an already paid request and rejects unknown requests", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ...openItem, status: "paid" }, error: null });
    await expect(checkPaymentRequestStatus(requestId, contactId, actorId)).resolves.toBe("paid");
    expect(mocks.findUnsettled).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(checkPaymentRequestStatus(requestId, contactId, actorId)).rejects.toMatchObject({ code: "payment_request_missing" });
  });

  it("maps a non-staff actor from get_payment_request_v1 to its stable error", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "payment_request_actor_invalid" } });
    await expect(checkPaymentRequestStatus(requestId, contactId, actorId)).rejects.toMatchObject({ code: "payment_request_actor_invalid" });
    expect(mocks.findUnsettled).not.toHaveBeenCalled();
  });
});
