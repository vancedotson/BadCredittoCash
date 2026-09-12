import { requireCrmUser } from "@/lib/auth";
import { getLiveWebinarWorkspace, liveWebinarsEnabled } from "@/lib/live-webinars";
import { LiveWebinarManager } from "@/components/crm/LiveWebinarManager";

export const dynamic = "force-dynamic";

export default async function LiveWebinarsPage({ searchParams }: { searchParams: Promise<{ sessionId?: string | string[] }> }) {
  const user = await requireCrmUser();
  const [{ sessions, now }, query] = await Promise.all([getLiveWebinarWorkspace(), searchParams]);
  return <LiveWebinarManager initialSessions={sessions} initialNow={now} calendarTimezone={process.env.BUSINESS_TIMEZONE || "America/Chicago"} initialSessionId={typeof query.sessionId === "string" ? query.sessionId : undefined} canWrite={user.crmRole !== "readonly"} siteEnabled={liveWebinarsEnabled()} />;
}
