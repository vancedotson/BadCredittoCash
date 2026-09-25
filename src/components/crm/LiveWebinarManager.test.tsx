import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LiveWebinarManager } from "./LiveWebinarManager";
import type { LiveWebinarSession } from "@/lib/live-webinar-types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

const session: LiveWebinarSession = { id: "20000000-0000-4000-8000-000000000001", slug: "september-workshop", title: "September workshop", startsAt: "2026-09-12T16:00:00Z", endsAt: "2026-09-12T17:00:00Z", timezone: "America/New_York", status: "draft", embedUrl: null, replayUrl: null, replayPublished: false, replayAvailableUntil: null, automationEnabled: false, scheduleVersion: 1 };

describe("live webinar CRM role and activation display", () => {
  it("offers read-only users reports without mutation controls", () => {
    const html = renderToStaticMarkup(<LiveWebinarManager initialSessions={[session]} initialNow="2026-09-12T17:00:00Z" canWrite={false} canManageBroadcasts={false} siteEnabled={false} />);
    expect(html).toContain("Read-only access");
    expect(html).toContain("Refresh activity");
    expect(html).not.toContain("New session</button>");
    expect(html).not.toContain("Edit session</button>");
  });

  it("shows that site-wide registration is paused while drafts remain editable", () => {
    const html = renderToStaticMarkup(<LiveWebinarManager initialSessions={[session]} initialNow="2026-09-12T17:00:00Z" canWrite canManageBroadcasts={false} siteEnabled={false} />);
    expect(html).toContain("Registration paused");
    expect(html).toContain("New session</button>");
    expect(html).toContain("Edit session</button>");
    expect(html).toContain("Session emails disabled");
    expect(html).toContain("Recording disabled");
    expect(html).not.toContain("Replay page");
    expect(html).not.toContain("Broadcast studio");
  });

  it("shows Stream preparation controls to an administrator when Stream is configured", () => {
    const html = renderToStaticMarkup(<LiveWebinarManager initialSessions={[session]} initialNow="2026-09-12T17:00:00Z" canWrite canManageBroadcasts siteEnabled={false} streamConfigured />);
    expect(html).toContain("Broadcast studio");
    expect(html).toContain("Test camera &amp; mic");
    expect(html).toContain("Start live");
  });
});
