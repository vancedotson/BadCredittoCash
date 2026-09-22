import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PUBLIC_SITE_ORIGIN } from "@/config/public-site";

type WranglerConfig = {
  vars?: {
    APP_BASE_URL?: string;
  };
};

describe("public site origin configuration", () => {
  it("keeps the Worker absolute-link origin aligned with the canonical public origin", () => {
    const configPath = fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url));
    const wranglerConfig = JSON.parse(readFileSync(configPath, "utf8")) as WranglerConfig;

    expect(wranglerConfig.vars?.APP_BASE_URL).toBe(PUBLIC_SITE_ORIGIN);
    expect(wranglerConfig.vars?.APP_BASE_URL).not.toMatch(/\/$/);
  });
});
