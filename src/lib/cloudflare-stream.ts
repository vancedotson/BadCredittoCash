import "server-only";

type CloudflareLiveInput = {
  uid: string;
  webRTC: { url: string };
  webRTCPlayback: { url: string };
};

type CloudflareEnvelope = {
  success?: boolean;
  result?: unknown;
};

export function cloudflareStreamConfigured(): boolean {
  return process.env.CLOUDFLARE_STREAM_ENABLED === "true"
    && Boolean(process.env.CLOUDFLARE_ACCOUNT_ID)
    && Boolean(process.env.CLOUDFLARE_STREAM_API_TOKEN);
}

function readLiveInput(value: unknown): CloudflareLiveInput {
  if (!value || typeof value !== "object") throw new Error("Cloudflare Stream returned an invalid live input.");
  const input = value as Record<string, unknown>;
  const webRTC = input.webRTC as Record<string, unknown> | undefined;
  const playback = input.webRTCPlayback as Record<string, unknown> | undefined;
  if (typeof input.uid !== "string" || typeof webRTC?.url !== "string" || typeof playback?.url !== "string") {
    throw new Error("Cloudflare Stream returned an incomplete live input.");
  }
  for (const candidate of [webRTC.url, playback.url]) {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || !/^customer-[a-z0-9]+\.cloudflarestream\.com$/i.test(url.hostname)) {
      throw new Error("Cloudflare Stream returned an unexpected endpoint.");
    }
  }
  return { uid: input.uid, webRTC: { url: webRTC.url }, webRTCPlayback: { url: playback.url } };
}

async function streamRequest(path: string, init?: RequestInit): Promise<CloudflareLiveInput> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  if (!cloudflareStreamConfigured() || !accountId || !token) throw new Error("Cloudflare Stream is not configured yet.");
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/live_inputs${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as CloudflareEnvelope | null;
  if (!response.ok || payload?.success !== true) throw new Error("Cloudflare Stream could not prepare the broadcast.");
  return readLiveInput(payload.result);
}

export async function prepareCloudflareLiveInput(input: { sessionId: string; title: string; liveInputId?: string | null }) {
  const liveInput = input.liveInputId
    ? await streamRequest(`/${encodeURIComponent(input.liveInputId)}`)
    : await streamRequest("", {
      method: "POST",
      headers: { "Idempotency-Key": `webinar-${input.sessionId}` },
      body: JSON.stringify({
        defaultCreator: "vance-dotson",
        deleteRecordingAfterDays: 30,
        meta: { webinarSessionId: input.sessionId, title: input.title.slice(0, 200) },
        preferLowLatency: true,
        recording: {
          allowedOrigins: [new URL(process.env.APP_BASE_URL || "https://vance-dotson.vancedotson.workers.dev").hostname],
          hideLiveViewerCount: false,
          mode: "automatic",
          requireSignedURLs: false,
          timeoutSeconds: 0,
        },
      }),
    });
  const playback = new URL(liveInput.webRTCPlayback.url);
  return {
    liveInputId: liveInput.uid,
    publishUrl: liveInput.webRTC.url,
    embedUrl: `${playback.origin}/${encodeURIComponent(liveInput.uid)}/iframe`,
  };
}
