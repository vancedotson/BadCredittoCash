import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CloudflareBroadcastStudio, CloudflareInputPreparationFeedback } from "./CloudflareBroadcastStudio";
import { createStreamInputPreparer } from "./cloudflare-stream-preparation";

const sessionId = "20000000-0000-4000-8000-000000000001";
const liveInputId = "0123456789abcdef0123456789abcdef";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderStudio(overrides: Partial<React.ComponentProps<typeof CloudflareBroadcastStudio>> = {}) {
  return renderToStaticMarkup(<CloudflareBroadcastStudio
    sessionId={sessionId}
    configured
    disabled={false}
    onPrepared={vi.fn()}
    {...overrides}
  />);
}

describe("Cloudflare Broadcast Studio prepare-only action", () => {
  it("shows a distinct unprepared state and keeps device testing and Start live separate", () => {
    const html = renderStudio();

    expect(html).toContain("Stream input not prepared");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-describedby="stream-input-status"');
    expect(html).toContain("Prepare Stream input</button>");
    expect(html).toContain("Camera not tested");
    expect(html).toContain("Microphone not tested");
    expect(html).toContain(">Start live</button>");
    expect(html).toContain('disabled="" class="flex-1 rounded-lg bg-gold');
  });

  it("shows prepared/offline state and makes repeat preparation explicitly reuse the linked input", () => {
    const html = renderStudio({ liveInputId });

    expect(html).toContain("Stream input prepared. Broadcast is offline; recording is off.");
    expect(html).toContain("Preparing again reuses that input.");
    expect(html).not.toContain(liveInputId);
  });

  it("renders accessible pending, success, and error feedback", () => {
    const pending = renderToStaticMarkup(<CloudflareInputPreparationFeedback state="preparing" linked={false} error={null} />);
    const success = renderToStaticMarkup(<CloudflareInputPreparationFeedback state="prepared" linked={false} error={null} />);
    const live = renderToStaticMarkup(<CloudflareInputPreparationFeedback state="prepared" linked error={null} broadcastActive />);
    const failure = renderToStaticMarkup(<CloudflareInputPreparationFeedback state="error" linked={false} error="The Stream input could not be prepared." />);

    expect(pending).toContain('role="status" aria-live="polite"');
    expect(pending).toContain("Preparing Stream input…");
    expect(success).toContain("Broadcast is offline; recording is off.");
    expect(live).toContain("Broadcast is live; recording is off.");
    expect(failure).toContain('role="alert"');
    expect(failure).toContain("The Stream input could not be prepared.");
  });

  it("disables controls when the manager disables actions", () => {
    const html = renderStudio({ disabled: true });
    expect(html).toContain("Prepare Stream input</button>");
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  });

  it("posts once while pending and never accesses media or WebRTC APIs", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    const getUserMedia = vi.fn();
    const getDisplayMedia = vi.fn();
    const peerConnection = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia, getDisplayMedia } });
    vi.stubGlobal("RTCPeerConnection", peerConnection);

    const prepare = createStreamInputPreparer(sessionId, fetcher as unknown as typeof fetch);
    const first = prepare();
    const second = prepare();

    expect(second).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(`/api/crm/live-webinars/${sessionId}/stream`, { method: "POST", cache: "no-store", headers: { "x-stream-preparation-only": "1" } });
    resolveFetch(Response.json({ liveInputId }));
    const result = await first;

    expect(result).toBe(liveInputId);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(getDisplayMedia).not.toHaveBeenCalled();
    expect(peerConnection).not.toHaveBeenCalled();
  });

  it("allows a later deliberate prepare request and reports API failure accessibly", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ liveInputId }))
      .mockResolvedValueOnce(Response.json({ error: "The live broadcast could not be prepared." }, { status: 503 }));
    const prepare = createStreamInputPreparer(sessionId, fetcher as unknown as typeof fetch);

    await expect(prepare()).resolves.toBe(liveInputId);
    await expect(prepare()).rejects.toThrow("The live broadcast could not be prepared.");
    expect(fetcher).toHaveBeenCalledTimes(2);
    const failure = renderToStaticMarkup(<CloudflareInputPreparationFeedback state="error" linked={true} error="The live broadcast could not be prepared." />);
    expect(failure).toContain('role="alert"');
    expect(failure).toContain("A Stream input is already linked. Preparing again reuses that input.");
  });
});
