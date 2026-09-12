import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OverviewQuickActions } from "./OverviewQuickActions";

describe("overview quick action availability", () => {
  it("does not offer contact or task mutations to read-only users", () => {
    expect(renderToStaticMarkup(<OverviewQuickActions contacts={[]} owners={[]} canWrite={false} />)).toBe("");
  });

  it("waits for client hydration before accepting quick-action clicks", () => {
    const html = renderToStaticMarkup(<OverviewQuickActions contacts={[]} owners={[]} />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>\+ Contact<\/button>/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>\+ Task<\/button>/);
    expect(html).not.toContain("<dialog");
  });
});
