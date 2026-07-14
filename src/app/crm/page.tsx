import Link from "next/link";
import { getOverview, listEvents, listContactOptions } from "@/lib/store";
import { displayEvent } from "@/lib/event-display";
import { STAGE_LABELS } from "@/lib/stages";
import { Card, SegmentBadge, EventGlyph, toneClass } from "@/components/crm/ui";
import { OverviewControls } from "@/components/crm/OverviewControls";
import { OverviewQuickActions } from "@/components/crm/OverviewQuickActions";
import { ChevronRightIcon } from "@/components/marketing-v2/Icons";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
function timeAgo(iso: string): string {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function toneColor(tone: string): string {
  return tone === "danger" ? "var(--color-red)" : tone === "warn" ? "var(--color-gold)" : "var(--color-slate)";
}
const SEG_COLOR: Record<string, string> = {
  booked: "#1f9d57",
  booking_abandon: "#f2a93b",
  offer_click_no_book: "#d98e1f",
  high_watch: "#1e5fa3",
  mid_watch: "#5b8fc9",
  low_watch: "#9dbfe0",
  registered_no_show: "#8aa0b4",
  lead: "#c9d3dd",
};
function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}

function Delta({ delta, good = true }: { delta?: number; good?: boolean }) {
  if (delta === undefined) return null;
  if (delta === 0) return <span className="text-xs text-slate">0%</span>;
  const up = delta > 0;
  const positive = good ? up : !up;
  return <span className={`text-xs font-medium ${positive ? "text-green" : "text-red"}`}>{up ? "▲" : "▼"}{Math.abs(delta)}%</span>;
}

