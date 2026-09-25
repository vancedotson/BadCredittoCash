import { afterEach, describe, expect, it, vi } from "vitest";
import { cloudflareStreamCustomerOrigin, isConfiguredCloudflareStreamUrl } from "./cloudflare-stream-origin";

afterEach(() => vi.unstubAllEnvs());

describe("Cloudflare Stream customer origin", () => {
  it("accepts only the exact HTTPS customer origin", () => {
    vi.stubEnv("CLOUDFLARE_STREAM_CUSTOMER_ORIGIN", "https://customer-ab12.cloudflarestream.com");
    expect(cloudflareStreamCustomerOrigin()).toBe("https://customer-ab12.cloudflarestream.com");
    expect(isConfiguredCloudflareStreamUrl("https://customer-ab12.cloudflarestream.com/input/webRTC/play")).toBe(true);
    expect(isConfiguredCloudflareStreamUrl("https://customer-other.cloudflarestream.com/input/webRTC/play")).toBe(false);
  });

  it.each([
    "",
    "https://cloudflarestream.com",
    "https://customer-ab12.cloudflarestream.com.evil.example",
    "http://customer-ab12.cloudflarestream.com",
    "https://customer-ab12.cloudflarestream.com/path",
    "https://user@customer-ab12.cloudflarestream.com",
  ])("fails closed for invalid origins: %s", (origin) => {
    vi.stubEnv("CLOUDFLARE_STREAM_CUSTOMER_ORIGIN", origin);
    expect(cloudflareStreamCustomerOrigin()).toBeNull();
    expect(isConfiguredCloudflareStreamUrl("https://customer-ab12.cloudflarestream.com/input/webRTC/play")).toBe(false);
  });
});
