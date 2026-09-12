"use client";

import Link from "next/link";
import "../../app/v3/v3.css";
import { site } from "@/config/site-v3";
import { Canvas } from "@/components/marketing-v3/shared/primitives";
import { usePageProgress } from "@/components/marketing-v3/shared/hooks";
import { LiveSessionProvider } from "./LiveSessionProvider";

/**
 * Shared shell for the LIVE webinar funnel steps (/live/*). Deliberately a
 * separate component from the evergreen FunnelShell so the live funnel can
 * diverge (countdown bar, "LIVE" status pill, session-aware header) without
 * touching the existing /webinar/* flow. Styling starts identical so the two
 * funnels look like the same brand.
 *
 * Each live funnel page renders `<LiveFunnelShell><Section /></LiveFunnelShell>`.
 */
export function LiveFunnelShell({ children }: { children: React.ReactNode }) {
  usePageProgress();

  return (
    <div className="v3" data-variant="casefile">
      <Canvas />
      <div className="v3-content">
        <header style={{ borderBottom: "1px solid var(--v3-line)" }}>
          <div className="v3-wrap flex items-center justify-between py-4">
            <Link href="/" className="flex flex-col leading-none">
              <span className="v3-display" style={{ fontSize: 20, letterSpacing: "0.04em" }}>
                VANCE DOTSON
              </span>
              <span
                className="v3-mono"
                style={{ fontSize: 9, letterSpacing: "0.22em", color: "var(--v3-accent)", marginTop: 3 }}
              >
                {site.ev.fileNo}
              </span>
            </Link>
          </div>
        </header>
        <LiveSessionProvider>{children}</LiveSessionProvider>
      </div>
    </div>
  );
}
