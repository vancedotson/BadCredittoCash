import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LaunchChoicesSectionV4 } from "./LaunchChoicesSectionV4";

describe("public home next-step section", () => {
  it("offers the guide and live webinar registration routes", () => {
    const markup = renderToStaticMarkup(createElement(LaunchChoicesSectionV4));

    expect(markup).toContain('href="/credit-check"');
    expect(markup).toContain('href="/live"');
    expect(markup).toContain("Join the webinar");
    expect(markup).not.toContain('href="/book"');
    expect(markup).not.toContain("/webinar/confirmed");
  });
});
