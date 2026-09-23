import { afterEach, describe, expect, it, vi } from "vitest";
import { marketingEmailsEnabled } from "./marketing-emails";

describe("marketing email availability", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["true", true],
    ["false", false],
    ["TRUE", false],
    ["True", false],
    ["1", false],
    ["yes", false],
    ["", false],
    [" ", false],
    [undefined, false],
  ])("accepts only the exact enabled value %j", (value, expected) => {
    if (value === undefined) vi.stubEnv("MARKETING_EMAILS_ENABLED", undefined);
    else vi.stubEnv("MARKETING_EMAILS_ENABLED", value);

    expect(marketingEmailsEnabled()).toBe(expected);
  });
});
