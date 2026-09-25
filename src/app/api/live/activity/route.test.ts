import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enabled: vi.fn(), session: vi.fn(), participant: vi.fn(), rate: vi.fn(), rpc: vi.fn(), admin: vi.fn(), verifyToken: vi.fn() }));
vi.mock("@/lib/live-webinars", () => ({ liveWebinarsEnabled: mocks.enabled, getPublicLiveWebinarSession: mocks.session, resolveLiveParticipant: mocks.participant }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/public-api", async (original) => ({ ...await original<typeof import("@/lib/public-api")>(), consumePublicRateLimit: mocks.rate }));
vi.mock("@/lib/live-webinar-token", () => ({ verifyLiveParticipantToken: mocks.verifyToken, liveParticipantCookie: (id: string) => `vance-live-${id}` }));

import { POST } from "./route";
import { GET as join } from "../join/route";
import { GET as sessionInfo } from "../session/route";
import { GET as calendar } from "../calendar/route";

const origin = "https://example.test";
const sessionId = "20000000-0000-4000-8000-000000000001";
const registrationId = "20000000-0000-4000-8000-000000000002";
const session = { id: sessionId, title: "Live workshop", slug: "live-workshop", status: "scheduled", startsAt: "2030-10-12T12:00:00Z", endsAt: "2030-10-12T13:00:00Z", timezone: "UTC", scheduleVersion: 2 };
const claims = { registrationId, sessionId, accessVersion: 1, expiresAt: Date.parse("2030-11-12T12:00:00Z") };
const activity = { sessionId, event: "live_question_asked", clientEventId: "question-submission-123", props: { question: "How do I keep a record?" } };
function request(body: unknown = activity, headers: Record<string, string> = {}) { return new Request(`${origin}/api/live/activity`, { method: "POST", headers: { origin, "content-type": "application/json", ...headers }, body: JSON.stringify(body) }); }

beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.session.mockResolvedValue(session);
  mocks.participant.mockResolvedValue(claims);
  mocks.rate.mockResolvedValue(true);
  mocks.rpc.mockResolvedValue({ data: { id: "event" }, error: null });
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.verifyToken.mockReturnValue(claims);
});

describe("live activity authorization and durable acknowledgement", () => {
  it("blocks globally disabled activity before any database operation", async () => {
    mocks.enabled.mockReturnValue(false);
    expect((await POST(request())).status).toBe(503);
    expect(mocks.rate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects cross-site submissions", async () => {
    expect((await POST(request(activity, { origin: "https://unrelated.test" }))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { ...activity, props: { ...activity.props, preview: true } },
    { ...activity, preview: true },
  ])("rejects explicit preview requests", async (body) => {
    expect((await POST(request(body))).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects requests originating from a preview page", async () => {
    expect((await POST(request(activity, { referer: `${origin}/live/room?session=${sessionId}&state=live` }))).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([null, [], { ...activity, sessionId: "forged" }, { ...activity, event: "call_booked" }, { ...activity, clientEventId: "bad" }, { ...activity, props: { question: "x" } }, { ...activity, props: { question: "x".repeat(1001) } }])("rejects malformed or privileged activity", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not accept a caller-supplied contact or registration identity", async () => {
    mocks.participant.mockResolvedValue(null);
    const response = await POST(request({ ...activity, registrationId, email: "victim@example.test" }));
    expect(response.status).toBe(401);
    expect(mocks.participant).toHaveBeenCalledWith(sessionId);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("replaces forged metadata with the verified session and participant", async () => {
    const response = await POST(request({ ...activity, registrationId: "other", props: { ...activity.props, sessionId: "other", sessionTitle: "Fake", email: "victim@example.test" } }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("update_live_webinar_activity_v1", { p_registration_id: registrationId, p_session_id: sessionId, p_access_version: 1, p_event_key: "live_question_asked", p_client_event_id: activity.clientEventId, p_properties: { question: activity.props.question, funnel: "live", sessionId, sessionTitle: session.title } });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("acknowledges only successful durable persistence", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private database details" } });
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ ok: false });
  });

  it("preserves the submission key across retries", async () => {
    await POST(request()); await POST(request());
    expect(mocks.rpc.mock.calls.map((call) => call[1].p_client_event_id)).toEqual([activity.clientEventId, activity.clientEventId]);
  });

  it("does not record activity for cancelled or unknown sessions", async () => {
    mocks.session.mockResolvedValue({ ...session, status: "cancelled" });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects legacy replay-open events now that replay is permanently disabled", async () => {
    const response = await POST(request({ ...activity, event: "live_replay_opened" }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("joining links and public session metadata", () => {
  it("rejects forged tokens before resolving any participant", async () => {
    mocks.verifyToken.mockReturnValue(null);
    expect((await join(new Request(`${origin}/api/live/join?token=forged`))).status).toBe(401);
    expect(mocks.participant).not.toHaveBeenCalled();
  });

  it("rejects a revoked registration even with a valid signature", async () => {
    mocks.participant.mockResolvedValue(null);
    const response = await join(new Request(`${origin}/api/live/join?token=valid`));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("always redirects valid joining links to the live room and uses a scoped HTTP-only cookie", async () => {
    const response = await join(new Request(`${origin}/api/live/join?token=valid&replay=1&redirect=https://unrelated.test`));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(`${origin}/live/room?session=${sessionId}`);
    expect(response.headers.get("set-cookie")).toContain(`vance-live-${sessionId}=valid`);
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(response.headers.get("set-cookie")).toMatch(/Secure/i);
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns only safe participant identifiers and never a token", async () => {
    const response = await sessionInfo(new Request(`${origin}/api/live/session?session=${sessionId}`));
    const result = await response.json();
    expect(result.participant).toEqual({ registrationId, sessionId });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("exports the exact session version and cancellation state in calendar files", async () => {
    mocks.session.mockResolvedValue({ ...session, title: "Workshop\r\nBEGIN:VEVENT", status: "cancelled" });
    const response = await calendar(new Request(`${origin}/api/live/calendar?session=${sessionId}`));
    const text = await response.text();
    expect(text).toContain("SEQUENCE:2");
    expect(text).toContain("STATUS:CANCELLED");
    expect(text.match(/\r\nBEGIN:VEVENT/g)).toHaveLength(1);
  });
});
