"use client";

import { LiveFunnelShell } from "@/components/live-webinar/LiveFunnelShell";
import { LiveConfirmedSection } from "@/components/live-webinar/LiveConfirmedSection";

/**
 * /live/confirmed — live webinar funnel step 2. The show-up lever: countdown,
 * add-to-calendar, and where the joining link comes from. Reached from the
 * registration form on /live (redirectTo="/live/confirmed").
 */
export default function LiveConfirmedPage() {
  return (
    <LiveFunnelShell>
      <LiveConfirmedSection />
    </LiveFunnelShell>
  );
}
