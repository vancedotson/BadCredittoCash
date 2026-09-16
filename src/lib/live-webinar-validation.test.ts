import { describe, expect, it } from "vitest";
import { validateLiveSessionInput, isLivePreviewRequest } from "./live-webinar-validation";
import { hasLiveContext } from "./live-webinar-types";
import { deriveSegment } from "./segments";
import { stageFromEvents } from "./stages";

const valid = { title: "Collector rights live", slug: "collector-rights", startsAt: "2026-10-10T17:00:00Z", endsAt: "2026-10-10T17:45:00Z", timezone: "America/Chicago", status: "scheduled", embedUrl: "https://www.youtube-nocookie.com/embed/test", replayUrl: null, replayPublished: false, replayAvailableUntil: null, automationEnabled: false };

describe("live session validation", () => {
  it("accepts a scheduled session with a supported player", () => expect(validateLiveSessionInput(valid).session).toMatchObject({ ...valid, startsAt: "2026-10-10T17:00:00.000Z", endsAt: "2026-10-10T17:45:00.000Z" }));
  it("accepts a Cloudflare Stream player and rejects lookalike hosts", () => {
    expect(validateLiveSessionInput({ ...valid, embedUrl: "https://customer-ab12.cloudflarestream.com/0123456789abcdef0123456789abcdef/iframe" }).session).toBeTruthy();
    expect(validateLiveSessionInput({ ...valid, embedUrl: "https://customer-ab12.cloudflarestream.com.evil.example/input/iframe" }).error).toBeTruthy();
  });
  it.each([
    { embedUrl: "javascript:alert(1)" }, { embedUrl: "https://evil.example/player" }, { embedUrl: "https://user:secret@www.youtube.com/embed/test" },
    { embedUrl: null }, { timezone: "Invalid/Zone" }, { endsAt: "2026-10-10T16:00:00Z" }, { replayPublished: true },
    { replayAvailableUntil: "2026-10-10T12:00:00Z" }, { slug: "a/b" }, { id: "not-an-id" },
  ])("rejects inconsistent or unsafe session details %j", (patch) => expect(validateLiveSessionInput({ ...valid, ...patch }).error).toBeTruthy());
  it("permits incomplete player setup only for a draft", () => expect(validateLiveSessionInput({ ...valid, status: "draft", embedUrl: null }).session).toBeTruthy());
  it("detects preview context in explicit requests and referring pages", () => {
    expect(isLivePreviewRequest(new Request("https://example.com/api/book"), { preview: true })).toBe(true);
    expect(isLivePreviewRequest(new Request("https://example.com/api/book", { headers: { referer: "https://example.com/live/call?preview=1" } }))).toBe(true);
    expect(isLivePreviewRequest(new Request("https://example.com/api/book", { headers: { referer: "https://example.com/live/call?session=abc" } }))).toBe(false);
  });
});

describe("live and evergreen segmentation remain separate", () => {
  it("does not classify live room entry as low watch", () => expect(deriveSegment([{ event: "webinar_room_opened", props: { funnel: "live", sessionId: "session-a" } }])).toBe("lead"));
  it("retains evergreen behavior when live events coexist", () => expect(deriveSegment([{ event: "webinar_room_opened", props: { funnel: "live" } }, { event: "webinar_watch_50" }])).toBe("mid_watch"));
  it("retains booking precedence across funnels", () => expect(deriveSegment([{ event: "call_booked", props: { funnel: "live" } }])).toBe("booked"));
  it("recognizes live questions and presence for automatic stage fallback", () => {
    expect(stageFromEvents(["live_question_asked"])).toBe("engaged");
    expect(stageFromEvents(["live_presence", "call_booked"])).toBe("booked");
    expect(stageFromEvents(["live_replay_opened"])).toBe("new");
  });
  it("recognizes legacy live page metadata without matching unrelated paths", () => {
    expect(hasLiveContext({ pagePath: "/live/room?session=abc" })).toBe(true);
    expect(hasLiveContext({ pagePath: "/lively" })).toBe(false);
  });
});
