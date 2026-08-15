"use client";

import { Suspense } from "react";
import { FunnelShell } from "@/components/marketing-v4/FunnelShell";
import {
  ReviewableWebinarRoomV4,
  WebinarRoomV4,
} from "@/components/marketing-v4/webinar/WebinarRoomV4";

/**
 * /webinar/room — funnel step 3. The training. The player fires watch-progress
 * events and reveals the "book the call" CTA at the pitch mark.
 */
export default function WebinarRoomPage() {
  return (
    <FunnelShell>
      <Suspense fallback={<WebinarRoomV4 reviewMode />}>
        <ReviewableWebinarRoomV4 />
      </Suspense>
    </FunnelShell>
  );
}
