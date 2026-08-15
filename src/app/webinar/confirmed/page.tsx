"use client";

import { Suspense } from "react";
import { FunnelShell } from "@/components/marketing-v4/FunnelShell";
import {
  ConfirmedSectionV4,
  ReviewableConfirmedSectionV4,
} from "@/components/marketing-v4/webinar/ConfirmedSectionV4";

/**
 * /webinar/confirmed — funnel step 2. Reached from the /v4 registration form
 * (RegistrationFormV3 redirectTo="/webinar/confirmed"). The show-up lever.
 */
export default function WebinarConfirmedPage() {
  return (
    <FunnelShell>
      <Suspense fallback={<ConfirmedSectionV4 trackView={false} />}>
        <ReviewableConfirmedSectionV4 />
      </Suspense>
    </FunnelShell>
  );
}
