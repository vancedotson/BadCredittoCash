import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { liveWebinar } from "@/config/live-webinar";

vi.mock("./LiveSessionProvider", () => ({
  LiveSessionLoading: () => null,
  useLiveSession: () => ({ loading: false, error: null, session: null }),
}));

import { UnscheduledNotice } from "./UnscheduledNotice";

describe("unscheduled live session notice", () => {
  it("asks visitors to check back and offers booking without promising an on-demand recording", () => {
    const markup = renderToStaticMarkup(createElement(UnscheduledNotice));

    expect(markup).toContain("NO SESSION SCHEDULED");
    expect(markup).toContain("Please check back");
    expect(markup).toContain('href="/book"');
    expect(markup).not.toMatch(/on-demand|recorded training|watch it right now/i);
  });

  it("keeps live ended and replay fallbacks free of evergreen-training promises", () => {
    const copy = [
      liveWebinar.confirmed.countdown.endedSub,
      liveWebinar.replay.expiredSub,
      liveWebinar.replay.unavailable.sub,
      liveWebinar.room.ended.sub,
    ].join(" ");

    expect(copy).not.toMatch(/on-demand training|watch the free training/i);
  });
});
