"use client";

import { LiveFunnelShell } from "@/components/live-webinar/LiveFunnelShell";
import { LiveRoomSection } from "@/components/live-webinar/LiveRoomSection";

/**
 * /live/room — step 3. The live room: stream, chat, timed CTA.
 */
export default function LiveRoomPage() {
  return (
    <LiveFunnelShell>
      <LiveRoomSection />
    </LiveFunnelShell>
  );
}
