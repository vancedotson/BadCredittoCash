import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { isUuid } from "./live-webinar-types";

export type LiveParticipantClaims = { registrationId: string; sessionId: string; accessVersion: number; expiresAt: number };

export function liveSigningSecret(): string {
  const secret = process.env.EMAIL_SIGNING_SECRET;
  if (!secret || secret.length < 24) throw new Error("Live webinar signing is not configured.");
  return secret;
}

export function createLiveParticipantToken(claims: LiveParticipantClaims): string {
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", liveSigningSecret()).update(`live-participant-v1:${body}`).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyLiveParticipantToken(token: string, now = Date.now()): LiveParticipantClaims | null {
  if (!token || token.length > 1200) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const expected = createHmac("sha256", liveSigningSecret()).update(`live-participant-v1:${parts[0]}`).digest();
    const supplied = Buffer.from(parts[1], "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const claims = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as LiveParticipantClaims;
    if (!isUuid(claims.registrationId) || !isUuid(claims.sessionId)
      || !Number.isInteger(claims.accessVersion) || claims.accessVersion < 1
      || !Number.isSafeInteger(claims.expiresAt) || claims.expiresAt <= now) return null;
    return claims;
  } catch { return null; }
}

export function liveParticipantCookie(sessionId: string): string {
  return `vance-live-${sessionId}`;
}
