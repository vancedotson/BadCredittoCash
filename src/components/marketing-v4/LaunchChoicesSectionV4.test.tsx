import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LaunchChoicesSectionV4 } from "./LaunchChoicesSectionV4";

describe("public home next-step section", () => {
  it("offers the guide and booking routes rather than disabled evergreen training", () => {
    const markup = renderToStaticMarkup(createElement(LaunchChoicesSectionV4));

    expect(markup).toContain('href="/credit-check"');
    expect(markup).toContain('href="/book"');
    expect(markup).not.toMatch(/webinar|on-demand|watch link|free training/i);
    expect(markup).not.toContain("/webinar/confirmed");
  });
});
