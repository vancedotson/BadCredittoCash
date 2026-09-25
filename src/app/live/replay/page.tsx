"use client";

import { LiveFunnelShell } from "@/components/live-webinar/LiveFunnelShell";
import { LiveReplaySection } from "@/components/live-webinar/LiveReplaySection";

/**
 * /live/replay — retained as a no-recording notice. Live sessions are not recorded.
 */
export default function LiveReplayPage() {
  return (
    <LiveFunnelShell>
      <LiveReplaySection />
    </LiveFunnelShell>
  );
}
