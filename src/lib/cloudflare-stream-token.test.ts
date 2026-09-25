import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cloudflareStreamPlaybackSigningConfigured, createCloudflareLivePlaybackUrl } from "./cloudflare-stream-token";

const inputId = "0123456789abcdef0123456789abcdef";
let privateKey: CryptoKey;
let publicKey: CryptoKey;

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64 + "=".repeat((4 - base64.length % 4) % 4)), (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function decodeJson(value: string) { return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))); }

beforeEach(async () => {
  const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;
  vi.stubEnv("CLOUDFLARE_STREAM_SIGNING_KEY_ID", "test-key-1");
  vi.stubEnv("CLOUDFLARE_STREAM_SIGNING_KEY_JWK", btoa(JSON.stringify(await crypto.subtle.exportKey("jwk", privateKey))));
});

afterEach(() => vi.unstubAllEnvs());

describe("signed Cloudflare Stream WHEP playback URLs", () => {
  it("signs a short-lived RS256 token scoped to the live input", async () => {
    const now = Date.parse("2026-09-25T12:00:00Z");
    const url = new URL(await createCloudflareLivePlaybackUrl({
      endpoint: `https://customer-ab12.cloudflarestream.com/${inputId}/webRTC/play`, liveInputId: inputId, now,
    }));
    const token = url.pathname.split("/")[1];
    const [headerPart, payloadPart, signaturePart] = token.split(".");
    const header = decodeJson(headerPart);
    const claims = decodeJson(payloadPart);
    expect(url.origin).toBe("https://customer-ab12.cloudflarestream.com");
    expect(url.pathname).toBe(`/${token}/webRTC/play`);
    expect(header).toMatchObject({ alg: "RS256", kid: "test-key-1", typ: "JWT" });
    expect(claims).toMatchObject({ sub: inputId, kid: "test-key-1", nbf: now / 1000 - 30, exp: now / 1000 + 900 });
    expect(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, toArrayBuffer(decodeBase64Url(signaturePart)), toArrayBuffer(new TextEncoder().encode(`${headerPart}.${payloadPart}`)))).toBe(true);
  });

  it.each([
    { endpoint: `https://customer-ab12.cloudflarestream.com/${inputId}/iframe`, liveInputId: inputId },
    { endpoint: `https://customer-ab12.cloudflarestream.com.evil.example/${inputId}/webRTC/play`, liveInputId: inputId },
    { endpoint: `https://customer-ab12.cloudflarestream.com/${inputId}/webRTC/play?redirect=1`, liveInputId: inputId },
    { endpoint: `https://customer-ab12.cloudflarestream.com/${inputId}/webRTC/play`, liveInputId: "invalid" },
  ])("rejects unsafe endpoint and identity combinations %j", async (input) => {
    await expect(createCloudflareLivePlaybackUrl(input)).rejects.toThrow();
  });

  it("does not treat malformed signing configuration as ready", () => {
    vi.stubEnv("CLOUDFLARE_STREAM_SIGNING_KEY_JWK", btoa(JSON.stringify({ kty: "RSA", n: "only-public", e: "AQAB" })));
    expect(cloudflareStreamPlaybackSigningConfigured()).toBe(false);
  });
});
