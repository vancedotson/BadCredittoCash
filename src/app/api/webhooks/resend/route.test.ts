import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    webhooks = { verify: mocks.verify };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { POST } from "./route";

function request(body = "{}", headers: Record<string, string> = {}) {
  return new Request("https://example.test/api/webhooks/resend", {
    method: "POST",
    body,
    headers: {
      "svix-id": "evt_test_1",
      "svix-timestamp": "1786644000",
      "svix-signature": "v1,test-signature",
      ...headers,
    },
  });
}

describe("Resend webhook integration", () => {
  beforeEach(() => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "test-secret");
    vi.stubEnv("EMAIL_MODE", "test");
    mocks.rpc.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rejects a declared oversized payload before verification", async () => {
    const response = await POST(request("{}", { "content-length": String(256 * 1024 + 1) }));
    expect(response.status).toBe(413);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("returns unavailable when the signing secret is missing", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("rejects a webhook with an invalid signature", async () => {
    mocks.verify.mockImplementation(() => { throw new Error("bad signature"); });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("acknowledges unsupported events without touching the database", async () => {
    mocks.verify.mockReturnValue({
      type: "domain.created",
      created_at: "2026-08-13T12:00:00.000Z",
      data: { email_id: "email_1" },
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, ignored: true });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("applies a verified delivery event through the database RPC", async () => {
    mocks.verify.mockReturnValue({
      type: "email.delivered",
      created_at: "2026-08-13T12:00:00.000Z",
      data: { email_id: "email_1" },
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith("apply_resend_email_event", {
      p_event_id: "evt_test_1",
      p_event_type: "email.delivered",
      p_provider_message_id: "email_1",
      p_occurred_at: "2026-08-13T12:00:00.000Z",
      p_details: {},
      p_allow_suppression: false,
    });
  });

  it("returns a retryable error when the database update fails", async () => {
    mocks.verify.mockReturnValue({
      type: "email.bounced",
      created_at: "2026-08-13T12:00:00.000Z",
      data: { email_id: "email_1", bounce: { message: "Mailbox unavailable", type: "hard" } },
    });
    mocks.rpc.mockResolvedValue({ error: { code: "database_error" } });
    const response = await POST(request());
    expect(response.status).toBe(500);
  });
});
