import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), demo: vi.fn(), prepare: vi.fn(), client: vi.fn(), from: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireCrmApiUser: mocks.auth }));
vi.mock("@/lib/demo", () => ({ isCrmDemoMode: mocks.demo }));
vi.mock("@/lib/cloudflare-stream", () => ({ prepareCloudflareLiveInput: mocks.prepare }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/audit", () => ({ recordAdminAudit: mocks.audit }));

import { POST } from "./route";

const sessionId = "20000000-0000-4000-8000-000000000001";
const inputId = "0123456789abcdef0123456789abcdef";
const stream = {
  liveInputId: inputId,
  publishUrl: "https://customer-ab12.cloudflarestream.com/secret/webRTC/publish",
  embedUrl: `https://customer-ab12.cloudflarestream.com/${inputId}/webRTC/play`,
};
const query = {
  select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), update: vi.fn(),
};

function request() { return new Request(`https://example.test/api/crm/live-webinars/${sessionId}/stream`, { method: "POST", headers: { origin: "https://example.test" } }); }

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { sub: "staff", crmRole: "staff" }, response: Response.json({ error: "Administrator access required." }, { status: 403 }) });
  mocks.demo.mockReturnValue(false);
  mocks.prepare.mockResolvedValue(stream);
  mocks.client.mockResolvedValue({ from: mocks.from });
  mocks.from.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: { id: sessionId, title: "Private workshop", cloudflare_live_input_id: null }, error: null });
  query.update.mockImplementation(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
});

describe("Cloudflare broadcast preparation authorization", () => {
  it.each([
    { label: "non-admin CRM writer", user: { sub: "staff", crmRole: "staff" }, status: 403 },
    { label: "read-only CRM user", user: { sub: "reader", crmRole: "readonly" }, status: 403 },
    { label: "unauthenticated visitor", user: null, status: 401 },
  ])("rejects $label before reading a session or calling the provider", async ({ user, status }) => {
    mocks.auth.mockResolvedValue({ user, response: Response.json({ error: "Not authorized." }, { status }) });
    const input = request();
    expect((await POST(input, { params: Promise.resolve({ id: sessionId }) })).status).toBe(status);
    expect(mocks.auth).toHaveBeenCalledWith(input, "admin-write");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("prepares the exact session's input and returns private no-store stream controls", async () => {
    mocks.auth.mockResolvedValue({ user: { sub: "admin", crmRole: "admin" }, response: null });
    const response = await POST(request(), { params: Promise.resolve({ id: sessionId }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual(stream);
    expect(mocks.prepare).toHaveBeenCalledWith({ sessionId, title: "Private workshop", liveInputId: null });
    expect(query.update).toHaveBeenCalledWith({ stream_provider: "cloudflare", cloudflare_live_input_id: inputId, embed_url: stream.embedUrl });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin", action: "live_webinar.stream_prepared", entityId: sessionId }));
  });

  it("reuses the session's already-linked input on a repeated prepare request", async () => {
    mocks.auth.mockResolvedValue({ user: { sub: "admin", crmRole: "admin" }, response: null });
    query.maybeSingle.mockResolvedValue({ data: { id: sessionId, title: "Private workshop", cloudflare_live_input_id: inputId }, error: null });

    const response = await POST(request(), { params: Promise.resolve({ id: sessionId }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.prepare).toHaveBeenCalledTimes(1);
    expect(mocks.prepare).toHaveBeenCalledWith({ sessionId, title: "Private workshop", liveInputId: inputId });
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ cloudflare_live_input_id: inputId }));
    expect(mocks.audit).toHaveBeenCalledTimes(1);
  });

  it("omits publish and playback endpoints from a prepare-only response", async () => {
    mocks.auth.mockResolvedValue({ user: { sub: "admin", crmRole: "admin" }, response: null });

    const response = await POST(new Request("https://example.test/api/crm/live-webinars/session/stream", {
      method: "POST",
      headers: { "x-stream-preparation-only": "1" },
    }), { params: Promise.resolve({ id: sessionId }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ liveInputId: inputId });
  });

  it("keeps demo mode disabled before reading the session or calling Stream", async () => {
    mocks.auth.mockResolvedValue({ user: { sub: "admin", crmRole: "admin" }, response: null });
    mocks.demo.mockReturnValue(true);

    const response = await POST(request(), { params: Promise.resolve({ id: sessionId }) });

    expect(response.status).toBe(409);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("rejects malformed session identifiers before database or provider access", async () => {
    mocks.auth.mockResolvedValue({ user: { sub: "admin", crmRole: "admin" }, response: null });
    expect((await POST(request(), { params: Promise.resolve({ id: "invalid" }) })).status).toBe(400);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
});
