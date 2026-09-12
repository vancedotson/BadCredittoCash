import { hydrateStore, listOwners } from "@/lib/store";
import { PageTitle } from "@/components/crm/ui";
import { ActivityFeed } from "@/components/crm/ActivityFeed";
import { getLiveWebinarSessions } from "@/lib/live-webinars";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  await hydrateStore();
  const [owners, sessions] = await Promise.all([listOwners(), getLiveWebinarSessions()]);
  return (
    <div className="space-y-6">
      <PageTitle title="Activity" subtitle="Everything happening across every contact." />
      <ActivityFeed owners={owners} sessions={sessions} />
    </div>
  );
}
