"use client";

import { useEffect, useState } from "react";
import "../../app/v3/v3.css";
import { Canvas } from "@/components/marketing-v3/shared/primitives";
import { usePageProgress } from "@/components/marketing-v3/shared/hooks";
import { CaseFileV4Page } from "./CaseFileV4Page";
import { CaseFileV5Page } from "./CaseFileV5Page";
import { DemoContext, type Version } from "./DemoToggles";

/**
 * The v4 "Case File" home experience (shared by `/` and `/v4`). A nav-bar toggle
 * switches the whole page across three versions:
 *   V1 = dark, justice gold   V2 = dark, credibility blue
 *   V3 = blue dark/light duotone (forces `.v5-page`)
 * The choice persists to localStorage (same key the funnel reads).
 */
const KEY = "v4-version";

export function V4Home() {
  usePageProgress();
  const [version, setVersion] = useState<Version>("1");

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const v = localStorage.getItem(KEY);
      if (v === "1" || v === "2" || v === "3") setVersion(v);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const pick = (v: Version) => {
    setVersion(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* ignore */
    }
  };

  const isDuotone = version === "3";
  const dataAccent = version === "1" ? undefined : "blue";

  return (
    <DemoContext.Provider value={{ version, setVersion: pick }}>
      <div className={`v3${isDuotone ? " v5-page" : ""}`} data-variant="casefile" data-accent={dataAccent}>
        <Canvas />
        <div className="v3-rail" aria-hidden>
          <span />
        </div>
        <div className="v3-content">
          {isDuotone ? <CaseFileV5Page /> : <CaseFileV4Page />}
        </div>
      </div>
    </DemoContext.Provider>
  );
}
