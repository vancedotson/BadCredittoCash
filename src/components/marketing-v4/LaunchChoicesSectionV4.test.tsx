import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LaunchChoicesSectionV4 } from "./LaunchChoicesSectionV4";

describe("public home next-step section", () => {
  it("offers only the credit-report CTA", () => {
    const markup = renderToStaticMarkup(createElement(LaunchChoicesSectionV4));

    expect(markup).toContain('href="/credit-check"');
    expect(markup).toContain("Check my credit report");
    expect(markup).not.toContain('href="/live"');
    expect(markup).not.toContain("Join the webinar");
    expect(markup).not.toContain('href="/book"');
    expect(markup).not.toContain("/webinar/confirmed");
  });
});
