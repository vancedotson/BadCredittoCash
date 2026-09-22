import type { Metadata } from "next";
import { LiveFunnelShell } from "@/components/live-webinar/LiveFunnelShell";
import { LiveRegisterSection } from "@/components/live-webinar/LiveRegisterSection";
import { livePageMetadata } from "@/lib/route-metadata";

export const metadata: Metadata = livePageMetadata;

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
