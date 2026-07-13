"use client";

import "../v3/v3.css";
import { Canvas } from "@/components/marketing-v3/shared/primitives";
import { usePageProgress } from "@/components/marketing-v3/shared/hooks";
import { CaseFileV4Page } from "@/components/marketing-v4/CaseFileV4Page";

/**
 * /v4 — the chosen "Case File" design, iterated one change at a time.
 * Single design (no variant switcher). Reuses the v3 "Evidence Room" stylesheet
 * and shared sections; dark-only, self-contained under `.v3`. Never touches the
 * live /, /v2, or /v3 pages.
 */
export default function V4Page() {
  usePageProgress();
  return (
    <div className="v3" data-variant="casefile">
      <Canvas />
      <div className="v3-rail" aria-hidden>
        <span />
      </div>
      <div className="v3-content">
        <CaseFileV4Page />
      </div>
    </div>
  );
}
