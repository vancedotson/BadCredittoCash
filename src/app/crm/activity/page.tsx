import { listOwners } from "@/lib/store";
import { PageTitle } from "@/components/crm/ui";
import { ActivityFeed } from "@/components/crm/ActivityFeed";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const owners = await listOwners();
  return (
    <div className="space-y-6">
      <PageTitle title="Activity" subtitle="Everything happening across every contact." />
      <ActivityFeed owners={owners} />
    </div>
  );
}
