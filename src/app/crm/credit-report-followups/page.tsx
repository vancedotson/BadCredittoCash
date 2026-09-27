import { requireCrmUser } from "@/lib/auth";
import { CreditReportFollowupsClient } from "@/components/crm/CreditReportFollowupsClient";

export const dynamic = "force-dynamic";

export default async function CreditReportFollowupsPage() {
  await requireCrmUser();
  return <CreditReportFollowupsClient />;
}
