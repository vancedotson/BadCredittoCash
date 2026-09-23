import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "comment-json";
import { describe, expect, it } from "vitest";
import { PUBLIC_SITE_ORIGIN } from "@/config/public-site";
import { isBookingEmailConfigurationReady } from "@/lib/email-configuration";

type WranglerConfig = {
  vars?: {
    APP_BASE_URL?: string;
    MARKETING_EMAILS_ENABLED?: string;
    EMAIL_MODE?: string;
    EVERGREEN_TRAINING_ENABLED?: string;
    LIVE_WEBINAR_ENABLED?: string;
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
    "APP_BASE_URL": "https://badcredittocash.com",
  },
}
`;

describe("public site origin configuration", () => {
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
    expect(wranglerConfig.vars?.EMAIL_MODE).toBe("test");
    expect(wranglerConfig.vars?.EMAIL_REPLY_TO).toBe("vance@vancethecreditdoctor.com");
    expect(wranglerConfig.vars?.EMAIL_FROM).toMatch(/^Bad Credit to Cash <[^<>\s]+@[^<>\s]+>$/);
    expect(wranglerConfig.vars?.EVERGREEN_TRAINING_ENABLED).toBe("false");
    expect(wranglerConfig.vars?.LIVE_WEBINAR_ENABLED).toBe("false");
    expect(wranglerConfig.vars?.CLOUDFLARE_STREAM_ENABLED).toBe("false");
  });
});
