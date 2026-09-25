import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CLOUDFLARE_STREAM_PLAYBACK_TOKEN_TTL_SECONDS, cloudflareStreamPlaybackSigningConfigured, createCloudflareLivePlaybackUrl } from "./cloudflare-stream-token";

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
  vi.stubEnv("CLOUDFLARE_STREAM_CUSTOMER_ORIGIN", "https://customer-ab12.cloudflarestream.com");
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
    expect(claims).toMatchObject({ sub: inputId, kid: "test-key-1", nbf: now / 1000 - 10, exp: now / 1000 + 120 });
    expect(CLOUDFLARE_STREAM_PLAYBACK_TOKEN_TTL_SECONDS).toBe(120);
    expect(claims.jti).toEqual(expect.any(String));
    expect(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, toArrayBuffer(decodeBase64Url(signaturePart)), toArrayBuffer(new TextEncoder().encode(`${headerPart}.${payloadPart}`)))).toBe(true);
  });

  it("keeps the bearer replay window short and gives separate issuances distinct credentials", async () => {
    const now = Date.parse("2026-09-25T12:00:00Z");
    const issue = () => createCloudflareLivePlaybackUrl({
      endpoint: `https://customer-ab12.cloudflarestream.com/${inputId}/webRTC/play`, liveInputId: inputId, now,
    });
    const first = new URL(await issue()).pathname.split("/")[1];
    const second = new URL(await issue()).pathname.split("/")[1];
    const firstClaims = decodeJson(first.split(".")[1]);
    expect(first).not.toBe(second);
    expect(firstClaims.exp * 1000).toBe(now + CLOUDFLARE_STREAM_PLAYBACK_TOKEN_TTL_SECONDS * 1000);
    expect(now < firstClaims.exp * 1000).toBe(true);
    expect(now + CLOUDFLARE_STREAM_PLAYBACK_TOKEN_TTL_SECONDS * 1000 >= firstClaims.exp * 1000).toBe(true);
  });

  it("detects a tampered signed playback credential", async () => {
    const url = new URL(await createCloudflareLivePlaybackUrl({
      endpoint: `https://customer-ab12.cloudflarestream.com/${inputId}/webRTC/play`, liveInputId: inputId,
    }));
    const token = url.pathname.split("/")[1];
    const [headerPart, payloadPart, signaturePart] = token.split(".");
    const tamperedSignature = `${signaturePart[0] === "A" ? "B" : "A"}${signaturePart.slice(1)}`;
    expect(await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey,
      toArrayBuffer(decodeBase64Url(tamperedSignature)),
      toArrayBuffer(new TextEncoder().encode(`${headerPart}.${payloadPart}`)))).toBe(false);
  });

  it.each([
    { endpoint: `https://customer-ab12.cloudflarestream.com/${inputId}/iframe`, liveInputId: inputId },
    { endpoint: `https://customer-ab12.cloudflarestream.com.evil.example/${inputId}/webRTC/play`, liveInputId: inputId },
    { endpoint: `https://customer-ab12.cloudflarestream.com/${inputId}/webRTC/play?redirect=1`, liveInputId: inputId },
    { endpoint: `https://customer-other.cloudflarestream.com/${inputId}/webRTC/play`, liveInputId: inputId },
    { endpoint: `https://customer-ab12.cloudflarestream.com/${inputId}/webRTC/play`, liveInputId: "invalid" },
  ])("rejects unsafe endpoint and identity combinations %j", async (input) => {
    await expect(createCloudflareLivePlaybackUrl(input)).rejects.toThrow();
  });

  it("does not treat malformed signing configuration as ready", () => {
    vi.stubEnv("CLOUDFLARE_STREAM_SIGNING_KEY_JWK", btoa(JSON.stringify({ kty: "RSA", n: "only-public", e: "AQAB" })));
    expect(cloudflareStreamPlaybackSigningConfigured()).toBe(false);
  });
});
