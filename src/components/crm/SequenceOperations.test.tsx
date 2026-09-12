import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SequenceOperations } from "./SequenceOperations";

function renderEmptyFailures(failedMessages: number) {
  return renderToStaticMarkup(
    <SequenceOperations
      initialStats={{ activeEnrollments: 0, scheduledMessages: 0, retryingMessages: 0, sentMessages: 0, failedMessages }}
      initialEnrollments={[]}
      initialFailures={[]}
    />,
  );
}

describe("sequence failure summary after clearing a limited batch", () => {
  it.each([
    [1, "1 failed email remains."],
    [5, "5 failed emails remain."],
  ])("keeps %i remaining failures visible when the loaded list is empty", (count, remainingMessage) => {
    const html = renderEmptyFailures(count);

    expect(html).toMatch(new RegExp("Emails needing attention <span[^>]*>" + count + "</span>"));
    expect(html).toContain(remainingMessage + " Refresh this page to review them.");
    expect(html).not.toContain("You’re all caught up.");
    expect(html).not.toContain("No failed emails.");
  });

  it("shows a cleared state only when the global failure count is zero", () => {
    const html = renderEmptyFailures(0);

    expect(html).toMatch(/Emails needing attention <span[^>]*>0<\/span>/);
    expect(html).toContain("No failed emails.");
    expect(html).toContain("You’re all caught up. Refresh this page to check for new sending issues.");
    expect(html).not.toContain("Refresh this page to review them.");
  });
});
