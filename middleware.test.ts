import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

describe("live playback security headers", () => {
  it("permits WHEP fetches only to Cloudflare Stream customer subdomains", async () => {
    const response = await middleware(new NextRequest("https://example.test/live/room"));
    const policy = response.headers.get("Content-Security-Policy") ?? "";
    expect(policy).toContain("connect-src");
    expect(policy).toContain("https://*.cloudflarestream.com");
    expect(policy).not.toContain("https://cloudflarestream.com");
  });
});
