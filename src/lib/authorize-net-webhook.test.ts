import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  authorizeNetSignatureKeyBytes,
  parseAuthorizeNetNotification,
  verifyAuthorizeNetSignature,
} from "./authorize-net-webhook";

const KEY = "A1B2C3D4E5F60718293A4B5C6D7E8F90A1B2C3D4E5F60718293A4B5C6D7E8F90A1B2C3D4E5F60718293A4B5C6D7E8F90A1B2C3D4E5F60718293A4B5C6D7E8F90";

function sign(body: string, key = KEY) {
  return createHmac("sha512", key).update(body).digest("hex");
}

describe("Authorize.net webhook signature", () => {
  it("accepts the plan's test vector with upper- or lowercase hex", () => {
    const upper = `sha512=${createHmac("sha512", "KEY").update('{"a":1}').digest("hex").toUpperCase()}`;
    expect(verifyAuthorizeNetSignature('{"a":1}', upper, "KEY")).toBe(true);
    expect(verifyAuthorizeNetSignature('{"a":1}', upper.toLowerCase(), "KEY")).toBe(true);
    expect(verifyAuthorizeNetSignature('{"a":2}', upper, "KEY")).toBe(false);
  });

  it("uses the signature key's literal text as the HMAC key by default", () => {
    const body = '{"notificationId":"n-1"}';
    expect(verifyAuthorizeNetSignature(body, `sha512=${sign(body)}`, KEY)).toBe(true);
    expect(authorizeNetSignatureKeyBytes(KEY)).toEqual(Buffer.from(KEY, "utf8"));
    expect(authorizeNetSignatureKeyBytes(KEY, "hex")).toEqual(Buffer.from(KEY, "hex"));
  });

  it.each([
    null,
    "",
    "sha256=abc",
    `sha512=${"0".repeat(127)}`,
    `sha512=${"z".repeat(128)}`,
    `${sign("{}")}`,
  ])("rejects malformed header %s", (header) => {
    expect(verifyAuthorizeNetSignature("{}", header, KEY)).toBe(false);
  });

  it("rejects a signature made with another key or a missing key", () => {
    expect(verifyAuthorizeNetSignature("{}", `sha512=${sign("{}", "other")}`, KEY)).toBe(false);
    expect(verifyAuthorizeNetSignature("{}", `sha512=${sign("{}")}`, "")).toBe(false);
  });
});

describe("Authorize.net notification parsing", () => {
  it("extracts only the typed subset", () => {
    const parsed = parseAuthorizeNetNotification(JSON.stringify({
      notificationId: "d0e8e7fe-c3e7-4add-a480-27bc5ce28a15",
      eventType: "net.authorize.payment.authcapture.created",
      eventDate: "2026-09-29T12:00:00.0Z",
      webhookId: "wh-1",
      payload: { entityName: "transaction", id: 60123456789, responseCode: 1, authAmount: 150, invoiceNumber: "CRP-ABCDEFGH", extra: "x" },
    }));
    expect(parsed).toEqual({
      notificationId: "d0e8e7fe-c3e7-4add-a480-27bc5ce28a15",
      eventType: "net.authorize.payment.authcapture.created",
      eventDate: "2026-09-29T12:00:00.0Z",
      webhookId: "wh-1",
      payload: { entityName: "transaction", id: "60123456789", responseCode: 1, authAmount: 150, invoiceNumber: "CRP-ABCDEFGH" },
    });
  });

  it.each([
    "not json",
    "[]",
    JSON.stringify({ eventType: "x" }),
    JSON.stringify({ notificationId: "x".repeat(201), eventType: "x" }),
  ])("rejects invalid notifications", (text) => {
    expect(parseAuthorizeNetNotification(text)).toBeNull();
  });

  it("drops unsafe payload ids", () => {
    const parsed = parseAuthorizeNetNotification(JSON.stringify({
      notificationId: "n", eventType: "e", payload: { entityName: "transaction", id: "12/../34" },
    }));
    expect(parsed?.payload.id).toBeUndefined();
  });
});
