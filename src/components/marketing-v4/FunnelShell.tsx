"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import "../../app/v3/v3.css";
import { site } from "@/config/site-v3";
import { Canvas } from "@/components/marketing-v3/shared/primitives";
import { usePageProgress } from "@/components/marketing-v3/shared/hooks";
import { DemoContext, NavToggles, type Version } from "./DemoToggles";

/**
 * Shared shell for the webinar funnel steps (/webinar/*). Mirrors the /v4 page
 * shell so the whole funnel stays visually coherent: it reads the SAME
 * localStorage key ("v4-version"), provides DemoContext, and paints the `.v3`
 * root + Canvas + a minimal funnel header (logo + the V1/V2/V3 toggle). Because
 * the key is shared, whichever version the user picked on /v4 carries through
 * confirmation → room → call → booked, and the toggle keeps working on each.
 *
 * Each funnel page renders `<FunnelShell><SectionV4 /></FunnelShell>`.
 */
const KEY = "v4-version";

export function FunnelShell({ children }: { children: React.ReactNode }) {
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
  // V1 = gold (no data-accent); V2 and V3 = blue. Matches /v4.
  const dataAccent = version === "1" ? undefined : "blue";

  return (
    <DemoContext.Provider value={{ version, setVersion: pick }}>
      <div
        className={`v3${isDuotone ? " v5-page" : ""}`}
        data-variant="casefile"
        data-accent={dataAccent}
      >
        <Canvas />
        <div className="v3-content">
          <header style={{ borderBottom: "1px solid var(--v3-line)" }}>
            <div className="v3-wrap flex items-center justify-between py-4">
              <Link href="/v4" className="flex flex-col leading-none">
                <span
                  className="v3-display"
                  style={{ fontSize: 20, letterSpacing: "0.04em" }}
                >
                  VANCE DOTSON
                </span>
                <span
                  className="v3-mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: "0.22em",
                    color: "var(--v3-accent)",
                    marginTop: 3,
                  }}
                >
                  {site.ev.fileNo}
                </span>
              </Link>
              <NavToggles panel />
            </div>
          </header>
          {children}
        </div>
      </div>
    </DemoContext.Provider>
  );
}
