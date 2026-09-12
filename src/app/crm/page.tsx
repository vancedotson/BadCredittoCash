import { hydrateStore, getOverview, listEvents, listContactOptions, listOwners } from "@/lib/store";
import { requireCrmUser } from "@/lib/auth";
import { overviewRange } from "@/lib/overview-display";
import { OverviewControls } from "@/components/crm/OverviewControls";
import { OverviewQuickActions } from "@/components/crm/OverviewQuickActions";
import { OverviewActionQueue } from "@/components/crm/OverviewActionQueue";
import { OverviewMetrics, OverviewReports, OverviewWeek } from "@/components/crm/OverviewDashboard";

export const dynamic = "force-dynamic";

function str(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

export default async function CrmOverview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await hydrateStore();
  const sp = await searchParams;
  const rangeDays = overviewRange(str(sp.range));
  const [user, configuredOwners] = await Promise.all([requireCrmUser(), listOwners()]);
  const currentOwner = user.displayName && configuredOwners.includes(user.displayName) ? user.displayName : configuredOwners[0];
  const ownerParam = str(sp.owner);
  const owner = ownerParam === "__all__" ? undefined : ownerParam ?? currentOwner;
  const [data, recent, contacts] = await Promise.all([getOverview(rangeDays, owner), listEvents(8), listContactOptions()]);
  const canWrite = user.crmRole !== "readonly";
  const scopeLabel = owner === "__none__" ? "Unassigned contacts" : owner ? `${owner}’s contacts` : "All contacts";
  const asOf = new Date(data.generatedAt);
  const hour = asOf.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return <div data-testid="overview-dashboard" className="space-y-5">
    <header>
      <p className="mb-3 flex items-center gap-2 text-xs text-slate"><span>CRM</span><span aria-hidden="true">/</span><span>Overview</span></p>
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">Overview</h1><p className="mt-2 text-sm text-slate">{greeting}. Priorities, progress, and recent activity.</p></div>{canWrite ? <OverviewQuickActions contacts={contacts} owners={data.owners} canWrite={canWrite} /> : <span className="rounded-full border border-mist bg-card px-3 py-1.5 text-xs text-slate">Read-only access</span>}</div>
    </header>

    <div className="rounded-xl border border-mist bg-card px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><OverviewControls owners={data.owners} currentOwner={currentOwner} /><time dateTime={data.generatedAt} className="text-[11px] text-slate">Updated {asOf.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</time></div>
      <details className="mt-3 border-t border-mist pt-3"><summary className="cursor-pointer rounded text-[11px] text-slate hover:text-heading focus-visible:outline-2 focus-visible:outline-trust">How to read this overview</summary><p className="mt-2 max-w-4xl text-xs leading-relaxed text-slate">Owner selects contacts and the tasks attached to them, regardless of the task assignee. Date range changes the new-contact and booked-contact KPIs; the chart shows up to 30 days. Other cards show current or all-time totals, the weekly digest always covers the last seven days, and recent activity includes all owners. Metric, source, and segment links keep your owner selection. Contact lists do not inherit the date range; the task and pipeline workspaces have their own filters.</p></details>
    </div>

    <OverviewMetrics data={data} rangeDays={rangeDays} owner={owner} />
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]"><OverviewActionQueue key={`${owner ?? "all"}-${data.generatedAt}`} initialItems={data.actions} owners={data.owners} canWrite={canWrite} scopeLabel={scopeLabel} /><OverviewWeek data={data} scopeLabel={scopeLabel} /></div>
    <OverviewReports data={data} recent={recent} rangeDays={rangeDays} scopeLabel={scopeLabel} owner={owner} />
  </div>;
}
