import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), demo: vi.fn(), createClient: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
  configured: vi.fn(), charge: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireCrmApiUser: mocks.auth }));
vi.mock("@/lib/demo", () => ({ isCrmDemoMode: mocks.demo }));
vi.mock("@/lib/audit", () => ({ recordAdminAudit: mocks.audit }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/authorize-net-config", () => ({ authorizeNetConfigured: mocks.configured }));
vi.mock("@/lib/payment-requests", () => ({ chargePaymentRequest: mocks.charge }));

import { POST } from "./route";

const contactId = "11111111-1111-4111-8111-111111111111";
const context = { params: Promise.resolve({ id: contactId }) };
const item = { id: "22222222-2222-4222-8222-222222222222", kind: "charge", reference: "CRP-ABCDEFGH", linkToken: "secret-token", status: "paid" };
const validBody = {
  amount: "150.00",
  description: "Credit report review",
  confirm: true,
  opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "eyJjb2RlIjoiNTBfMl8wNjAwMDUyNyJ9" },
};

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost:3000/api/crm/contact/${contactId}/payment-requests/charge`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("CRM card charge route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.demo.mockReturnValue(false);
    mocks.configured.mockReturnValue(true);
    mocks.auth.mockResolvedValue({ user: { sub: "crm-user", crmRole: "staff", displayName: "Vance" }, response: null });
    mocks.createClient.mockResolvedValue({ from: mocks.from });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({ data: { id: contactId, email: "client@example.test", name: "Pat Client" }, error: null });
    mocks.audit.mockResolvedValue(undefined);
    mocks.charge.mockResolvedValue({ item, outcome: "approved", reason: "Approved.", transactionId: "6001", cardLast4: "1111" });
  });

  it("requires CRM write access before anything else", async () => {
    mocks.auth.mockResolvedValue({ user: null, response: Response.json({ error: "Authentication required." }, { status: 401 }) });
    const request = post(validBody);
    expect((await POST(request, context)).status).toBe(401);
    expect(mocks.auth).toHaveBeenCalledWith(request, "write");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.charge).not.toHaveBeenCalled();
  });

  it("rejects read-only users", async () => {
    mocks.auth.mockResolvedValue({ user: null, response: Response.json({ error: "This account has read-only access." }, { status: 403 }) });
    const response = await POST(post(validBody), context);
    expect(response.status).toBe(403);
    expect(mocks.charge).not.toHaveBeenCalled();
  });

  it("is unavailable in demo mode or when payments are not configured", async () => {
    mocks.demo.mockReturnValue(true);
    expect((await POST(post(validBody), context)).status).toBe(503);
    mocks.demo.mockReturnValue(false);
    mocks.configured.mockReturnValue(false);
    expect((await POST(post(validBody), context)).status).toBe(503);
    expect(mocks.charge).not.toHaveBeenCalled();
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("rejects a malformed contact id and non-JSON bodies", async () => {
    expect((await POST(post(validBody), { params: Promise.resolve({ id: "not-a-uuid" }) })).status).toBe(404);
    const plain = new Request("http://localhost:3000/x", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(validBody) });
    expect((await POST(plain, context)).status).toBe(400);
    expect((await POST(post("{not json"), context)).status).toBe(400);
    expect((await POST(post(JSON.stringify([validBody])), context)).status).toBe(400);
    expect(mocks.charge).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies", async () => {
    const huge = { ...validBody, padding: "x".repeat(9000) };
    expect((await POST(post(huge), context)).status).toBe(413);
    expect(mocks.charge).not.toHaveBeenCalled();
  });

  it.each([
    ["missing confirm", { ...validBody, confirm: undefined }],
    ["confirm not true", { ...validBody, confirm: "true" }],
    ["zero amount", { ...validBody, amount: "0.00" }],
    ["too many decimals", { ...validBody, amount: "1.234" }],
    ["over the maximum", { ...validBody, amount: "25000.01" }],
    ["short description", { ...validBody, description: "ab" }],
    ["control characters in the description", { ...validBody, description: "bad\u0007text" }],
    ["a card number typed into the description", { ...validBody, description: "Card 4111 1111 1111 1111 for review" }],
    ["missing opaque data", { ...validBody, opaqueData: undefined }],
    ["wrong descriptor", { ...validBody, opaqueData: { dataDescriptor: "COMMON.VCO.ONLINE.PAYMENT", dataValue: "abc" } }],
    ["empty data value", { ...validBody, opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "" } }],
    ["oversized data value", { ...validBody, opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "a".repeat(4097) } }],
    ["whitespace in the data value", { ...validBody, opaqueData: { dataDescriptor: "COMMON.ACCEPT.INAPP.PAYMENT", dataValue: "ab cd" } }],
    ["invalid billTo", { ...validBody, billTo: { firstName: 5 } }],
  ])("rejects %s before contacting the contact store or Authorize.net", async (_name, body) => {
    const response = await POST(post(body), context);
    expect(response.status).toBe(400);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.charge).not.toHaveBeenCalled();
  });

  it.each([
    ["cardNumber", { cardNumber: "4111111111111111" }],
    ["card_number", { card_number: "4111111111111111" }],
    ["cvv", { cvv: "123" }],
    ["cardCode", { cardCode: "123" }],
    ["expirationDate", { expirationDate: "2030-12" }],
    ["expDate", { expDate: "1230" }],
    ["accountNumber", { accountNumber: "123456789" }],
    ["a nested creditCard object", { payment: { creditCard: { number: "4111" } } }],
    ["a nested cardNumber inside opaqueData", { opaqueData: { ...validBody.opaqueData, cardNumber: "4111111111111111" } }],
  ])("rejects raw card data keys (%s) with 400 and never echoes them", async (_name, extra) => {
    const response = await POST(post({ ...validBody, ...extra }), context);
    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).not.toContain("4111");
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.charge).not.toHaveBeenCalled();
  });

  it("returns 404 for contacts the user cannot see and fails closed when access cannot be checked", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await POST(post(validBody), context)).status).toBe(404);
    mocks.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "private database details" } });
    const response = await POST(post(validBody), context);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database");
    expect(mocks.from).toHaveBeenCalledWith("contacts");
    expect(mocks.eq).toHaveBeenCalledWith("id", contactId);
    expect(mocks.charge).not.toHaveBeenCalled();
  });

  it("charges through the service with the contact, Cloudflare IP and audits without opaque data", async () => {
    const response = await POST(post(validBody, { "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1" }), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({
      item: { ...item, linkToken: "" }, outcome: "approved", reason: "Approved.", transactionId: "6001", cardLast4: "1111",
    });
    expect(mocks.charge).toHaveBeenCalledWith({
      contactId, actorId: "crm-user", actorName: "Vance", amountCents: 15000, description: "Credit report review",
      opaqueData: validBody.opaqueData, customerEmail: "client@example.test", firstName: null, lastName: null, customerIp: "203.0.113.9",
    });
    expect(mocks.audit).toHaveBeenCalledTimes(1);
    const audit = mocks.audit.mock.calls[0][0];
    expect(audit).toMatchObject({ actorId: "crm-user", action: "payment_request.charge", entityType: "payment_request", entityId: item.id });
    expect(JSON.stringify(audit)).not.toContain(validBody.opaqueData.dataValue);
    expect(audit.afterState).toEqual({ amountCents: 15000, reference: "CRP-ABCDEFGH", outcome: "approved" });
  });

  it("ignores user-controlled forwarding headers when Cloudflare supplies no client IP", async () => {
    await POST(post(validBody, { "x-forwarded-for": "198.51.100.1" }), context);
    expect(mocks.charge.mock.calls[0][0].customerIp).toBeNull();
  });

  it("passes billTo names and reports declined, held and unknown outcomes", async () => {
    mocks.charge.mockResolvedValue({ item, outcome: "unknown", reason: "The result is unknown.", transactionId: null, cardLast4: null });
    const response = await POST(post({ ...validBody, billTo: { firstName: " Pat ", lastName: "Client" } }), context);
    expect(response.status).toBe(200);
    expect((await response.json()).outcome).toBe("unknown");
    expect(mocks.charge.mock.calls[0][0]).toMatchObject({ firstName: "Pat", lastName: "Client" });
  });

  function notStarted(message: string, code: string) {
    return Object.assign(new Error(message), { code, chargeNotStarted: true });
  }

  it("maps the in-progress guard to 409", async () => {
    mocks.charge.mockRejectedValue(notStarted("in progress", "payment_charge_in_progress"));
    const response = await POST(post(validBody), context);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("Check its status");
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("maps an unresolved earlier charge to a distinct 409", async () => {
    mocks.charge.mockRejectedValue(notStarted("unresolved", "payment_charge_unresolved"));
    const response = await POST(post(validBody), context);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toContain("unknown result");
    expect(body.error).toContain("Check status");
    expect(body).not.toHaveProperty("outcome");
  });

  it("says nothing was charged only when the failure happened before Authorize.net was called", async () => {
    mocks.charge.mockRejectedValue(notStarted("relation payment_requests does not exist", "payment_request_unavailable"));
    const response = await POST(post(validBody), context);
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).toContain("Nothing was charged");
    expect(text).not.toContain("relation");
  });

  it.each([
    ["an untagged error", new Error("socket hang up")],
    ["an untagged error carrying a known code", Object.assign(new Error("x"), { code: "payment_charge_in_progress" })],
    ["a non-Error throw", "boom"],
  ])("reports an unknown outcome, never 'nothing was charged', for %s", async (_name, thrown) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.charge.mockRejectedValue(thrown);
    const response = await POST(post(validBody), context);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({ outcome: "unknown", item: null, transactionId: null });
    expect(body).not.toHaveProperty("error");
    expect(JSON.stringify(body)).not.toContain("Nothing was charged");
    expect(body.reason).toContain("may have been charged");
  });

  it("allows ordinary long references in the description", async () => {
    const response = await POST(post({ ...validBody, description: "Invoice 20260929-123456" }), context);
    expect(response.status).toBe(200);
    expect(mocks.charge.mock.calls[0][0].description).toBe("Invoice 20260929-123456");
  });

  it("rejects a card number followed by a security code in the description", async () => {
    const response = await POST(post({ ...validBody, description: "Card 4111 1111 1111 1111 123" }), context);
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("4111");
    expect(mocks.charge).not.toHaveBeenCalled();
  });

  it("still returns the charge result when the audit write fails", async () => {
    mocks.audit.mockRejectedValue(new Error("audit down"));
    const response = await POST(post(validBody), context);
    expect(response.status).toBe(200);
    expect((await response.json()).outcome).toBe("approved");
  });
});
