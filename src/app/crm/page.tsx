import Link from "next/link";
import {
  getCrmStats,
  getFunnelStats,
  getSourceStats,
  getLeadsTimeSeries,
  listEvents,
  listAllTasks,
} from "@/lib/store";
import { displayEvent } from "@/lib/event-display";
import {
  PageTitle,
  KpiTile,
  Card,
  FunnelBars,
  Badge,
  SegmentBadge,
  EventGlyph,
  toneClass,
} from "@/components/crm/ui";

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function dueLabel(iso?: string): { text: string; overdue: boolean } {
  if (!iso) return { text: "No date", overdue: false };
  const d = new Date(iso);
  const overdue = d.getTime() < Date.now();
  return { text: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), overdue };
}

export default async function CrmOverview() {
  const [stats, funnel, sources, series, recent, allTasks] = await Promise.all([
    getCrmStats(),
    getFunnelStats(),
    getSourceStats(),
    getLeadsTimeSeries(14),
    listEvents(8),
    listAllTasks(),
  ]);
  const openTasks = allTasks.filter((t) => !t.done).slice(0, 5);
  const maxSeries = Math.max(1, ...series.map((s) => s.count));

  return (
    <div className="space-y-8">
      <PageTitle title="Overview" subtitle="Track, see, and analyze the funnel and your pipeline." />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiTile label="Total contacts" value={stats.totalContacts} />
        <KpiTile label="New (7 days)" value={stats.newLast7Days} />
        <KpiTile label="Calls booked" value={stats.booked} />
        <KpiTile label="Reg → booked" value={`${stats.regToBookedPct}%`} />
        <KpiTile label="Open tasks" value={stats.openTasks} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel */}
        <Card>
          <h2 className="mb-1 text-lg font-semibold text-heading">Funnel</h2>
          <p className="mb-4 text-sm text-slate">Distinct contacts reaching each stage.</p>
          <FunnelBars stages={funnel.stages} />
        </Card>

        {/* Leads over time */}
        <Card>
          <h2 className="mb-1 text-lg font-semibold text-heading">New contacts (14 days)</h2>
          <p className="mb-4 text-sm text-slate">Daily registrations and bookings entering the CRM.</p>
          <div className="flex items-end gap-1.5" style={{ height: 140 }}>
            {series.map((pt) => (
              <div key={pt.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full items-end justify-center" style={{ height: 110 }}>
                  <div
                    className="w-full max-w-[18px] rounded-t bg-trust/80"
                    style={{ height: `${(pt.count / maxSeries) * 100}%` }}
                    title={`${pt.label}: ${pt.count}`}
                  />
                </div>
                <span className="text-[9px] text-slate">{pt.label.split(" ")[1]}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Source performance */}
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-heading">Sources</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate">
                <tr>
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 text-right font-medium">Contacts</th>
                  <th className="pb-2 text-right font-medium">Booked</th>
                  <th className="pb-2 text-right font-medium">Conv.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {sources.map((s) => (
                  <tr key={s.source}>
                    <td className="py-2 font-medium capitalize text-body">{s.source}</td>
                    <td className="py-2 text-right tabular-nums text-slate">{s.contacts}</td>
                    <td className="py-2 text-right tabular-nums text-slate">{s.booked}</td>
                    <td className="py-2 text-right tabular-nums text-body">{s.convPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Segments */}
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-heading">Segments</h2>
          <ul className="space-y-2">
            {funnel.segments.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3">
                <SegmentBadge segment={s.key} />
                <span className="text-sm tabular-nums text-body">{s.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent activity */}
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-heading">Recent activity</h2>
          <ul className="space-y-3">
            {recent.map((e) => {
              const d = displayEvent(e.event);
              return (
                <li key={e.id} className="flex items-center gap-3 text-sm">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${toneClass(d.tone)}`}>
                    <EventGlyph icon={d.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body">
                    {d.label} <span className="text-slate">· {e.email ?? "anonymous"}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate">{timeAgo(e.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Open tasks */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-heading">Open tasks</h2>
            <Link href="/crm/tasks" className="text-sm text-trust hover:underline">
              View all
            </Link>
          </div>
          <ul className="space-y-2.5">
            {openTasks.length === 0 ? (
              <li className="text-sm text-slate">Nothing open. Nice.</li>
            ) : (
              openTasks.map((t) => {
                const due = dueLabel(t.dueDate);
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate text-body">
                      {t.title} <span className="text-slate">· {t.contactName}</span>
                    </span>
                    <Badge tone={due.overdue ? "danger" : "neutral"}>{due.overdue ? `Overdue · ${due.text}` : due.text}</Badge>
                  </li>
                );
              })
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
