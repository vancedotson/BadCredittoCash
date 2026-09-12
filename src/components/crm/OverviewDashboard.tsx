import Link from "next/link";
import type { ReactNode } from "react";
import type { OverviewData, listEvents } from "@/lib/store";
import { overviewComparison, overviewContactHref, overviewRatio, overviewTrend } from "@/lib/overview-display";
import { displayEvent } from "@/lib/event-display";
import { STAGE_LABELS } from "@/lib/stages";
import { EventGlyph } from "./ui";

const linkStyle = "rounded text-xs font-semibold text-trust hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-trust dark:text-gold-deep";
const summaryStyle = "cursor-pointer rounded text-xs font-medium text-slate marker:text-slate hover:text-heading focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-trust";
type IconName = "people" | "new" | "booked" | "ratio" | "tasks" | "chart" | "pipeline" | "funnel" | "clock" | "source";
const paths: Record<IconName, ReactNode> = {
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2" /></>,
  new: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3m3-15v6m-3-3h6" /></>,
  booked: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-13 5 3 3 5-5" /></>,
  ratio: <><path d="m5 19 14-14" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
  tasks: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 12 3 3 5-6" /></>,
  chart: <><path d="M4 20h17M6 16v-5m6 5V5m6 11V8" /></>,
  pipeline: <><rect x="3" y="4" width="4" height="16" rx="1" /><rect x="10" y="4" width="4" height="11" rx="1" /><rect x="17" y="4" width="4" height="7" rx="1" /></>,
  funnel: <path d="M3 4h18l-7 9v6l-4 2v-8Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  source: <><path d="m10 13 4-4m-6 6-2 2a4 4 0 0 1-5-5l4-4a4 4 0 0 1 6 0m2 0 2-2a4 4 0 0 1 6 5l-4 4a4 4 0 0 1-6 0" transform="translate(1 1)" /></>,
};

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Panel({ id, title, icon, scope, action, children, className = "" }: { id: string; title: string; icon: IconName; scope: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section aria-labelledby={id} className={`min-w-0 rounded-xl border border-mist bg-card p-5 sm:p-6 ${className}`}>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 id={id} className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-heading"><span className="text-trust dark:text-heading"><Icon name={icon} /></span>{title}</h2><p className="mt-1.5 text-xs leading-relaxed text-slate">{scope}</p></div>{action}</div>
    {children}
  </section>;
}

const kpiNames: Record<string, { label: string; icon: IconName }> = {
  total: { label: "Total contacts", icon: "people" },
  new: { label: "New contacts", icon: "new" },
  booked: { label: "Contacts booked", icon: "booked" },
  conv: { label: "Booking / registration", icon: "ratio" },
  tasks: { label: "Open tasks", icon: "tasks" },
};

export function OverviewMetrics({ data, rangeDays, owner }: { data: OverviewData; rangeDays: number; owner?: string }) {
  return <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
    {data.kpis.map((kpi, index) => {
      const display = kpiNames[kpi.key];
      const comparison = overviewComparison(kpi);
      const period = kpi.key === "new" || kpi.key === "booked";
      const value = kpi.key === "conv" && !data.engagement.registeredCount ? "—" : kpi.value;
      return <Link key={kpi.key} href={overviewContactHref(kpi.href, owner)} className={`group flex min-w-0 flex-col rounded-xl border border-mist bg-card p-4 transition-colors hover:border-trust/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust sm:p-5 ${index === data.kpis.length - 1 ? "col-span-2 sm:col-span-1" : ""}`}>
        <div className="flex items-start justify-between gap-2"><p className="text-xs font-medium leading-relaxed text-slate">{display?.label ?? kpi.label}</p><span className="text-trust dark:text-slate"><Icon name={display?.icon ?? "chart"} className="h-4 w-4" /></span></div>
        <p className="mt-3 text-3xl font-bold leading-none tracking-tight tabular-nums text-heading">{value}</p>
        <p className="mt-2 text-[11px] text-slate">{period ? `Last ${rangeDays} days` : kpi.key === "conv" ? "All-time observed ratio" : "Current total"}</p>
        <div className="mt-3 flex-1 border-t border-mist/70 pt-3">
          {comparison ? <><p className={`text-[11px] font-medium ${comparison.positive === true ? "text-green" : "text-slate"}`}>{comparison.text}</p><p className="mt-1 text-[11px] text-slate">{kpi.previousValue ?? "—"} in prior {rangeDays} days</p></> : <p className="text-[11px] leading-relaxed text-slate">{kpi.hint ?? (kpi.key === "tasks" ? "Open task workspace →" : "Explore contacts →")}</p>}
        </div>
      </Link>;
    })}
  </section>;
}

export function OverviewWeek({ data, scopeLabel }: { data: OverviewData; scopeLabel: string }) {
  return <Panel id="overview-week-title" title="Last 7 days" icon="booked" scope={`Rolling activity · ${scopeLabel}`} className="self-start">
    <dl className="grid grid-cols-3 divide-x divide-mist">{[{ label: "Contacts booked", value: data.thisWeek.booked }, { label: "Tasks done", value: data.thisWeek.tasksCompleted }, { label: "New clients", value: data.thisWeek.newClients }].map((item, index) => <div key={item.label} className={index ? "pl-4" : "pr-2"}><dt className="text-[11px] leading-relaxed text-slate">{item.label}</dt><dd className="mt-3 text-2xl font-bold tabular-nums text-heading">{item.value}</dd></div>)}</dl>
    <p className="mt-5 border-t border-mist pt-3 text-[11px] text-slate">A rolling seven-day view, regardless of the date filter.</p>
  </Panel>;
}

function Trend({ data, rangeDays, scopeLabel }: { data: OverviewData; rangeDays: number; scopeLabel: string }) {
  const points = overviewTrend(data.trend);
  const max = Math.max(1, ...points.flatMap((point) => [point.registered, point.booked]));
  const ceiling = max <= 2 ? 2 : Math.ceil(max / 2) * 2;
  const hasValues = points.some((point) => point.registered || point.booked);
  return <Panel id="overview-trend-title" title="New contacts & booking events" icon="chart" scope={`Last ${Math.min(rangeDays, 30)} days · ${scopeLabel}`}>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate"><span>{rangeDays > 30 ? "Chart shows the latest 30 days of the 90-day selection." : "Contact creation and booking activity by calendar day."}</span><div className="flex gap-4"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-trust" />New contacts</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-gold" />Booking events</span></div></div>
    {hasValues ? <figure aria-label="New contact and booking event counts. Exact daily values follow in View daily numbers.">
      <div className="relative h-48 pl-8" aria-hidden="true">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">{[ceiling, ceiling / 2, 0].map((value) => <div key={value} className="flex items-center gap-3 text-[10px] tabular-nums text-slate"><span className="w-5 text-right">{value}</span><span className="h-px flex-1 bg-mist" /></div>)}</div>
        <div className="relative flex h-full items-end gap-2 px-2 pb-2 pt-2 sm:gap-4">{points.map((point) => <div key={point.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-1" title={`${point.label}: ${point.registered} new contacts, ${point.booked} booking events`}><div className="w-full max-w-6 rounded-t-sm bg-trust" style={{ height: `${point.registered / ceiling * 100}%` }} /><div className="w-full max-w-6 rounded-t-sm bg-gold" style={{ height: `${point.booked / ceiling * 100}%` }} /></div>)}</div>
      </div>
      <figcaption className="mt-2 flex justify-between gap-3 pl-8 text-[10px] text-slate"><span>{points[0]?.label}</span><span className="hidden sm:inline">{points[Math.floor(points.length / 2)]?.label}</span><span>{points.at(-1)?.label}</span></figcaption>
    </figure> : <div className="grid h-48 place-items-center rounded-lg border border-dashed border-mist bg-cloud px-6 text-center"><div><p className="text-sm font-medium text-heading">No activity in this period</p><p className="mt-1 text-xs text-slate">New contacts and booking events will appear here.</p></div></div>}
    <details className="mt-5 border-t border-mist pt-4"><summary className={summaryStyle}>View daily numbers</summary><p className="mt-3 text-xs leading-relaxed text-slate">Bookings here count events; the KPI above counts distinct contacts. A contact can book more than once. Bars group adjacent days when needed.</p><div role="region" aria-label="Daily chart values" tabIndex={0} className="mt-3 max-h-64 overflow-y-auto rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust"><table className="w-full text-left text-xs"><caption className="sr-only">Daily new contacts and booking events</caption><thead className="text-slate"><tr><th scope="col" className="py-2 font-medium">Date</th><th scope="col" className="py-2 text-right font-medium">New contacts</th><th scope="col" className="py-2 text-right font-medium">Booking events</th></tr></thead><tbody className="divide-y divide-mist">{data.trend.map((point) => <tr key={point.label}><th scope="row" className="py-2 font-normal text-body">{point.label}</th><td className="text-right tabular-nums">{point.registered}</td><td className="text-right tabular-nums">{point.booked}</td></tr>)}</tbody></table></div></details>
  </Panel>;
}

function Pipeline({ data, scopeLabel }: { data: OverviewData; scopeLabel: string }) {
  const { pipeline } = data;
  return <Panel id="overview-pipeline-title" title="Pipeline" icon="pipeline" scope={`Current stages · ${scopeLabel}`} action={<Link href="/crm/pipeline" className={linkStyle}>Open board →</Link>}>
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5">{[
      { label: "Active contacts", value: pipeline.active, hint: "Across open stages" },
      { label: "Win rate", value: overviewRatio(pipeline.winRatePct, pipeline.won + pipeline.lost), hint: `${pipeline.won} won / ${pipeline.won + pipeline.lost} closed` },
      { label: "Stage-weighted estimate", value: pipeline.expectedClients, hint: "Includes existing clients" },
      { label: "Clients", value: pipeline.won, hint: "Won stage" },
    ].map((item) => <div key={item.label}><dt className="text-xs text-slate">{item.label}</dt><dd className="mt-2 text-2xl font-bold tabular-nums text-heading">{item.value}<span className="mt-1 block text-[11px] font-normal text-slate">{item.hint}</span></dd></div>)}</dl>
    <details className="mt-5 border-t border-mist pt-4"><summary className={summaryStyle}>Forecast method</summary><p className="mt-3 text-xs leading-relaxed text-slate">Forecast weights each contact by stage: New 5%, Registered 15%, Engaged 35%, Call booked 65%, Client 100%, Lost 0%. The rounded total includes won clients. It is an estimate, not a revenue forecast or a promise.</p></details>
    <div className="mt-5 border-t border-mist pt-4"><h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate">Longest in stage</h3>{pipeline.stalest.length ? <ul className="mt-3 space-y-3">{pipeline.stalest.map((contact) => <li key={contact.id}><Link href={`/crm/contacts/${contact.id}`} className="group flex items-center gap-3 rounded focus-visible:outline-2 focus-visible:outline-trust"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cloud text-[10px] font-semibold text-slate" aria-hidden="true">{contact.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("")}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-heading group-hover:underline">{contact.name}</span><span className="mt-0.5 block text-[11px] text-slate">{STAGE_LABELS[contact.stage]}</span></span><span className="text-xs tabular-nums text-slate">{contact.stageAgeDays}d</span></Link></li>)}</ul> : <p className="mt-3 text-xs text-slate">No contacts in an active stage.</p>}</div>
  </Panel>;
}

function Funnel({ data, scopeLabel }: { data: OverviewData; scopeLabel: string }) {
  const max = Math.max(1, ...data.funnel.map((stage) => stage.count));
  return <Panel id="overview-funnel-title" title="Evergreen webinar funnel" icon="funnel" scope={`All time · ${scopeLabel}`}>
    <div className="mb-3 grid grid-cols-[minmax(0,1fr)_3rem_4.5rem] gap-3 text-[10px] font-medium uppercase tracking-wide text-slate"><span>Recorded progress</span><span className="text-right">Contacts</span><span className="text-right">vs prior step</span></div>
    <ol className="space-y-3.5">{data.funnel.map((stage, index) => <li key={stage.key} className="grid grid-cols-[minmax(0,1fr)_3rem_4.5rem] items-center gap-3"><div className="min-w-0"><div className="mb-1.5 flex items-center gap-2"><span className="w-4 shrink-0 text-[10px] tabular-nums text-slate" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span className="text-xs text-body">{stage.label}</span></div><div className="ml-6 h-1.5 overflow-hidden rounded-full bg-mist/70" aria-hidden="true"><div className={`h-full rounded-full ${index === data.funnel.length - 1 ? "bg-green" : "bg-trust"}`} style={{ width: `${stage.count / max * 100}%` }} /></div></div><span className="text-right text-sm font-semibold tabular-nums text-heading">{stage.count}</span><span className="text-right text-[11px] tabular-nums text-slate">{index && data.funnel[index - 1].count ? <>{stage.convPct}%<span className="mt-0.5 block text-[10px]">{stage.count}/{data.funnel[index - 1].count}</span></> : "—"}</span></li>)}</ol>
    <p className="mt-5 border-t border-mist pt-3 text-[11px] leading-relaxed text-slate">Each step counts recorded contacts independently. Ratios may exceed 100%; they do not track a single cohort through every step. Live sessions have their own reports.</p>
    <Link href="/crm/webinars" className={`mt-3 inline-block ${linkStyle}`}>View live webinars →</Link>
  </Panel>;
}

function Engagement({ data, scopeLabel }: { data: OverviewData; scopeLabel: string }) {
  const { engagement: e } = data;
  return <Panel id="overview-engagement-title" title="Engagement" icon="chart" scope={`All time · ${scopeLabel}`}>
    <div className="rounded-lg border border-mist bg-cloud p-5"><p className="text-xs text-slate">Room opens / registrations</p><p className="mt-3 text-4xl font-bold tracking-tight tabular-nums text-heading">{overviewRatio(e.showUpPct, e.registeredCount)}</p><p className="mt-2 text-xs text-slate">{e.roomOpenedCount} opened / {e.registeredCount} registered</p></div>
    <dl className="mt-5 divide-y divide-mist">{[
      { label: "Bookings / room opens", value: overviewRatio(e.watchToBookPct, e.roomOpenedCount), hint: `${e.bookedCount} booked / ${e.roomOpenedCount} opened` },
      { label: "Average evergreen watch", value: overviewRatio(e.avgWatchPct, e.watchedCount), hint: `average across ${e.watchedCount} viewers` },
      { label: "Average time to book", value: data.speed.avgRegToBookedDays === null ? "—" : `${data.speed.avgRegToBookedDays}d`, hint: "From registration to a recorded booking" },
    ].map((item) => <div key={item.label} className="flex items-start justify-between gap-4 py-4"><dt><span className="text-xs font-medium text-body">{item.label}</span><span className="mt-1.5 block text-[11px] leading-relaxed text-slate">{item.hint}</span></dt><dd className="shrink-0 text-lg font-semibold tabular-nums text-heading">{item.value}</dd></div>)}</dl>
    <p className="mt-2 text-[11px] leading-relaxed text-slate">Observed event ratios include available webinar contexts and may exceed 100%. Opening a room does not prove attendance or playback. Watch progress reflects evergreen activity.</p>
  </Panel>;
}

const segmentColors: Record<string, string> = { booked: "var(--color-green)", booking_abandon: "var(--color-gold)", offer_click_no_book: "#bf8125", high_watch: "var(--color-trust)", mid_watch: "#5b8fc9", low_watch: "#9dbfe0", registered_no_show: "#8aa0b4", lead: "#c9d3dd" };

function Segments({ data, scopeLabel, owner }: { data: OverviewData; scopeLabel: string; owner?: string }) {
  const total = data.segments.reduce((sum, segment) => sum + segment.count, 0);
  return <Panel id="overview-segments-title" title="Audience segments" icon="people" scope={`Current classification · ${scopeLabel}`}>
    {total ? <div className="mb-5 flex h-2.5 overflow-hidden rounded-full bg-mist" aria-hidden="true">{data.segments.filter((segment) => segment.count).map((segment) => <div key={segment.key} style={{ width: `${segment.count / total * 100}%`, backgroundColor: segmentColors[segment.key] }} />)}</div> : <p className="mb-4 text-xs text-slate">No contacts in this selection yet.</p>}
    <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{data.segments.map((segment) => <li key={segment.key}><Link href={overviewContactHref(`/crm/contacts?segment=${encodeURIComponent(segment.key)}`, owner)} className="group flex min-h-11 items-center gap-2.5 rounded px-1 hover:bg-cloud focus-visible:outline-2 focus-visible:outline-trust"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segmentColors[segment.key] }} aria-hidden="true" /><span className="min-w-0 flex-1 text-xs leading-relaxed text-slate group-hover:text-heading">{segment.label}</span><span className="text-xs font-semibold tabular-nums text-heading">{segment.count}</span><span className="w-8 text-right text-[10px] tabular-nums text-slate">{total ? Math.round(segment.count / total * 100) : 0}%</span></Link></li>)}</ul>
    <p className="mt-4 border-t border-mist pt-3 text-[11px] leading-relaxed text-slate">Evergreen behavior and bookings determine segments. Open a segment to review its contacts.</p>
  </Panel>;
}

