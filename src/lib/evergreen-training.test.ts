import { afterEach, describe, expect, it, vi } from "vitest";
import { evergreenTrainingEnabled } from "./evergreen-training";

describe("evergreen training availability", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["true", true],
    ["false", false],
    ["TRUE", false],
    ["1", false],
    ["", false],
    [undefined, false],
  ])("accepts only the exact enabled value %j", (value, expected) => {
    if (value === undefined) vi.stubEnv("EVERGREEN_TRAINING_ENABLED", undefined);
    else vi.stubEnv("EVERGREEN_TRAINING_ENABLED", value);

    expect(evergreenTrainingEnabled()).toBe(expected);
  });
});
