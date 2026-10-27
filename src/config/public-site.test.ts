import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "comment-json";
import { describe, expect, it, vi } from "vitest";
import { PUBLIC_SITE_ORIGIN, resolvePublicSiteOrigin } from "@/config/public-site";
import { isBookingEmailConfigurationReady } from "@/lib/email-configuration";

type WranglerConfig = {
  secrets?: { required?: string[] };
  vars?: {
    APP_BASE_URL?: string;
    CLOUDFLARE_ACCOUNT_ID?: string;
    CLOUDFLARE_STREAM_ALLOWED_ORIGINS?: string;
    CLOUDFLARE_STREAM_CUSTOMER_ORIGIN?: string;
    MARKETING_EMAILS_ENABLED?: string;
    EMAIL_MODE?: string;
    EVERGREEN_TRAINING_ENABLED?: string;
    LIVE_WEBINAR_ENABLED?: string;
    LIVE_WEBINAR_EMAILS_APPROVED?: string;
    CLOUDFLARE_STREAM_ENABLED?: string;
    EMAIL_FROM?: string;
    EMAIL_REPLY_TO?: string;
  };
};

const jsoncFixture = `
{
  // JSONC permits line comments.
  "vars": {
    /* It also permits block comments and trailing commas. */
    "APP_BASE_URL": "https://creditrepairparty.com",
  },
}
`;

describe("public site origin configuration", () => {
  it("uses the current canonical origin by default and accepts a configured HTTPS origin", () => {
    expect(resolvePublicSiteOrigin(undefined)).toBe("https://creditrepairparty.com");
    expect(resolvePublicSiteOrigin("https://launch.example.test/")).toBe("https://launch.example.test");
  });

  it("uses APP_BASE_URL for canonical links and the calendar hostname", async () => {
    vi.stubEnv("APP_BASE_URL", "https://launch.example.test/");
    vi.resetModules();
    try {
      const configured = await import("@/config/public-site");
      expect(configured.PUBLIC_SITE_ORIGIN).toBe("https://launch.example.test");
      expect(configured.PUBLIC_SITE_HOSTNAME).toBe("launch.example.test");
      expect(configured.publicUrl("/credit-check")).toBe("https://launch.example.test/credit-check");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it.each([
    "",
    "http://launch.example.test",
    "https://launch.example.test/credit-check",
    "https://launch.example.test?campaign=1",
    "https://launch.example.test/#section",
    "https://user:pass@launch.example.test",
    "launch.example.test",
  ])("rejects an invalid APP_BASE_URL: %s", (value) => {
    expect(() => resolvePublicSiteOrigin(value)).toThrow("APP_BASE_URL must be an HTTPS origin.");
  });

  it("parses JSONC comments and trailing commas", () => {
    const parsedFixture = parse<WranglerConfig>(jsoncFixture);

    expect(parsedFixture.vars?.APP_BASE_URL).toBe(PUBLIC_SITE_ORIGIN);
  });

  it("keeps the Worker absolute-link origin aligned with the canonical public origin", () => {
    const configPath = fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url));
    const wranglerConfig = parse<WranglerConfig>(readFileSync(configPath, "utf8"));

    expect(wranglerConfig.vars?.APP_BASE_URL).toBe(PUBLIC_SITE_ORIGIN);
    expect(wranglerConfig.vars?.APP_BASE_URL).not.toMatch(/\/$/);
    expect(isBookingEmailConfigurationReady(wranglerConfig.vars)).toBe(true);
    expect(wranglerConfig.vars?.MARKETING_EMAILS_ENABLED).toBe("false");
    expect(wranglerConfig.vars?.EMAIL_MODE).toBe("production");
    expect(wranglerConfig.vars?.EMAIL_REPLY_TO).toBe("vance@vancethecreditdoctor.com");
    expect(wranglerConfig.vars?.EMAIL_FROM).toMatch(/^Vance Dotson <[^<>\s@]+@updates\.creditrepairparty\.com>$/);
    expect(wranglerConfig.vars?.EVERGREEN_TRAINING_ENABLED).toBe("false");
    expect(wranglerConfig.vars?.LIVE_WEBINAR_ENABLED).toBe("true");
    expect(wranglerConfig.vars?.LIVE_WEBINAR_EMAILS_APPROVED).toBe("true");
    expect(wranglerConfig.vars?.CLOUDFLARE_STREAM_ENABLED).toBe("true");
    expect(wranglerConfig.vars?.CLOUDFLARE_ACCOUNT_ID).toBe("705ccc4ff6e1ae75c616d7c6a567d787");
    expect(wranglerConfig.vars?.CLOUDFLARE_STREAM_CUSTOMER_ORIGIN).toBe("https://customer-f15nogdf46kchhnl.cloudflarestream.com");
    expect(wranglerConfig.vars?.CLOUDFLARE_STREAM_ALLOWED_ORIGINS).toBe(PUBLIC_SITE_ORIGIN);
    expect(wranglerConfig.secrets?.required).toEqual(expect.arrayContaining([
      "CLOUDFLARE_STREAM_API_TOKEN",
      "CLOUDFLARE_STREAM_SIGNING_KEY_ID",
      "CLOUDFLARE_STREAM_SIGNING_KEY_JWK",
    ]));
  });
});
