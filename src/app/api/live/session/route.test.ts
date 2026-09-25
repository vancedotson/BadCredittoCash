import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), participant: vi.fn(), configured: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/live-webinars", () => ({ getPublicLiveWebinarSession: mocks.session, resolveLiveParticipant: mocks.participant }));
vi.mock("@/lib/cloudflare-stream", () => ({ cloudflareStreamConfigured: mocks.configured }));
vi.mock("@/lib/cloudflare-stream-token", () => ({ createCloudflareLivePlaybackUrl: mocks.sign }));

import { GET } from "./route";

const sessionId = "20000000-0000-4000-8000-000000000001";
const inputId = "0123456789abcdef0123456789abcdef";
const session = {
  id: sessionId, slug: "private-live", title: "Private live", startsAt: "2030-10-12T12:00:00Z", endsAt: "2030-10-12T13:00:00Z",
  timezone: "UTC", status: "scheduled", embedUrl: `https://customer-ab12.cloudflarestream.com/${inputId}/webRTC/play`,
  replayUrl: "https://private.example/replay", replayPublished: true, replayAvailableUntil: "2030-10-13T12:00:00Z",
  automationEnabled: false, scheduleVersion: 1, streamProvider: "cloudflare", cloudflareLiveInputId: inputId,
};

function request() { return new Request(`https://example.test/api/live/session?session=${sessionId}`); }

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2030-10-12T12:00:00Z"));
  mocks.session.mockResolvedValue(session);
  mocks.participant.mockResolvedValue({ registrationId: "registration-1", sessionId });
  mocks.configured.mockReturnValue(true);
  mocks.sign.mockResolvedValue(`https://customer-ab12.cloudflarestream.com/signed-token/webRTC/play`);
});

afterEach(() => { vi.restoreAllMocks(); });

describe("public live session playback access", () => {
  it("withholds playback, input identity, and all replay fields from an unregistered visitor", async () => {
    mocks.participant.mockResolvedValue(null);
    const response = await GET(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.session).toMatchObject({ embedUrl: null, replayUrl: null, replayPublished: false, replayAvailableUntil: null, cloudflareLiveInputId: null });
    expect(body.participant).toBeNull();
    expect(JSON.stringify(body)).not.toContain("private.example");
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("vary")).toContain("Cookie");
  });

  it("withholds playback when the resolved participant belongs to a different session", async () => {
    mocks.participant.mockResolvedValue({ registrationId: "registration-other", sessionId: "30000000-0000-4000-8000-000000000001" });
    const response = await GET(request());
    const body = await response.json();
    expect(body.session.embedUrl).toBeNull();
    expect(body.participant).toBeNull();
    expect(mocks.sign).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("mints a signed WHEP URL only for a registered attendee during the open session window", async () => {
    const response = await GET(request());
    const body = await response.json();
    expect(body.session.embedUrl).toBe("https://customer-ab12.cloudflarestream.com/signed-token/webRTC/play");
    expect(body.session.cloudflareLiveInputId).toBeNull();
    expect(body.session.replayPublished).toBe(false);
    expect(mocks.sign).toHaveBeenCalledWith({ endpoint: session.embedUrl, liveInputId: inputId });
  });

  it("keeps WHEP unavailable before doors open, when Cloudflare is disabled, or for ended sessions", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2030-10-12T11:00:00Z"));
    expect((await (await GET(request())).json()).session.embedUrl).toBeNull();
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2030-10-12T12:00:00Z"));
    mocks.configured.mockReturnValue(false);
    expect((await (await GET(request())).json()).session.embedUrl).toBeNull();
    mocks.configured.mockReturnValue(true);
    mocks.session.mockResolvedValue({ ...session, startsAt: "2029-10-12T12:00:00Z", endsAt: "2029-10-12T13:00:00Z" });
    expect((await (await GET(request())).json()).session.embedUrl).toBeNull();
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it("fails closed without surfacing signing errors", async () => {
    mocks.sign.mockRejectedValue(new Error("private signing material details"));
    const response = await GET(request());
    const body = await response.json();
    expect(body.session.embedUrl).toBeNull();
    expect(JSON.stringify(body)).not.toContain("private signing material");
  });
});
