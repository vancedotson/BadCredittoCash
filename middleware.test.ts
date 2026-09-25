import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

describe("live playback security headers", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("permits WHEP fetches only to the configured exact Cloudflare Stream customer origin", async () => {
    vi.stubEnv("CLOUDFLARE_STREAM_CUSTOMER_ORIGIN", "https://customer-ab12.cloudflarestream.com");
    const response = await middleware(new NextRequest("https://example.test/live/room"));
    const policy = response.headers.get("Content-Security-Policy") ?? "";
    const directives = Object.fromEntries(policy.split("; ").map((part) => {
      const [name, ...sources] = part.split(" ");
      return [name, sources];
    }));
    expect(directives["connect-src"]).toContain("https://customer-ab12.cloudflarestream.com");
    expect(directives["connect-src"]).not.toContain("https://*.cloudflarestream.com");
    expect(directives["connect-src"]).not.toContain("https://customer-other.cloudflarestream.com");
    expect(directives["media-src"]).toEqual(["'self'", "blob:"]);
  });

  it.each([
    "",
    "https://cloudflarestream.com",
    "https://customer-ab12.cloudflarestream.com.evil.example",
    "https://customer-ab12.cloudflarestream.com/path",
    "http://customer-ab12.cloudflarestream.com",
  ])("does not widen CSP for invalid or missing Stream origins: %s", async (origin) => {
    vi.stubEnv("CLOUDFLARE_STREAM_CUSTOMER_ORIGIN", origin);
    const response = await middleware(new NextRequest("https://example.test/live/room"));
    const policy = response.headers.get("Content-Security-Policy") ?? "";
    const connectSrc = policy.split("; ").find((part) => part.startsWith("connect-src ")) ?? "";
    expect(connectSrc).not.toContain("cloudflarestream.com");
    expect(policy).not.toContain("media-src 'self' blob: https:");
  });
});