export default async function CrmOverview({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const rangeDays = Number(str(sp.range)) || 30;
  const owner = str(sp.owner);
  const [data, recent, contacts] = await Promise.all([getOverview(rangeDays, owner), listEvents(8), listContactOptions()]);
  const funnelTop = data.funnel[0]?.count || 1;
  const trendTop = Math.max(1, ...data.trend.map((t) => Math.max(t.registered, t.booked)));
  const segTotal = data.segments.reduce((n, s) => n + s.count, 0) || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-heading">{greeting()}</h1>
          <p className="mt-1 text-sm text-slate">Here&apos;s what needs you. As of {new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OverviewControls owners={data.owners} />
          <OverviewQuickActions contacts={contacts} owners={data.owners} />
        </div>
      </div>

      {/* Action queue */}
      <Card>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-heading">Needs attention</h2>
          <span className="rounded-full bg-mist/70 px-2 py-0.5 text-xs font-medium tabular-nums text-slate">{data.actions.length}</span>
        </div>
        {data.actions.length === 0 ? (
          <p className="text-sm text-slate">All clear. No overdue tasks or cooling leads.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {data.actions.map((a) => (
              <li key={a.id}>
                <Link href={a.href} className="flex items-center gap-3 rounded-lg border border-mist px-3 py-2.5 transition-colors hover:bg-cloud">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: toneColor(a.tone) }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-body">{a.title}</div>
                    <div className="truncate text-xs text-slate">{a.subtitle}</div>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* KPIs (drill-through + deltas) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {data.kpis.map((k) => (
          <Link key={k.key} href={k.href} className="rounded-2xl border border-mist bg-card p-5 transition-colors hover:border-trust">
            <div className="text-2xl font-bold tabular-nums text-heading sm:text-3xl">{k.value}</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate">{k.label}<Delta delta={k.delta} good={k.deltaGood} /></div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pipeline snapshot */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-heading">Pipeline</h2>
            <Link href="/crm/pipeline" className="text-sm text-trust hover:underline">Open board</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            {[{ l: "Active", v: data.pipeline.active }, { l: "Win rate", v: `${data.pipeline.winRatePct}%` }, { l: "Forecast", v: data.pipeline.expectedClients }, { l: "Clients", v: data.pipeline.won }].map((s) => (
              <div key={s.l} className="rounded-xl border border-mist bg-cloud px-2 py-3">
                <div className="text-xl font-bold tabular-nums text-heading">{s.v}</div>
                <div className="mt-0.5 text-xs text-slate">{s.l}</div>
              </div>
            ))}
          </div>
          {data.pipeline.stalest.length ? (
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate">Sitting longest</div>
              <ul className="space-y-1.5">
                {data.pipeline.stalest.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/crm/contacts/${c.id}`} className="truncate text-body hover:text-trust">{c.name}</Link>
                    <span className="shrink-0 text-xs text-slate">{STAGE_LABELS[c.stage]} · {c.stageAgeDays}d</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        {/* Funnel + conversions */}
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-heading">Funnel</h2>
          <div className="space-y-1">
            {data.funnel.map((s, i) => (
              <div key={s.key}>
                {i > 0 && s.convPct !== null ? <div className="ml-[108px] text-[11px] text-slate sm:ml-[152px]">↓ {s.convPct}%</div> : null}
                <div className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-sm text-slate sm:w-36">{s.label}</div>
                  <div className="relative h-5 flex-1 overflow-hidden rounded bg-mist/60">
                    <div className="h-full rounded bg-trust/80" style={{ width: `${Math.max((s.count / funnelTop) * 100, s.count > 0 ? 4 : 0)}%` }} />
                  </div>
                  <div className="w-8 shrink-0 text-right text-sm tabular-nums text-body">{s.count}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Trend two-series */}
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-heading">New vs booked</h2>
            <div className="flex items-center gap-3 text-xs text-slate">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-trust/80" />Registered</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gold" />Booked</span>
            </div>
          </div>
          <p className="mb-3 text-sm text-slate">Last {Math.min(rangeDays, 30)} days.</p>
          <div className="flex items-end gap-1" style={{ height: 130 }}>
            {data.trend.map((pt, i) => (
              <div key={i} className="flex flex-1 items-end justify-center gap-px" style={{ height: 110 }} title={`${pt.label}: ${pt.registered} new, ${pt.booked} booked`}>
                <div className="w-full rounded-t bg-trust/80" style={{ height: `${(pt.registered / trendTop) * 100}%` }} />
                <div className="w-full rounded-t bg-gold" style={{ height: `${(pt.booked / trendTop) * 100}%` }} />
              </div>
            ))}
          </div>
        </Card>

        {/* Engagement + speed */}
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-heading">Engagement</h2>
          <dl className="space-y-2.5 text-sm">
            {[
              { l: "Show-up rate", v: `${data.engagement.showUpPct}%`, hint: "opened the training / registered" },
              { l: "Watch → booked", v: `${data.engagement.watchToBookPct}%`, hint: "booked / opened the training" },
              { l: "Avg watched", v: `${data.engagement.avgWatchPct}%`, hint: "average watch progress" },
              { l: "Avg reg → booked", v: data.speed.avgRegToBookedDays === null ? "—" : `${data.speed.avgRegToBookedDays}d`, hint: "time to convert" },
            ].map((r) => (
              <div key={r.l} className="flex items-center justify-between gap-3">
                <dt className="text-slate">{r.l}<span className="ml-2 hidden text-xs text-slate/60 sm:inline">{r.hint}</span></dt>
                <dd className="shrink-0 font-semibold tabular-nums text-heading">{r.v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Segments proportional */}
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-heading">Segments</h2>
          <div className="mb-3 flex h-3 overflow-hidden rounded-full bg-mist/40">
            {data.segments.filter((s) => s.count > 0).map((s) => (
              <div key={s.key} className="h-full" style={{ width: `${(s.count / segTotal) * 100}%`, background: SEG_COLOR[s.key] ?? "var(--color-slate)" }} title={`${s.label}: ${s.count}`} />
            ))}
          </div>
          <ul className="space-y-2">
            {data.segments.map((s) => (
              <li key={s.key}>
                <Link href={`/crm/contacts?segment=${s.key}`} className="flex items-center justify-between gap-3 hover:opacity-80">
                  <SegmentBadge segment={s.key} />
                  <span className="text-sm tabular-nums text-body">{s.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {/* Sources + best */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-heading">Sources</h2>
            {data.bestSource ? <span className="text-xs text-slate">Best converting: <span className="font-medium capitalize text-green">{data.bestSource}</span></span> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate"><tr><th className="pb-2 font-medium">Source</th><th className="pb-2 text-right font-medium">Contacts</th><th className="pb-2 text-right font-medium">Booked</th><th className="pb-2 text-right font-medium">Conv.</th></tr></thead>
              <tbody className="divide-y divide-mist">
                {data.sources.map((s) => (
                  <tr key={s.source} className="hover:bg-cloud">
                    <td className="py-2 font-medium capitalize"><Link href={`/crm/contacts?source=${s.source}`} className="text-body hover:text-trust">{s.source}</Link></td>
                    <td className="py-2 text-right tabular-nums text-slate">{s.contacts}</td>
                    <td className="py-2 text-right tabular-nums text-slate">{s.booked}</td>
                    <td className="py-2 text-right tabular-nums text-body">{s.convPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* This week */}
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-heading">This week</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[{ l: "Booked", v: data.thisWeek.booked }, { l: "Tasks done", v: data.thisWeek.tasksCompleted }, { l: "New clients", v: data.thisWeek.newClients }].map((s) => (
              <div key={s.l} className="rounded-xl border border-mist bg-cloud px-2 py-4">
                <div className="text-2xl font-bold tabular-nums text-heading">{s.v}</div>
                <div className="mt-0.5 text-xs text-slate">{s.l}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent activity */}
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-heading">Recent activity</h2>
          <ul className="space-y-3">
            {recent.map((e) => {
              const d = displayEvent(e.event);
              return (
                <li key={e.id} className="flex items-center gap-3 text-sm">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${toneClass(d.tone)}`}><EventGlyph icon={d.icon} className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1 truncate text-body">{d.label} <span className="text-slate">· {e.email ?? "anonymous"}</span></span>
                  <span className="shrink-0 text-xs text-slate">{timeAgo(e.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
