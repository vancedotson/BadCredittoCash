"use client";

import { FunnelShell } from "@/components/marketing-v4/FunnelShell";
import { WebinarRoomV4 } from "@/components/marketing-v4/webinar/WebinarRoomV4";

/**
 * /webinar/room — funnel step 3. The training. The player fires watch-progress
 * events and reveals the "book the call" CTA at the pitch mark.
 */
export default function WebinarRoomPage() {
  return (
    <FunnelShell>
      <WebinarRoomV4 />
    </FunnelShell>
  );
}
