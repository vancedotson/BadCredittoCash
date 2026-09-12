import { requireCrmUser } from "@/lib/auth";
import { getLiveWebinarSessions, liveWebinarsEnabled } from "@/lib/live-webinars";
import { PageTitle } from "@/components/crm/ui";
import { LiveWebinarManager } from "@/components/crm/LiveWebinarManager";

export const dynamic = "force-dynamic";

export default async function LiveWebinarsPage({ searchParams }: { searchParams: Promise<{ sessionId?: string | string[] }> }) {
  const user = await requireCrmUser();
  const [sessions, query] = await Promise.all([getLiveWebinarSessions(), searchParams]);
  return <div className="space-y-6">
    <PageTitle title="Live webinars" subtitle="Manage sessions and see each participant's history." />
    <LiveWebinarManager initialSessions={sessions} initialSessionId={typeof query.sessionId === "string" ? query.sessionId : undefined} canWrite={user.crmRole !== "readonly"} siteEnabled={liveWebinarsEnabled()} />
  </div>;
}
