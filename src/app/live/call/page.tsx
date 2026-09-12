"use client";

import { LiveFunnelShell } from "@/components/live-webinar/LiveFunnelShell";
import { LiveBookCallSection } from "@/components/live-webinar/LiveBookCallSection";

/**
 * /live/call — live webinar funnel step 4. The offer: book the free strategy
 * call off the live session. Books through /api/book into the CRM and routes to
 * /live/booked.
 */
export default function LiveCallPage() {
  return (
    <LiveFunnelShell>
      <LiveBookCallSection />
    </LiveFunnelShell>
  );
}