function Sources({ data, scopeLabel, owner }: { data: OverviewData; scopeLabel: string; owner?: string }) {
  const best = data.sources.find((source) => source.source === data.bestSource);
  return <Panel id="overview-sources-title" title="Acquisition sources" icon="source" scope={`All time · ${scopeLabel}`}>
    {data.sources.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Source contact and booking counts</caption><thead><tr className="border-b border-mist bg-cloud text-[10px] uppercase tracking-wide text-slate">{["Source", "Contacts", "Booked", "Rate"].map((name, i) => <th key={name} scope="col" className={`px-2 py-3 font-medium ${i ? "text-right" : "text-left"}`}>{name}</th>)}</tr></thead><tbody className="divide-y divide-mist">{data.sources.map((source) => <tr key={source.source} className="hover:bg-cloud"><th scope="row" className="max-w-44 px-2 py-3 text-left font-medium"><Link href={overviewContactHref(`/crm/contacts?source=${encodeURIComponent(source.source)}`, owner)} className="break-words capitalize text-body hover:underline focus-visible:outline-2 focus-visible:outline-trust">{source.source}</Link></th><td className="px-2 py-3 text-right tabular-nums text-slate">{source.contacts}</td><td className="px-2 py-3 text-right tabular-nums text-slate">{source.booked}</td><td className="px-2 py-3 text-right font-medium tabular-nums text-heading">{overviewRatio(source.convPct, source.contacts)}</td></tr>)}</tbody></table></div> : <div className="rounded-lg border border-dashed border-mist bg-cloud p-6 text-center"><p className="text-sm font-medium text-heading">No sources to compare yet</p><p className="mt-2 text-xs text-slate">Sources appear as contacts are added.</p></div>}
    {best ? <p className="mt-5 rounded-lg bg-cloud px-3 py-3 text-xs leading-relaxed text-slate">Highest observed rate: <span className="font-semibold capitalize text-heading">{best.source}</span> · {best.booked}/{best.contacts} booked. Based on sources with at least two contacts.</p> : null}
  </Panel>;
}

