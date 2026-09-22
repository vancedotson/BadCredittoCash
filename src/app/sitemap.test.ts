import { describe, expect, it } from "vitest";
import sitemap from "./sitemap";

describe("public sitemap", () => {
  it("contains only the approved stable indexable routes on the canonical host", () => {
    const urls = sitemap().map(({ url }) => url);

    expect(urls).toEqual([
      "https://badcredittocash.com/",
      "https://badcredittocash.com/credit-check",
      "https://badcredittocash.com/book",
      "https://badcredittocash.com/live",
      "https://badcredittocash.com/privacy",
      "https://badcredittocash.com/terms",
    ]);
    expect(urls.every((url) => new URL(url).origin === "https://badcredittocash.com")).toBe(true);
    expect(urls.join("\n")).not.toMatch(/workers\.dev|vancedotson\.com|localhost|\/crm|\/api\/|\/login|\/confirmed|\/booked|thank-you|\/v[14](?:\n|$)/i);
  });
});
