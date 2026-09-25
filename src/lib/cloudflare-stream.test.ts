import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./cloudflare-stream-token", () => ({ cloudflareStreamPlaybackSigningConfigured: () => true }));

import { cloudflareStreamConfigured, prepareCloudflareLiveInput } from "./cloudflare-stream";

const sessionId = "20000000-0000-4000-8000-000000000001";
const inputId = "0123456789abcdef0123456789abcdef";
const payload = { success: true, result: {
  uid: inputId,
  webRTC: { url: "https://customer-ab12.cloudflarestream.com/secret/webRTC/publish" },
  webRTCPlayback: { url: `https://customer-ab12.cloudflarestream.com/${inputId}/webRTC/play` },
} };

function configure() {
  vi.stubEnv("CLOUDFLARE_STREAM_ENABLED", "true");
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "account-test");
  vi.stubEnv("CLOUDFLARE_STREAM_API_TOKEN", "test-only-token");
  vi.stubEnv("CLOUDFLARE_STREAM_SIGNING_KEY_ID", "test-key");
  vi.stubEnv("CLOUDFLARE_STREAM_SIGNING_KEY_JWK", "test-key-material");
  vi.stubEnv("CLOUDFLARE_STREAM_CUSTOMER_ORIGIN", "https://customer-ab12.cloudflarestream.com");
  vi.stubEnv("APP_BASE_URL", "https://vance-dotson.vancedotson.workers.dev");
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Cloudflare Stream live-input adapter", () => {
  it("requires the explicit feature flag, API credentials and playback signing", () => {
    configure();
    expect(cloudflareStreamConfigured()).toBe(true);
    vi.stubEnv("CLOUDFLARE_STREAM_ENABLED", "false");
    expect(cloudflareStreamConfigured()).toBe(false);
  });

  it("creates non-recording, signed-only WHEP input and returns only validated endpoints", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal("fetch", fetchMock);

    const result = await prepareCloudflareLiveInput({ sessionId, title: "Private rehearsal" });

    expect(result).toEqual({ liveInputId: inputId, publishUrl: payload.result.webRTC.url, embedUrl: payload.result.webRTCPlayback.url });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/stream/live_inputs");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-only-token");
    expect(new Headers(init.headers).get("idempotency-key")).toBe(`webinar-${sessionId}`);
    const body = JSON.parse(String(init.body));
    expect(body.recording).toMatchObject({ mode: "off", requireSignedURLs: true, allowedOrigins: ["vance-dotson.vancedotson.workers.dev"] });
    expect(body.recording).not.toHaveProperty("deleteRecordingAfterDays");
    expect(body.meta).toMatchObject({ webinarSessionId: sessionId, title: "Private rehearsal" });
  });

  it("updates a prepared input with the same no-recording policy and metadata", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue(Response.json(payload));
    vi.stubGlobal("fetch", fetchMock);
    await prepareCloudflareLiveInput({ sessionId, title: "Updated session", liveInputId: inputId });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(`/stream/live_inputs/${inputId}`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toMatchObject({
      recording: { mode: "off", requireSignedURLs: true },
      meta: { webinarSessionId: sessionId, title: "Updated session" },
    });
  });

  it("fails closed without making a provider request while disabled", async () => {
    configure();
    vi.stubEnv("CLOUDFLARE_STREAM_ENABLED", "false");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(prepareCloudflareLiveInput({ sessionId, title: "Private rehearsal" })).rejects.toThrow("not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a provider response that points at a lookalike playback origin", async () => {
    configure();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ...payload, result: {
      ...payload.result,
      webRTCPlayback: { url: `https://customer-ab12.cloudflarestream.com.evil.example/${inputId}/webRTC/play` },
    } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(prepareCloudflareLiveInput({ sessionId, title: "Private rehearsal" })).rejects.toThrow("unexpected endpoint");
  });

  it("fails closed until the exact Stream customer origin is configured", () => {
    configure();
    vi.stubEnv("CLOUDFLARE_STREAM_CUSTOMER_ORIGIN", "");
    expect(cloudflareStreamConfigured()).toBe(false);
  });
});
