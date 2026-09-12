"use client";

import { LiveFunnelShell } from "@/components/live-webinar/LiveFunnelShell";
import { LiveRegisterSection } from "@/components/live-webinar/LiveRegisterSection";

/**
 * /live — live webinar funnel step 1. Registration + session picker.
 */
export default function LivePage() {
  return (
    <LiveFunnelShell>
      <LiveRegisterSection />
    </LiveFunnelShell>
  );
}
