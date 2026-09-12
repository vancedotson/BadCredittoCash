"use client";

import { LiveFunnelShell } from "@/components/live-webinar/LiveFunnelShell";
import { LiveReplaySection } from "@/components/live-webinar/LiveReplaySection";

/**
 * /live/replay — optional recording for no-shows and late registrants.
 * Gated on `replay.isPublished`; while that's false the page says plainly that
 * no recording exists rather than 404ing or implying one is coming.
 */
export default function LiveReplayPage() {
  return (
    <LiveFunnelShell>
      <LiveReplaySection />
    </LiveFunnelShell>
  );
}
