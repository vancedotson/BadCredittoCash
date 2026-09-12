import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLiveParticipantToken, verifyLiveParticipantToken, liveParticipantCookie } from "./live-webinar-token";

const claims = { registrationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", sessionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", accessVersion: 2, expiresAt: 2_000_000_000_000 };

describe("live participant tokens", () => {
  beforeEach(() => vi.stubEnv("EMAIL_SIGNING_SECRET", "test-only-signing-secret-at-least-32-chars"));
  afterEach(() => vi.unstubAllEnvs());
  it("verifies the registration and session without including a name or email", () => {
    const token = createLiveParticipantToken(claims);
    expect(verifyLiveParticipantToken(token, claims.expiresAt - 1)).toEqual(claims);
    expect(Buffer.from(token.split(".")[0], "base64url").toString()).not.toMatch(/email|name|contactId/);
    expect(liveParticipantCookie(claims.sessionId)).not.toBe(liveParticipantCookie(claims.registrationId));
  });
  it("rejects expired, tampered and differently signed tokens", () => {
    const token = createLiveParticipantToken(claims);
    expect(verifyLiveParticipantToken(token, claims.expiresAt)).toBeNull();
    const tampered = Buffer.from(JSON.stringify({ ...claims, accessVersion: 3 })).toString("base64url") + "." + token.split(".")[1];
    expect(verifyLiveParticipantToken(tampered, 0)).toBeNull();
    vi.stubEnv("EMAIL_SIGNING_SECRET", "different-test-only-signing-secret-32");
    expect(verifyLiveParticipantToken(token, 0)).toBeNull();
  });
  it.each(["", "not.a.valid.token", ".", "x".repeat(1300)])("rejects malformed token %s", (token) => {
    expect(verifyLiveParticipantToken(token, 0)).toBeNull();
  });
  it("fails closed when signing is unconfigured", () => {
    vi.stubEnv("EMAIL_SIGNING_SECRET", "");
    expect(() => createLiveParticipantToken(claims)).toThrow("not configured");
  });
});
