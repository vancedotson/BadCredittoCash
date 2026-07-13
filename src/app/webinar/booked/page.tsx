"use client";

import { FunnelShell } from "@/components/marketing-v4/FunnelShell";
import { BookedSectionV4 } from "@/components/marketing-v4/webinar/BookedSectionV4";

/**
 * /webinar/booked — funnel step 5. Onboarding after the call is booked.
 */
export default function WebinarBookedPage() {
  return (
    <FunnelShell>
      <BookedSectionV4 />
    </FunnelShell>
  );
}
