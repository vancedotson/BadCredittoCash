import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { activityGroupKey, eventDetail, eventSessionLabel } from "./event-detail";
import { displayEvent } from "./event-display";
import { Timeline } from "@/components/crm/Timeline";

describe("live question presentation", () => {
  it("marks questions as important engagement", () => {
    expect(displayEvent("live_question_asked")).toMatchObject({ label: "Asked a question live", category: "engagement", important: true, icon: "idea" });
  });

  it("preserves full multiline question text while ignoring non-string props", () => {
    const question = `My question\n${"More context. ".repeat(60)}`;
    expect(eventDetail({ event: "live_question_asked", props: { question } })).toBe(question.trim());
    expect(eventDetail({ event: "live_question_asked", props: { question: { html: "unsafe" } } })).toBe("");
    expect(eventDetail({ event: "live_question_asked" })).toBe("");
  });

  it("shows both questions as escaped text in the contact timeline", () => {
    const html = renderToStaticMarkup(<Timeline notes={[]} events={[
      { id: "q1", event: "live_question_asked", createdAt: "2026-09-12T12:00:00Z", props: { sessionId: "session-a", sessionTitle: "September workshop", question: "<script>alert('test')</script>\nQuestion one" } },
      { id: "q2", event: "live_question_asked", createdAt: "2026-09-12T12:01:00Z", props: { sessionId: "session-a", question: "Question two about my credit report" } },
    ]} />);
    expect(html).toContain("Question one");
    expect(html).toContain("Question two about my credit report");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Session: September workshop");
    expect(html).toContain("Session: session-a");
  });

  it("groups repeated questions within a session while separating repeat sessions", () => {
    const event = { contactId: "person-a", event: "live_question_asked", createdAt: "2026-09-12T12:00:00Z", props: { funnel: "live", sessionId: "session-a", question: "One" } };
    expect(activityGroupKey(event)).toBe(activityGroupKey({ ...event, props: { ...event.props, question: "Two" } }));
    expect(activityGroupKey(event)).not.toBe(activityGroupKey({ ...event, props: { ...event.props, sessionId: "session-b" } }));
    expect(activityGroupKey(event)).not.toBe(activityGroupKey({ ...event, contactId: "person-b" }));
  });

  it("keeps legacy details and watch grouping intact", () => {
    expect(eventDetail({ event: "quiz_completed", props: { concern: "credit", tried: "dispute", urgency: "soon" } })).toBe("credit · dispute · soon");
    expect(eventDetail({ event: "email_queued", props: { sequence: "pre_webinar" } })).toBe("Sequence: pre_webinar");
    const event = { email: "a@example.test", createdAt: "2026-09-12T12:00:00Z", event: "webinar_watch_25" };
    expect(activityGroupKey(event)).toBe(activityGroupKey({ ...event, event: "webinar_watch_50" }));
    expect(eventSessionLabel(event)).toBe("");
    expect(displayEvent("live_replay_opened").label).toBe("Opened the webinar replay");
  });
});
