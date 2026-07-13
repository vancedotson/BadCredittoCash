"use client";

import { useEffect, useState } from "react";
import "../v3/v3.css";
import { Canvas } from "@/components/marketing-v3/shared/primitives";
import { usePageProgress } from "@/components/marketing-v3/shared/hooks";
import { CaseFileV4Page } from "@/components/marketing-v4/CaseFileV4Page";
import { CaseFileV5Page } from "@/components/marketing-v4/CaseFileV5Page";
import { DemoContext, type Version } from "@/components/marketing-v4/DemoToggles";

/**
 * /v4 — the Case File demo hub. A nav-bar toggle switches the whole page across
 * three versions:
 *   V1 = dark, justice gold        V2 = dark, credibility blue
 *   V3 = blue dark/light duotone (forces `.v5-page` so its scoped styles apply)
 * The choice persists to localStorage. Never touches /, /v2, or /v3.
 */
const KEY = "v4-version";

export default function V4Page() {
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
  // V1 = gold (no data-accent); V2 and V3 = blue.
  const dataAccent = version === "1" ? undefined : "blue";

  return (
    <DemoContext.Provider value={{ version, setVersion: pick }}>
      <div
        className={`v3${isDuotone ? " v5-page" : ""}`}
        data-variant="casefile"
        data-accent={dataAccent}
      >
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
