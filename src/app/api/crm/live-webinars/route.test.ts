import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), demo: vi.fn(), client: vi.fn(), from: vi.fn(), insert: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(), audit: vi.fn(), sessions: vi.fn(), report: vi.fn(), enabled: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireCrmApiUser: mocks.auth }));
vi.mock("@/lib/demo", () => ({ isCrmDemoMode: mocks.demo }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/audit", () => ({ recordAdminAudit: mocks.audit }));
vi.mock("@/lib/live-webinars", () => ({ getLiveWebinarSessions: mocks.sessions, getLiveWebinarSessionReport: mocks.report, liveWebinarsEnabled: mocks.enabled, mapLiveSession: (row: unknown) => row }));

import { GET, POST } from "./route";

const origin = "https://example.test";
const sessionId = "20000000-0000-4000-8000-000000000001";
const session = { slug: "new-workshop", title: "New workshop", startsAt: "2030-10-12T12:00:00Z", endsAt: "2030-10-12T13:00:00Z", timezone: "UTC", status: "draft", embedUrl: null, replayUrl: null, replayPublished: false, replayAvailableUntil: null, automationEnabled: false };
function request(body: unknown = { session }) { return new Request(`${origin}/api/crm/live-webinars`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }); }

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { sub: "operator", crmRole: "staff" }, response: null });
  mocks.demo.mockReturnValue(false);
  mocks.enabled.mockReturnValue(false);
  mocks.sessions.mockResolvedValue([]);
  mocks.report.mockResolvedValue({ session: { id: sessionId }, registrations: [{ email: "private@example.test" }], stats: {} });
  mocks.client.mockResolvedValue({ from: mocks.from });
  mocks.from.mockReturnValue({ insert: mocks.insert, update: mocks.update });
  mocks.insert.mockReturnValue({ select: mocks.select });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ single: mocks.single });
  mocks.single.mockResolvedValue({ data: { id: sessionId }, error: null });
});

describe("CRM webinar authorization and lifecycle requests", () => {
  it("requires write authorization before processing a session change", async () => {
    mocks.auth.mockResolvedValue({ user: null, response: Response.json({ error: "This account has read-only access." }, { status: 403 }) });
    const input = request();
    expect((await POST(input)).status).toBe(403);
    expect(mocks.auth).toHaveBeenCalledWith(input, "write");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("blocks anonymous access to registration reports", async () => {
    mocks.auth.mockResolvedValue({ user: null, response: Response.json({ error: "Authentication required." }, { status: 401 }) });
    expect((await GET(new Request(`${origin}/api/crm/live-webinars?sessionId=${sessionId}`))).status).toBe(401);
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("allows readonly reporting with private no-store caching", async () => {
    mocks.auth.mockResolvedValue({ user: { sub: "reader", crmRole: "readonly" }, response: null });
    const response = await GET(new Request(`${origin}/api/crm/live-webinars?sessionId=${sessionId}`));
    expect(response.status).toBe(200);
    expect(mocks.report).toHaveBeenCalledWith(sessionId);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toContain("Cookie");
  });

  it("rejects invalid session IDs before reporting queries", async () => {
    expect((await GET(new Request(`${origin}/api/crm/live-webinars?sessionId=invalid`))).status).toBe(400);
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("keeps demonstration mode unable to write", async () => {
    mocks.demo.mockReturnValue(true);
    expect((await POST(request())).status).toBe(409);
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("allows a safe draft while site-wide live capture is disabled", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ status: "draft", automation_enabled: false }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ actorId: "operator", action: "live_webinar.created", entityId: sessionId }));
  });

  it("scopes an existing session update to its stable ID", async () => {
    const response = await POST(request({ session: { ...session, id: sessionId, startsAt: "2030-10-19T12:00:00Z", endsAt: "2030-10-19T13:00:00Z", scheduleVersion: 999, unexpectedAdminField: true } }));
    expect(response.status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("id", sessionId);
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("schedule_version");
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("unexpectedAdminField");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it.each([null, [], { session: { ...session, status: "scheduled" } }, { session: { ...session, embedUrl: "javascript:alert(1)" } }])("rejects invalid publishing requests before database writes", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("reports duplicate slugs without exposing database diagnostics", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: "23505", message: "private schema detail" } });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("private schema");
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
