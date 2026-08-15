"use client";

import "../../app/v3/v3.css";
import { Canvas } from "@/components/marketing-v3/shared/primitives";
import { usePageProgress } from "@/components/marketing-v3/shared/hooks";
import { CaseFileV4Page } from "./CaseFileV4Page";

/**
 * The chosen "Case File" home experience shared by `/` and `/v4`.
 * Design controls stay out of the customer-facing landing page.
 */
export function V4Home() {
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
