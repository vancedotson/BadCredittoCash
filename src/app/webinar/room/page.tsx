import { Suspense } from "react";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FunnelShell } from "@/components/marketing-v4/FunnelShell";
import {
  ReviewableWebinarRoomV4,
  WebinarRoomV4,
} from "@/components/marketing-v4/webinar/WebinarRoomV4";
import { evergreenTrainingEnabled } from "@/lib/evergreen-training";
import { CREDIT_REPORT_WEBINAR_COOKIE, findCompletedCreditReportSession } from "@/lib/credit-reports";

/**
 * /webinar/room — funnel step 3. The training. The player fires watch-progress
 * events and reveals the "book the call" CTA at the pitch mark.
 */
export default async function WebinarRoomPage() {
  await connection();
  if (!evergreenTrainingEnabled()) {
    const token = (await cookies()).get(CREDIT_REPORT_WEBINAR_COOKIE)?.value;
    const completedSession = token ? await findCompletedCreditReportSession(token) : null;
    if (!completedSession) redirect("/book");
  }

  return (
    <FunnelShell>
      <Suspense fallback={<WebinarRoomV4 reviewMode />}>
        <ReviewableWebinarRoomV4 />
      </Suspense>
    </FunnelShell>
  );
}
