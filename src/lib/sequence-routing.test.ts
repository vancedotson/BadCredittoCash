import { describe, expect, it } from "vitest";
import { SEGMENT_SEQUENCES } from "@/config/sequences";
import { SEQUENCE_FOR_SEGMENT } from "./sequence-routing";

describe("segment sequence routing", () => {
  it("routes every actionable non-booked segment to an existing sequence", () => {
    for (const [segment, sequenceId] of Object.entries(SEQUENCE_FOR_SEGMENT)) {
      if (sequenceId) expect(SEGMENT_SEQUENCES[sequenceId]?.id, segment).toBe(sequenceId);
    }
  });

  it("does not pitch booked contacts or unqualified page-view leads", () => {
    expect(SEQUENCE_FOR_SEGMENT.booked).toBeNull();
    expect(SEQUENCE_FOR_SEGMENT.lead).toBeNull();
  });
});
