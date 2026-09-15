import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Next.js inlines NEXT_PUBLIC_* at build time, but the Turnstile site key is
 * supplied as a Wrangler *runtime* var, so it is undefined while compiling and
 * the hardcoded fallback in TurnstileWidget.tsx is what reaches the browser.
 *
 * When the fallback was left on a retired key, production rendered a widget for
 * a site key whose allowed-domain list excluded the Worker hostname. Turnstile
 * answered with error 110200 and visitors saw "Unable to connect to website"
 * above a dead "Get my 3-report guide" button — the form could not be submitted
 * at all. Nothing in typecheck, lint or the build catches that.
 */
describe("Turnstile site key", () => {
  const widget = readFileSync(new URL("./TurnstileWidget.tsx", import.meta.url), "utf8");
  const wrangler = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");

  const fallback = widget.match(/const productionSitekey = "([^"]+)"/)?.[1];
  const configured = wrangler.match(/"NEXT_PUBLIC_TURNSTILE_SITE_KEY":\s*"([^"]+)"/)?.[1];

  it("is declared in both places", () => {
    expect(fallback, "productionSitekey in TurnstileWidget.tsx").toBeTruthy();
    expect(configured, "NEXT_PUBLIC_TURNSTILE_SITE_KEY in wrangler.jsonc").toBeTruthy();
  });

  it("matches the key configured for the Worker", () => {
    expect(fallback).toBe(configured);
  });
});
