import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), demo: vi.fn(), createClient: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
  list: vi.fn(), check: vi.fn(), audit: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireCrmApiUser: mocks.auth }));
vi.mock("@/lib/demo", () => ({ isCrmDemoMode: mocks.demo }));
vi.mock("@/lib/audit", () => ({ recordAdminAudit: mocks.audit }));
vi.mock("@/lib/email", () => ({ deliverPaymentRequestEmail: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/payment-requests", () => ({
  cancelPaymentRequest: vi.fn(),
  checkPaymentRequestStatus: mocks.check,
  createPaymentRequest: vi.fn(),
  listPaymentRequests: mocks.list,
  paymentLinkUrl: (token: string) => `https://creditrepairparty.com/pay/${token}`,
}));

import { GET, PATCH } from "./route";

const contactId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ id: contactId }) };
const linkItem = { id: requestId, kind: "link", linkToken: "a".repeat(43), status: "open", events: [] };
const chargeItem = { id: "33333333-3333-4333-8333-333333333333", kind: "charge", linkToken: "b".repeat(43), status: "paid", events: [] };

function get() { return new Request(`http://localhost:3000/api/crm/contact/${contactId}/payment-requests`); }
function patch(body: unknown) {
  return new Request(`http://localhost:3000/api/crm/contact/${contactId}/payment-requests`, {
    method: "PATCH", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify(body),
  });
}

describe("CRM payment requests route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.demo.mockReturnValue(false);
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    vi.stubEnv("AUTHNET_ENV", "sandbox");
    vi.stubEnv("AUTHNET_API_LOGIN_ID", "login-id");
    vi.stubEnv("AUTHNET_TRANSACTION_KEY", "transaction-key");
    vi.stubEnv("AUTHNET_SIGNATURE_KEY", "signature-key");
    vi.stubEnv("AUTHNET_PUBLIC_CLIENT_KEY", "client-key");
    mocks.auth.mockResolvedValue({ user: { sub: "crm-user", crmRole: "staff" }, response: null });
    mocks.createClient.mockResolvedValue({ from: mocks.from });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.maybeSingle.mockResolvedValue({ data: { id: contactId, email: "c@example.test", name: "Pat", email_suppressed_at: null }, error: null });
    mocks.list.mockResolvedValue([linkItem, chargeItem]);
    mocks.audit.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("gives AcceptUI settings to users who can charge, never NEXT_PUBLIC values", async () => {
    const body = await (await GET(get(), context)).json();
    expect(body.acceptUi).toEqual({ scriptUrl: "https://jstest.authorize.net/v3/AcceptUI.js", apiLoginId: "login-id", clientKey: "client-key" });
    expect(JSON.stringify(body)).not.toContain("transaction-key");
    expect(JSON.stringify(body)).not.toContain("signature-key");
  });

  it("withholds AcceptUI settings from read-only users, when disabled, and in demo mode", async () => {
    mocks.auth.mockResolvedValue({ user: { sub: "crm-user", crmRole: "readonly" }, response: null });
    expect((await (await GET(get(), context)).json()).acceptUi).toBeUndefined();
    mocks.auth.mockResolvedValue({ user: { sub: "crm-user", crmRole: "admin" }, response: null });
    vi.stubEnv("PAYMENTS_ENABLED", "false");
    const disabled = await (await GET(get(), context)).json();
    expect(disabled.acceptUi).toBeUndefined();
    expect(disabled.enabled).toBe(false);
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    mocks.demo.mockReturnValue(true);
    expect((await (await GET(get(), context)).json()).acceptUi).toBeUndefined();
  });

  it("withholds AcceptUI settings when the public client key is missing", async () => {
    vi.stubEnv("AUTHNET_PUBLIC_CLIENT_KEY", "");
    const body = await (await GET(get(), context)).json();
    expect(body.enabled).toBe(false);
    expect(body.acceptUi).toBeUndefined();
  });

  it("exposes a pay link for link rows but none for charge rows", async () => {
    const body = await (await GET(get(), context)).json();
    expect(body.items[0]).toMatchObject({ kind: "link", link: `https://creditrepairparty.com/pay/${"a".repeat(43)}` });
    expect(body.items[1]).toMatchObject({ kind: "charge", link: "", linkToken: "" });
  });

  it("checks a payment status for the contact and audits it", async () => {
    mocks.check.mockResolvedValue("paid");
    const response = await PATCH(patch({ id: requestId, action: "check_status" }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, result: "paid" });
    expect(mocks.check).toHaveBeenCalledWith(requestId, contactId, "crm-user");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "payment_request.check_status", entityId: requestId }));
  });

  it("fails a status check with a generic 503 when Authorize.net or the database is unavailable", async () => {
    mocks.check.mockRejectedValue(new Error("connect ETIMEDOUT"));
    const response = await PATCH(patch({ id: requestId, action: "check_status" }), context);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("ETIMEDOUT");
  });

  it("rejects unknown actions", async () => {
    expect((await PATCH(patch({ id: requestId, action: "refund" }), context)).status).toBe(400);
    expect(mocks.check).not.toHaveBeenCalled();
  });
});
