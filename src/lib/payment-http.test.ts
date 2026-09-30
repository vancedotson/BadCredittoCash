import { describe, expect, it } from "vitest";
import { hasPaymentSameOrigin } from "@/lib/payment-http";

const CHECKOUT_URL = "https://creditrepairparty.com/api/pay/token/checkout";

function post(headers: Record<string, string>, url = CHECKOUT_URL): Request {
  return new Request(url, { method: "POST", headers });
}

describe("hasPaymentSameOrigin", () => {
  it("accepts Origin null from a same-origin no-referrer form post", () => {
    expect(hasPaymentSameOrigin(post({ origin: "null", "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("rejects Origin null from a cross-site post", () => {
    expect(hasPaymentSameOrigin(post({ origin: "null", "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("rejects Origin null without Sec-Fetch-Site", () => {
    expect(hasPaymentSameOrigin(post({ origin: "null" }))).toBe(false);
  });

  it("rejects Origin null from a same-site (sibling subdomain) or user-initiated post", () => {
    expect(hasPaymentSameOrigin(post({ origin: "null", "sec-fetch-site": "same-site" }))).toBe(false);
    expect(hasPaymentSameOrigin(post({ origin: "null", "sec-fetch-site": "none" }))).toBe(false);
  });

  it("accepts an exact same origin", () => {
    expect(hasPaymentSameOrigin(post({ origin: "https://creditrepairparty.com" }))).toBe(true);
    expect(hasPaymentSameOrigin(post({ origin: "https://creditrepairparty.com", "sec-fetch-site": "same-origin" }))).toBe(true);
  });

  it("rejects a foreign origin, even when Sec-Fetch-Site claims same-origin", () => {
    expect(hasPaymentSameOrigin(post({ origin: "https://evil.example" }))).toBe(false);
    expect(hasPaymentSameOrigin(post({ origin: "https://evil.example", "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(hasPaymentSameOrigin(post({ origin: "https://creditrepairparty.com", "sec-fetch-site": "cross-site" }))).toBe(false);
  });

  it("keeps missing-Origin and host sanity handling", () => {
    expect(hasPaymentSameOrigin(post({ "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(hasPaymentSameOrigin(post({}), false)).toBe(true);
    expect(hasPaymentSameOrigin(post({ origin: "https://creditrepairparty.com", host: "evil.example/x" }))).toBe(false);
  });
});
