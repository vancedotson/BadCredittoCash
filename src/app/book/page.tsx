"use client";

import { FunnelShell } from "@/components/marketing-v4/FunnelShell";
import { BookSchedulerV4 } from "@/components/marketing-v4/book/BookSchedulerV4";

/**
 * /book — standalone strategy-call scheduler for non-webinar sequences (nurture,
 * direct outreach). Same case-file shell + V1/V2/V3 toggle as the funnel; books
 * through /api/book so it lands in the CRM.
 */
export default function BookPage() {
  return (
    <FunnelShell>
      <BookSchedulerV4 />
    </FunnelShell>
  );
}
