import { describe, expect, it } from "vitest";
import { metadata as confirmedMetadata } from "./confirmed/layout";
import { metadata as roomMetadata } from "./room/layout";

describe("retired webinar route indexing metadata", () => {
  it.each([
    ["confirmation", confirmedMetadata],
    ["room", roomMetadata],
  ])("keeps the %s route noindex and nofollow if enabled later", (_route, metadata) => {
    expect(metadata).toMatchObject({ robots: { index: false, follow: false } });
  });
});
