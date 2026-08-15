"use client";

import { FunnelShell } from "@/components/marketing-v4/FunnelShell";
import { BookSchedulerV4 } from "@/components/marketing-v4/book/BookSchedulerV4";

/**
 * /book — standalone strategy-call scheduler for non-webinar sequences (nurture,
 * direct outreach). Uses the same case-file shell as the funnel and books
 * through /api/book so the appointment lands in the CRM.
 */
export default function BookPage() {
  return (
    <FunnelShell>
      <BookSchedulerV4 />
    </FunnelShell>
  );
}
