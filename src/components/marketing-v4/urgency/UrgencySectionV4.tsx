"use client";

import { SectionScan } from "../../marketing-v3/shared/primitives";
import { UrgencyLedger } from "./variants";

/**
 * v4 "Clock // Time-sensitive" (Urgency) — the chosen "Cost Ledger": a hairline
 * row of accruing consequence cells over an ambient radar, closed by the
 * single-advocate capacity strip. Hovering a line lights it in its procedure
 * step color, glows the background, and expands it to reveal a reassuring line.
 * Honest urgency only: no countdown, no fabricated figures, ⚠️ kept on the
 * time-sensitive claim. `relative overflow-hidden` scopes the background radar.
 */
export function UrgencySectionV4() {
  return (
    <section className="v3-section v4-urg-sticky relative overflow-hidden" id="urgency">
      <SectionScan />
      <UrgencyLedger />
    </section>
  );
}
