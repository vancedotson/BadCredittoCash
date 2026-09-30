import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Authorize.net webhook verification and parsing. Pure (no I/O).
 *
 * UNVERIFIED FACTS (see payments plan section 9.4 and 9.5): the header format
 * `X-ANET-Signature: sha512=<HEX>` and HMAC-SHA512 over the raw body are
 * documented; whether the HMAC key is the Signature Key's literal text (UTF-8
 * bytes of the 128-character hex string, as in the official samples) or its
 * hex-decoded bytes must be confirmed in sandbox. Switch SIGNATURE_KEY_ENCODING
 * below if sandbox deliveries fail verification with a correct key.
 */
export const AUTHORIZE_NET_SIGNATURE_HEADER = "x-anet-signature";
const SIGNATURE_KEY_ENCODING: "text" | "hex" = "text";

/** The single place the Signature Key becomes HMAC key bytes (plan 9.4). */
export function authorizeNetSignatureKeyBytes(signatureKey: string, encoding: "text" | "hex" = SIGNATURE_KEY_ENCODING): Buffer {
  const key = signatureKey.trim();
  if (encoding === "hex") {
    if (!/^(?:[0-9a-f]{2})+$/i.test(key)) throw new Error("Signature key is not hexadecimal.");
    return Buffer.from(key, "hex");
  }
  return Buffer.from(key, "utf8");
}

export function verifyAuthorizeNetSignature(rawBody: string, header: string | null, signatureKey: string): boolean {
  try {
    if (typeof rawBody !== "string" || !header || !signatureKey?.trim()) return false;
    const match = header.trim().match(/^sha512=([0-9a-f]{128})$/i);
    if (!match) return false;
    const supplied = Buffer.from(match[1].toLowerCase(), "hex");
    const expected = createHmac("sha512", authorizeNetSignatureKeyBytes(signatureKey)).update(rawBody, "utf8").digest();
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  } catch {
    return false;
  }
}

export type AuthorizeNetNotification = {
  notificationId: string;
  eventType: string;
  eventDate: string;
  webhookId?: string;
  payload: {
    entityName?: string;
    id?: string;
    responseCode?: number;
    authAmount?: number;
    invoiceNumber?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return undefined;
}

/**
 * Strictly typed subset of the notification. Payload fields are hints only:
 * the handler always confirms with getTransactionDetails before any state change.
 */
export function parseAuthorizeNetNotification(text: string): AuthorizeNetNotification | null {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return null; }
  if (!isRecord(parsed)) return null;
  const notificationId = boundedString(parsed.notificationId, 200);
  const eventType = boundedString(parsed.eventType, 200);
  const eventDate = boundedString(parsed.eventDate, 100) ?? "";
  if (!notificationId || !eventType) return null;
  const payload = isRecord(parsed.payload) ? parsed.payload : {};
  const rawId = typeof payload.id === "number" && Number.isSafeInteger(payload.id) ? String(payload.id) : payload.id;
  const id = boundedString(rawId, 64);
  return {
    notificationId,
    eventType,
    eventDate,
    webhookId: boundedString(parsed.webhookId, 200),
    payload: {
      entityName: boundedString(payload.entityName, 100),
      id: id && /^[A-Za-z0-9_-]+$/.test(id) ? id : undefined,
      responseCode: finiteNumber(payload.responseCode),
      authAmount: finiteNumber(payload.authAmount),
      invoiceNumber: boundedString(payload.invoiceNumber, 20),
    },
  };
}
