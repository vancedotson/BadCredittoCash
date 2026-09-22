import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots route rules", () => {
  it("allows public crawling and excludes private and transaction paths without a domain-specific sitemap", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/crm",
          "/login",
          "/forgot-password",
          "/auth/",
          "/api/",
          "/credit-check/thank-you",
          "/webinar/confirmed",
          "/webinar/booked",
          "/live/confirmed",
          "/live/booked",
        ],
      },
    });
  });
});
