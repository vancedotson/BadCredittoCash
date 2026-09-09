import { describe, expect, it } from "vitest";
import { normalizeCreditCheckPhone, validateCreditCheckSubmission } from "./credit-check-validation";

const valid = {
  name: "  Test Visitor  ",
  email: "  TEST@example.com ",
  phone: "(202) 555-0100",
  answers: {
    how: ["Phone calls", "Letters in the mail"],
    recognize: "I'm not sure",
    report: "Haven't checked",
    disputed: "No",
    urgency: "Just exploring my options",
  },
};

describe("credit-check input validation", () => {
  it("normalizes contact details and preserves all five answers", () => {
    const result = validateCreditCheckSubmission(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      name: "Test Visitor", email: "test@example.com", phone: "+12025550100", answers: valid.answers,
      attribution: { firstTouch: {}, lastTouch: {} },
    });
  });

  it.each([null, [], "text", 42, true, { ...valid, marketingConsent: true }])("rejects unexpected top-level input %j", (input) => {
    expect(validateCreditCheckSubmission(input).ok).toBe(false);
  });

  it.each([
    { ...valid.answers, how: [] },
    { ...valid.answers, how: ["Phone calls", "Phone calls"] },
    { ...valid.answers, how: "Phone calls" },
    { ...valid.answers, how: ["invented option"] },
    { ...valid.answers, report: ["Yes"] },
    { ...valid.answers, urgency: undefined },
    { ...valid.answers, recognize: "made up" },
    { ...valid.answers, extra: "No" },
  ])("requires valid complete question answers %j", (answers) => {
    const result = validateCreditCheckSubmission({ ...valid, answers });
    expect(result).toMatchObject({ ok: false, fieldErrors: { answers: expect.any(String) } });
  });

  it("reports contact fields without throwing on wrong input types", () => {
    const result = validateCreditCheckSubmission({ ...valid, name: {}, email: [], phone: 12345 });
    expect(result).toMatchObject({
      ok: false, fieldErrors: { name: expect.any(String), email: expect.any(String), phone: expect.any(String) },
    });
  });

  it("rejects oversized names and missing required phone", () => {
    expect(validateCreditCheckSubmission({ ...valid, name: "a".repeat(161), phone: "" }))
      .toMatchObject({ ok: false, fieldErrors: { name: expect.any(String), phone: expect.any(String) } });
  });

  it("accepts bounded attribution and anonymous visitor identifiers", () => {
    const attribution = { firstTouch: { utm_source: "newsletter" }, lastTouch: { landing_page: "/credit-check" } };
    const result = validateCreditCheckSubmission({ ...valid, attribution, visitorId: "9db4d95d-fcf0-42ba-9421-5fa560d48d0d" });
    expect(result).toMatchObject({ ok: true, value: { attribution } });
  });

  it.each([
    { attribution: null },
    { attribution: { firstTouch: { arbitrary: "bad" } } },
    { attribution: { firstTouch: { utm_source: {} } } },
    { attribution: { lastTouch: { referrer: "a".repeat(2001) } } },
  ])("discards malformed optional attribution without blocking a valid lead %j", (fields) => {
    expect(validateCreditCheckSubmission({ ...valid, ...fields }))
      .toMatchObject({ ok: true, value: { attribution: { firstTouch: {}, lastTouch: {} } } });
  });

  it("ignores an extra utm_id supplied by the existing tracker and retains supported fields", () => {
    const result = validateCreditCheckSubmission({
      ...valid, attribution: { lastTouch: { utm_id: "ad-set-123", utm_source: "social", landing_page: "/credit-check?utm_id=ad-set-123" } },
    });
    expect(result).toMatchObject({ ok: true, value: { attribution: {
      firstTouch: {}, lastTouch: { utm_source: "social", landing_page: "/credit-check?utm_id=ad-set-123" },
    } } });
    if (result.ok) expect(result.value.attribution.lastTouch).not.toHaveProperty("utm_id");
  });

  it.each([
    { visitorId: { invalid: true } }, { turnstileToken: ["token"] },
  ])("rejects malformed visitor or security fields %j", (fields) => {
    expect(validateCreditCheckSubmission({ ...valid, ...fields }).ok).toBe(false);
  });
});

describe("required phone normalization", () => {
  it.each([
    ["202-555-0100", "+12025550100"],
    ["1 (202) 555-0100", "+12025550100"],
    ["+44 20 7946 0958", "+442079460958"],
    ["+351 912 345 678", "+351912345678"],
    ["", null], ["call 2025550100", null], ["12345", null], ["+0123456789", null],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeCreditCheckPhone(input)).toBe(expected);
  });
});
