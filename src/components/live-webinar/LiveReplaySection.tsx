"use client";

import Link from "next/link";
import { Kicker, SectionScan } from "@/components/marketing-v3/shared/primitives";
import { useLiveSession } from "./LiveSessionProvider";

/** A permanent no-recording state; the live funnel never renders a replay player. */
export function LiveReplaySection() {
  const { href } = useLiveSession();
  return <main className="v3-section" style={{ paddingTop: "clamp(40px,6vw,72px)" }}>
    <SectionScan />
    <div className="v3-wrap" style={{ maxWidth: 760 }}>
      <Kicker>LIVE SESSION</Kicker>
      <h1 className="v3-display mt-5" style={{ fontSize: "clamp(32px,5vw,56px)", lineHeight: 1.05 }}>This session was not recorded.</h1>
      <p className="mt-5" style={{ maxWidth: 620, fontSize: 17, color: "var(--v3-mut)", lineHeight: 1.6 }}>Live webinars are not recorded, and no replay is available. You can still book a free strategy call to discuss your situation.</p>
      <Link className="v3-btn v3-btn-primary mt-8" href={href("/live/call")}>Book a free call</Link>
    </div>
  </main>;
}
