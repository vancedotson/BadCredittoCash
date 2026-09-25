import { describe, expect, it } from "vitest";
import { draftOf, suggestSessionSlug, updateSessionDraft } from "./live-webinar-editor";
import type { LiveWebinarSession } from "./live-webinar-types";

const session: LiveWebinarSession = {
  id: "20000000-0000-4000-8000-000000000001", slug: "existing-workshop", title: "Existing workshop",
  startsAt: "2026-10-08T16:00:00.000Z", endsAt: "2026-10-08T17:00:00.000Z", timezone: "America/New_York",
  status: "scheduled", embedUrl: "https://customer-ab12.cloudflarestream.com/0123456789abcdef0123456789abcdef/webRTC/play", replayUrl: "https://player.vimeo.com/video/replay",
  replayPublished: true, replayAvailableUntil: "2026-10-15T17:00:00.000Z", automationEnabled: true, scheduleVersion: 3,
  streamProvider: "cloudflare", cloudflareLiveInputId: "0123456789abcdef0123456789abcdef",
};

describe("live webinar editor drafts", () => {
  it("uses a selected calendar date without enabling registration, emails or replay", () => {
    expect(draftOf(null, "2026-10-08", "Europe/Lisbon")).toEqual({
      slug: "", title: "", startsAt: "2026-10-08T12:00", endsAt: "2026-10-08T13:00", timezone: "Europe/Lisbon",
      status: "draft", embedUrl: "", replayUrl: "", replayPublished: false, replayAvailableUntil: "", automationEnabled: false, streamProvider: "external", cloudflareLiveInputId: null,
    });
    expect(draftOf(null)).toMatchObject({ startsAt: "", endsAt: "", timezone: "America/Chicago" });
  });

  it("preserves existing identity and delivery settings in the session's authored timezone", () => {
    expect(draftOf(session, "2027-01-01", "Europe/Lisbon")).toEqual({
      id: session.id, slug: session.slug, title: session.title, startsAt: "2026-10-08T12:00", endsAt: "2026-10-08T13:00",
      timezone: session.timezone, status: "scheduled", embedUrl: session.embedUrl, replayUrl: "",
      replayPublished: false, replayAvailableUntil: "", automationEnabled: true, streamProvider: "cloudflare", cloudflareLiveInputId: session.cloudflareLiveInputId,
    });
    expect(draftOf({ ...session, status: "cancelled", embedUrl: null, replayUrl: null, replayPublished: false, replayAvailableUntil: null }))
      .toMatchObject({ status: "cancelled", embedUrl: "", replayUrl: "", replayPublished: false, replayAvailableUntil: "", automationEnabled: true });
  });

  it("updates a new suggested slug as title or calendar date changes without mutating the prior draft", () => {
    const original = draftOf(null, "2026-10-08");
    const named = updateSessionDraft(original, "title", "Credit workshop", false);
    expect(named.slug).toBe("credit-workshop-2026-10-08");
    const moved = updateSessionDraft(named, "startsAt", "2026-10-15T12:00", false);
    expect(moved.slug).toBe("credit-workshop-2026-10-15");
    expect(original.title).toBe("");
    expect(named.startsAt).toBe("2026-10-08T12:00");
  });

  it("keeps a manually chosen new slug through title and date changes", () => {
    const draft = { ...draftOf(null, "2026-10-08"), slug: "custom-session-url" };
    expect(updateSessionDraft(draft, "title", "A new title", true).slug).toBe("custom-session-url");
    expect(updateSessionDraft(draft, "startsAt", "2026-10-15T12:00", true).slug).toBe("custom-session-url");
  });

  it("preserves the slug and optional settings when editing an existing session", () => {
    const draft = draftOf(session);
    expect(updateSessionDraft(draft, "title", "Renamed workshop", false)).toEqual({ ...draft, title: "Renamed workshop" });
    expect(updateSessionDraft(draft, "startsAt", "2026-10-15T12:00", false)).toEqual({ ...draft, startsAt: "2026-10-15T12:00" });
    expect(updateSessionDraft(draft, "automationEnabled", false, false)).toEqual({ ...draft, automationEnabled: false });
  });
});

describe("suggested session URL names", () => {
  it("normalizes accents, compatibility characters, whitespace and punctuation", () => {
    expect(suggestSessionSlug("  Café & CRÉDIT: ﬁrst Steps!  ", "2026-10-08T12:00")).toBe("cafe-credit-first-steps-2026-10-08");
  });

  it.each(["", "   ", "🎤", "信用讲座"])("leaves titles with no supported characters editable: %j", (title) => {
    expect(suggestSessionSlug(title, "2026-10-08T12:00")).toBe("");
  });

  it.each(["", "October 8, 2026", "2026-1-08T12:00", "2026-13-08T12:00", "2026-10-08-invalid"])("does not append a malformed date: %j", (date) => {
    expect(suggestSessionSlug("Credit workshop", date)).toBe("credit-workshop");
  });

  it("reserves room for the full date suffix and trims separators at the length boundary", () => {
    const title = `${"a".repeat(68)} very long workshop title`;
    const slug = suggestSessionSlug(title, "2026-10-08T12:00");
    expect(slug).toBe(`${"a".repeat(68)}-2026-10-08`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(suggestSessionSlug("a".repeat(200), "2026-10-08T12:00")).toHaveLength(80);
    expect(suggestSessionSlug(`${"a".repeat(79)} long title`, "")).toBe("a".repeat(79));
  });
});