function relativeTime(iso: string, now: string): string {
  const hours = Math.max(0, Math.floor((Date.parse(now) - Date.parse(iso)) / 3_600_000));
  return hours < 1 ? "Just now" : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

function RecentActivity({ data, recent }: { data: OverviewData; recent: Awaited<ReturnType<typeof listEvents>> }) {
  return <Panel id="overview-activity-title" title="Recent activity" icon="clock" scope="Latest 8 events · All owners · Independent of the date filter" action={<Link href="/crm/activity" className={linkStyle}>View activity →</Link>}>
    {recent.length ? <ul className="divide-y divide-mist">{recent.map((event) => { const display = displayEvent(event.event); return <li key={event.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 sm:items-center sm:gap-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-mist bg-cloud text-slate"><EventGlyph icon={display.icon} className="h-4 w-4" /></span><div className="min-w-0 flex-1 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-4"><p className="truncate text-xs font-medium text-heading">{display.label}</p>{event.email ? <Link href={`/crm/contacts?view=all&q=${encodeURIComponent(event.email)}`} className="mt-1 block truncate text-xs text-slate hover:underline focus-visible:outline-2 focus-visible:outline-trust sm:mt-0">{event.email}</Link> : <p className="mt-1 text-xs text-slate sm:mt-0">Anonymous visitor</p>}</div><time dateTime={event.createdAt} title={event.createdAt} className="shrink-0 pt-1 text-[11px] tabular-nums text-slate sm:pt-0">{relativeTime(event.createdAt, data.generatedAt)}</time></li>; })}</ul> : <p className="rounded-lg bg-cloud p-5 text-sm text-slate">No activity recorded yet.</p>}
  </Panel>;
}

export function OverviewReports({ data, recent, rangeDays, scopeLabel, owner }: { data: OverviewData; recent: Awaited<ReturnType<typeof listEvents>>; rangeDays: number; scopeLabel: string; owner?: string }) {
  return <div className="space-y-5">
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]"><Trend data={data} rangeDays={rangeDays} scopeLabel={scopeLabel} /><Pipeline data={data} scopeLabel={scopeLabel} /></div>
    <div className="grid items-start gap-5 lg:grid-cols-2"><Funnel data={data} scopeLabel={scopeLabel} /><Engagement data={data} scopeLabel={scopeLabel} /></div>
    <div className="grid items-start gap-5 lg:grid-cols-2"><Segments data={data} scopeLabel={scopeLabel} owner={owner} /><Sources data={data} scopeLabel={scopeLabel} owner={owner} /></div>
    <RecentActivity data={data} recent={recent} />
  </div>;
}
