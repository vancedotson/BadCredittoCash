import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cloudflareStreamAllowedOriginHosts } from "./cloudflare-stream-allowed-origins";

afterEach(() => vi.unstubAllEnvs());

describe("Cloudflare Stream attendee allowed origins", () => {
  it("parses the rehearsal Worker origin and final custom domain", () => {
    expect(cloudflareStreamAllowedOriginHosts(
      "https://vance-dotson.vancedotson.workers.dev,https://badcredittocash.com",
    )).toEqual(["badcredittocash.com", "vance-dotson.vancedotson.workers.dev"]);
  });

  it("trims whitespace, removes root slashes, lowercases and deduplicates hostnames", () => {
    expect(cloudflareStreamAllowedOriginHosts(
      " , HTTPS://Example.COM/ , https://example.com:443, , https://www.example.com/ ",
    )).toEqual(["example.com", "www.example.com"]);
  });

  it.each([
    "http://example.com",
    "https://*.example.com",
    "https://example.com/path",
    "https://example.com/?q=1",
    "https://example.com/#fragment",
    "https://user:password@example.com",
    "https://127.0.0.1",
    "https://[::1]",
    "https://example.com:8443",
    "https://example.com.",
  ])("rejects malformed entry without retaining a valid subset: %s", (invalid) => {
    expect(cloudflareStreamAllowedOriginHosts(`https://valid.example,${invalid}`)).toBeNull();
  });

  it("returns null when absent or only empty comma segments are supplied", () => {
    vi.stubEnv("CLOUDFLARE_STREAM_ALLOWED_ORIGINS", undefined);
    expect(cloudflareStreamAllowedOriginHosts()).toBeNull();
    expect(cloudflareStreamAllowedOriginHosts(" , , ")).toBeNull();
  });

  it("rejects more than two unique attendee hosts", () => {
    expect(cloudflareStreamAllowedOriginHosts(
      "https://one.example,https://two.example,https://three.example",
    )).toBeNull();
  });
});
