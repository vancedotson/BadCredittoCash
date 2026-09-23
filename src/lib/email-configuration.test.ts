import { describe, expect, it } from "vitest";
import { getBookingEmailConfiguration, isBookingEmailConfigurationReady } from "./email-configuration";

const valid = {
  EMAIL_FROM: "Bad Credit to Cash <updates@updates.badcredittocash.com>",
  EMAIL_REPLY_TO: "vance@vancethecreditdoctor.com",
};

describe("booking email configuration", () => {
  it("returns normalized, typed sender and reply-to values for usable mailboxes", () => {
    expect(getBookingEmailConfiguration({
      EMAIL_FROM: ` ${valid.EMAIL_FROM} `,
      EMAIL_REPLY_TO: ` ${valid.EMAIL_REPLY_TO} `,
    })).toEqual({ from: valid.EMAIL_FROM, replyTo: valid.EMAIL_REPLY_TO });
    expect(isBookingEmailConfigurationReady(valid)).toBe(true);
  });

  it.each([
    [{ EMAIL_REPLY_TO: valid.EMAIL_REPLY_TO }],
    [{ EMAIL_FROM: valid.EMAIL_FROM }],
    [{ EMAIL_FROM: "", EMAIL_REPLY_TO: valid.EMAIL_REPLY_TO }],
    [{ EMAIL_FROM: "Sender <not-an-address>", EMAIL_REPLY_TO: valid.EMAIL_REPLY_TO }],
    [{ EMAIL_FROM: valid.EMAIL_FROM, EMAIL_REPLY_TO: "not-an-address" }],
    [{ EMAIL_FROM: valid.EMAIL_FROM, EMAIL_REPLY_TO: "reply@localhost" }],
    [{ EMAIL_FROM: "Bad <sender@bad_domain.test>", EMAIL_REPLY_TO: valid.EMAIL_REPLY_TO }],
    [{ EMAIL_FROM: "Sender <sender@example.test>\r\nBcc: attacker@example.test", EMAIL_REPLY_TO: valid.EMAIL_REPLY_TO }],
  ])("fails closed for missing or malformed configuration %j", (env) => {
    expect(getBookingEmailConfiguration(env)).toBeNull();
    expect(isBookingEmailConfigurationReady(env)).toBe(false);
  });
});
