"use client";

import { LiveFunnelShell } from "@/components/live-webinar/LiveFunnelShell";
import { LiveBookedSection } from "@/components/live-webinar/LiveBookedSection";

/**
 * /live/booked — live webinar funnel step 5. Confirms the booked strategy call
 * and prepares the caller. Reached from the BookingWizard on /live/call.
 */
export default function LiveBookedPage() {
  return (
    <LiveFunnelShell>
      <LiveBookedSection />
    </LiveFunnelShell>
  );
}
