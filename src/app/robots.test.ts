import { describe, expect, it } from "vitest";
import robots from "./robots";
import { publicUrl } from "@/config/public-site";

describe("robots route rules", () => {
  it("allows public crawling, excludes private and transaction paths, and names the canonical sitemap", () => {
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
      sitemap: publicUrl("/sitemap.xml"),
    });
  });
});
