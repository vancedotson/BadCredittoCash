import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "comment-json";
import { describe, expect, it } from "vitest";
import { PUBLIC_SITE_ORIGIN } from "@/config/public-site";

type WranglerConfig = {
  vars?: {
    APP_BASE_URL?: string;
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
  });
});
