"use client";

import { FunnelShell } from "@/components/marketing-v4/FunnelShell";
import { BookCallV4 } from "@/components/marketing-v4/webinar/BookCallV4";

/**
 * /webinar/call — funnel step 4. The offer: book the free strategy call.
 * Reached from the room's timed CTA.
 */
export default function WebinarCallPage() {
  return (
    <FunnelShell>
      <BookCallV4 />
    </FunnelShell>
  );
}
