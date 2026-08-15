"use client";

import Link from "next/link";
import "../../app/v3/v3.css";
import { site } from "@/config/site-v3";
import { Canvas } from "@/components/marketing-v3/shared/primitives";
import { usePageProgress } from "@/components/marketing-v3/shared/hooks";

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
export function FunnelShell({ children }: { children: React.ReactNode }) {
  usePageProgress();

  return (
      <div className="v3" data-variant="casefile">
        <Canvas />
        <div className="v3-content">
          <header style={{ borderBottom: "1px solid var(--v3-line)" }}>
            <div className="v3-wrap flex items-center justify-between py-4">
              <Link href="/" className="flex flex-col leading-none">
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
            </div>
          </header>
          {children}
        </div>
      </div>
  );
}
