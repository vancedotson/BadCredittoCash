import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ enabled: vi.fn(), session: vi.fn(), rpc: vi.fn(), admin: vi.fn(), rate: vi.fn(), turnstile: vi.fn(), messages: vi.fn(), deliverLegacy: vi.fn(), deliverLive: vi.fn(), token: vi.fn(), secret: vi.fn() }));
vi.mock("@/lib/live-webinars", () => ({ liveWebinarsEnabled: mocks.enabled, getPublicLiveWebinarSession: mocks.session }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/public-api", async (original) => ({ ...await original<typeof import("@/lib/public-api")>(), consumePublicRateLimit: mocks.rate }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: mocks.turnstile }));
vi.mock("@/lib/email", () => ({ buildSequenceMessages: mocks.messages, deliverImmediateSequenceMessage: mocks.deliverLegacy, deliverLiveRegistrationConfirmation: mocks.deliverLive }));
vi.mock("@/lib/live-webinar-token", () => ({ createLiveParticipantToken: mocks.token, liveSigningSecret: mocks.secret, liveParticipantCookie: (id: string) => `vance-live-${id}` }));

import { POST } from "./route";

const origin = "https://example.test";
const sessionId = "20000000-0000-4000-8000-000000000001";
const nextSessionId = "20000000-0000-4000-8000-000000000003";
const registrationId = "20000000-0000-4000-8000-000000000002";
const liveLead = { name: "Returning Participant", email: "returning@example.test", sessionId, funnel: "live", timezone: "America/New_York", source: "vance-live-webinar" };
function request(body: unknown = liveLead, headers: Record<string, string> = {}) { return new Request(`${origin}/api/lead`, { method: "POST", headers: { origin, "content-type": "application/json", ...headers }, body: JSON.stringify(body) }); }

beforeEach(() => {
  vi.stubEnv("EMAIL_MODE", "production");
  vi.stubEnv("EVERGREEN_TRAINING_ENABLED", "true");
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(true);
  mocks.session.mockImplementation(async (id) => ({ id, status: "scheduled", timezone: "UTC", endsAt: "2030-10-12T13:00:00Z" }));
  mocks.rate.mockResolvedValue(true);
  mocks.turnstile.mockResolvedValue(true);
  mocks.admin.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockImplementation((name, args) => name === "register_live_webinar_v1" ? Promise.resolve({ data: { contact_id: "same-contact", registration_id: registrationId, session_id: args.p_session_id, access_version: 1 }, error: null }) : { single: async () => ({ data: { id: "same-contact", email: liveLead.email }, error: null }) });
  mocks.messages.mockReturnValue([{ template_key: "pre_webinar:1" }]);
  mocks.token.mockReturnValue("signed-participant-token");
  mocks.secret.mockReturnValue("configured");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.unstubAllEnvs());

describe("email mode readiness gate", () => {
  it.each(["test", "", "staging", undefined])("rejects malformed submissions before any side effect when EMAIL_MODE is %s", async (emailMode) => {
    vi.stubEnv("EMAIL_MODE", emailMode);
    const invalidJson = new Request(`${origin}/api/lead`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: "not-json",
    });

    const response = await POST(invalidJson);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("300");
    expect(await response.json()).toEqual({ error: "This service is temporarily unavailable. Please try again later." });
    for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled();
  });
});

describe("evergreen training readiness gate", () => {
  it.each(["false", "", "TRUE", "1", undefined])("rejects before parsing or side effects when evergreen training is disabled by %s", async (trainingMode) => {
    vi.stubEnv("EMAIL_MODE", "production");
    vi.stubEnv("EVERGREEN_TRAINING_ENABLED", trainingMode);
    const invalidJson = new Request(`${origin}/api/lead`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: "not-json",
    });

    const response = await POST(invalidJson);

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("300");
    expect(await response.json()).toEqual({ error: "This service is temporarily unavailable. Please try again later." });
    for (const mock of Object.values(mocks)) expect(mock).not.toHaveBeenCalled();
  });
});

describe("live registration isolation", () => {
  it.each([
    { ...liveLead },
    { name: liveLead.name, email: liveLead.email, sessionId },
    { name: liveLead.name, email: liveLead.email, source: "vance-live-webinar" },
  ])("fails closed for recognized live context while disabled", async (body) => {
    mocks.enabled.mockReturnValue(false);
    expect((await POST(request(body))).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.messages).not.toHaveBeenCalled();
    expect(mocks.deliverLegacy).not.toHaveBeenCalled();
  });

  it.each([
    { body: { ...liveLead, preview: true }, headers: {} as Record<string, string> },
    { body: liveLead, headers: { referer: `${origin}/live?preview=1` } },
    { body: liveLead, headers: { referer: `${origin}/live?state=live` } },
  ])("does not enroll or email preview submissions", async ({ body, headers }) => {
    expect((await POST(request(body, headers))).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.deliverLive).not.toHaveBeenCalled();
  });

  it("rejects malformed session identity without falling into evergreen", async () => {
    expect((await POST(request({ ...liveLead, sessionId: "placeholder" }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.messages).not.toHaveBeenCalled();
  });

  it("routes repeat registrations to the live transaction with their exact session", async () => {
    const first = await POST(request());
    const repeat = await POST(request());
    const next = await POST(request({ ...liveLead, sessionId: nextSessionId }));
    for (const response of [first, repeat, next]) expect(response.status).toBe(200);
    expect(mocks.rpc.mock.calls.map(([name, args]) => [name, args.p_session_id])).toEqual([["register_live_webinar_v1", sessionId], ["register_live_webinar_v1", sessionId], ["register_live_webinar_v1", nextSessionId]]);
    expect(mocks.messages).not.toHaveBeenCalled();
    expect(mocks.deliverLegacy).not.toHaveBeenCalled();
    expect(first.headers.get("set-cookie")).toContain(`vance-live-${sessionId}=signed-participant-token`);
    expect(first.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect(first.headers.get("set-cookie")).toMatch(/Secure/i);
    expect(await first.json()).toEqual({ ok: true, id: "same-contact", sessionId });
  });

  it("does not claim registration success when the atomic save fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "database details" } });
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(mocks.deliverLive).not.toHaveBeenCalled();
    expect(mocks.messages).not.toHaveBeenCalled();
  });

  it("keeps a committed registration successful when immediate delivery is deferred", async () => {
    mocks.deliverLive.mockRejectedValue(new Error("temporary provider failure"));
    expect((await POST(request())).status).toBe(200);
    expect(mocks.deliverLegacy).not.toHaveBeenCalled();
  });

  it("preserves the evergreen registration and email path", async () => {
    mocks.enabled.mockReturnValue(false);
    const response = await POST(request({ name: liveLead.name, email: liveLead.email, source: "vance-webinar" }));
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith("register_webinar_lead_and_enqueue_v1", expect.objectContaining({ p_source: "vance-webinar", p_messages: [{ template_key: "pre_webinar:1" }] }));
    expect(mocks.deliverLegacy).toHaveBeenCalledWith(liveLead.email, "pre_webinar");
    expect(mocks.deliverLive).not.toHaveBeenCalled();
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it("rejects a closed session before any enrollment", async () => {
    mocks.session.mockResolvedValue({ id: sessionId, status: "cancelled", endsAt: "2030-10-12T13:00:00Z" });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
