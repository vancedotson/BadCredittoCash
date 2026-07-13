"use client";

import { SectionScan } from "../../marketing-v3/shared/primitives";
import { RiskPanel } from "./variants";

/**
 * v4 "Terms // No risk" (Risk Reversal) — the chosen "Terms Panel": a headline
 * with "nothing to lose" accented, beside a glass case-terms document whose
 * clauses expand on hover/focus to reveal a short calming line. No money-back /
 * guarantee claims (project compliance rule).
 */
export function RiskSectionV4() {
  return (
    <section className="v3-section relative" id="risk">
      <SectionScan />
      <RiskPanel />
    </section>
  );
}
