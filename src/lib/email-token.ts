import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const MESSAGE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function signingSecret(): string {
  const secret = process.env.EMAIL_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("EMAIL_SIGNING_SECRET is not configured.");
  }
  return secret;
}

function signature(messageId: string): Buffer {
  return createHmac("sha256", signingSecret())
    .update(`unsubscribe:v1:${messageId}`)
    .digest();
}

export function createUnsubscribeToken(messageId: string): string {
  if (!MESSAGE_ID.test(messageId)) throw new Error("Invalid message ID.");
  return `${messageId}.${signature(messageId).toString("base64url")}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  if (token.length > 160) return null;
  const separator = token.indexOf(".");
  if (separator < 0) return null;
  const messageId = token.slice(0, separator);
  const encodedSignature = token.slice(separator + 1);
  if (!MESSAGE_ID.test(messageId) || !encodedSignature) return null;

  try {
    const supplied = Buffer.from(encodedSignature, "base64url");
    const expected = signature(messageId);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected)
      ? messageId
      : null;
  } catch {
    return null;
  }
}

