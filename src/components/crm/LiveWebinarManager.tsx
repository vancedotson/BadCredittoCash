"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LiveWebinarSession, LiveWebinarSessionReport } from "@/lib/live-webinar-types";
import { formatLiveDate, liveParticipationLabel, liveBookingLabel } from "@/lib/live-webinar-display";
import { Badge, Card } from "./ui";
import { LiveWebinarMessages } from "./LiveWebinarMessages";
import { LiveWebinarCalendar } from "./LiveWebinarCalendar";
import { LiveWebinarSessionEditor } from "./LiveWebinarSessionEditor";
import { calendarDate } from "@/lib/live-webinar-calendar";
import { CloudflareBroadcastStudio } from "./CloudflareBroadcastStudio";

const field = "mt-1 w-full rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none focus:border-trust disabled:opacity-60";
const button = "rounded-lg border border-mist bg-card px-3 py-2 text-sm font-medium text-body hover:bg-cloud disabled:opacity-50";
const primaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-gold/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust disabled:opacity-50";
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function CalendarPlus({ className = "h-7 w-7" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 10h18m-9 3v5m-2.5-2.5h5" /></svg>;
}

function SessionReport({ report }: { report: LiveWebinarSessionReport }) {
  const { session, registrations, stats } = report;
  const [observedAt] = useState(() => Date.now());
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{[["Registrations", stats.registrations], ["Session presence", stats.attended], ["No attendance recorded", stats.noAttendance], ["Attributed bookings", stats.booked]].map(([label, value]) => <Card key={label}><p className="text-2xl font-semibold tabular-nums text-heading">{value}</p><p className="mt-1 text-xs text-slate">{label}</p></Card>)}</div>
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-heading">Registrations for this session</h3><Link href={`/crm/contacts?funnel=live&sessionId=${encodeURIComponent(session.id)}`} className="text-sm text-trust hover:underline">View in contacts →</Link></div>
      <p className="mb-4 text-xs text-slate">Presence records someone being in the live room during the session. It does not establish how much they watched. Sessions are not recorded.</p>
      {!registrations.length ? <p className="py-4 text-sm text-slate">No registrations for this session yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
        <thead><tr className="border-b border-mist text-xs text-slate"><th scope="col" className="pb-3 pr-4 font-medium">Contact</th><th scope="col" className="pb-3 pr-4 font-medium">Registered</th><th scope="col" className="pb-3 pr-4 font-medium">Participation</th><th scope="col" className="pb-3 font-medium">Session emails</th></tr></thead>
        <tbody>{registrations.map((registration) => <tr key={registration.id} className="border-b border-mist/70 align-top last:border-0">
          <td className="py-3 pr-4"><Link href={`/crm/contacts/${registration.contactId}`} className="font-medium text-trust hover:underline">{registration.contactName || registration.email}</Link><p className="mt-1 text-xs text-slate">{registration.email}</p>{liveBookingLabel(registration, observedAt) ? <p className="mt-1 text-xs text-slate">{liveBookingLabel(registration, observedAt)}</p> : null}</td>
          <td className="py-3 pr-4 text-xs text-slate">{formatLiveDate(registration.registeredAt, session.timezone)}</td>
          <td className="py-3 pr-4"><Badge tone={registration.attendedAt ? "active" : "neutral"}>{liveParticipationLabel(registration)}</Badge>{registration.firstRoomOpenedAt ? <p className="mt-1 text-xs text-slate">Room: {formatLiveDate(registration.firstRoomOpenedAt, session.timezone)}</p> : null}{registration.attendedAt ? <p className="mt-1 text-xs text-slate">Present: {formatLiveDate(registration.attendedAt, session.timezone)}</p> : null}</td>
          <td className="min-w-44 py-3"><LiveWebinarMessages messages={registration.messages} timezone={session.timezone} /></td>
        </tr>)}</tbody>
      </table></div>}
    </Card>
  </div>;
}

export function LiveWebinarManager({ initialSessions, initialSessionId, initialNow, calendarTimezone = "America/Chicago", canWrite, canManageBroadcasts, siteEnabled, streamConfigured = false }: { initialSessions: LiveWebinarSession[]; initialSessionId?: string; initialNow: string; calendarTimezone?: string; canWrite: boolean; canManageBroadcasts: boolean; siteEnabled: boolean; streamConfigured?: boolean }) {
  const router = useRouter();
  // Do not accept clicks on server-rendered controls before handlers are attached.
  const interactive = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const today = calendarDate(initialNow, calendarTimezone);
  const initialSelected = initialSessions.find((session) => session.id === initialSessionId) ?? initialSessions[0];
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedId, setSelectedId] = useState(initialSessionId ?? initialSessions[0]?.id ?? "");
  const [month, setMonth] = useState(() => initialSelected ? calendarDate(initialSelected.startsAt, calendarTimezone).slice(0, 7) : today.slice(0, 7));
  const [view, setView] = useState<"calendar" | "sessions">("calendar");
  const [draftDate, setDraftDate] = useState<string | undefined>();
  const [editing, setEditing] = useState<LiveWebinarSession | "new" | null>(null);
  const [report, setReport] = useState<LiveWebinarSessionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const selected = sessions.find((session) => session.id === selectedId);
  // The native modal makes its background inert; leaving the opener enabled
  // lets the browser restore keyboard focus when the editor closes.
  const controlsDisabled = !interactive;

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(null); setReport(null);
      try {
        const response = await fetch(`/api/crm/live-webinars?sessionId=${encodeURIComponent(selectedId)}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.session) throw new Error(typeof result.error === "string" ? result.error : "Session activity could not be loaded.");
        if (!controller.signal.aborted) { setReport(result); setSessions((current) => current.map((session) => session.id === result.session.id ? result.session : session)); }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Session activity could not be loaded."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [selectedId, refresh]);

  function select(id: string) {
    setSelectedId(id); setNotice(null);
    router.replace(`/crm/webinars?sessionId=${encodeURIComponent(id)}`, { scroll: false });
  }

  function create(date?: string) {
    setDraftDate(date); setEditing("new"); setNotice(null);
  }

  return <div className="space-y-6" data-testid="webinar-workspace" data-today={today}>
    <header>
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2.5 text-xs text-slate"><Link href="/crm" className="hover:text-trust">CRM</Link><span aria-hidden="true">/</span><span aria-current="page">Live webinars</span></nav>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-3xl font-bold tracking-tight text-heading sm:text-4xl">Live webinars</h1><p className="mt-2 text-sm text-slate sm:text-base">Plan sessions and follow every participant.</p></div>
        {canWrite ? <button type="button" onClick={() => create()} disabled={controlsDisabled} className={primaryButton}>+ New session</button> : <Badge tone="neutral">Read-only access</Badge>}
      </div>
    </header>

    {!siteEnabled ? <div className="flex items-center gap-3.5 rounded-xl border border-gold/35 bg-gold/8 px-4 py-4 sm:px-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/20 text-gold-deep"><svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true"><rect x="5" y="4" width="3" height="12" rx="1" /><rect x="12" y="4" width="3" height="12" rx="1" /></svg></span>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-heading sm:text-base">Registration paused</p><p className="mt-0.5 text-xs leading-relaxed text-slate sm:text-sm">Prepare your next session before opening registration.</p></div>
      <span className="hidden shrink-0 rounded-full border border-gold/40 px-3 py-1 text-xs font-medium text-gold-deep sm:block">Draft mode</span>
    </div> : null}

    {notice ? <p role="status" className="rounded-lg border border-green/20 bg-green/5 p-3 text-sm text-green">{notice}</p> : null}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <LiveWebinarCalendar sessions={sessions} selectedId={selectedId} month={month} today={today} timezone={calendarTimezone} canWrite={canWrite} disabled={controlsDisabled} view={view} onViewChange={setView} onMonthChange={setMonth} onSelect={select} onCreate={create} />

      <aside className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1" aria-label="Session planning">
        {selected ? <section className="min-w-0 space-y-5 rounded-xl border border-mist bg-card p-5 sm:p-6" aria-labelledby="selected-webinar-title">
          <div><p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate">Selected session</p><h2 id="selected-webinar-title" className="break-words text-xl font-semibold leading-snug tracking-tight text-heading">{selected.title}</h2><div className="mt-3"><Badge tone={selected.status === "scheduled" ? "info" : selected.status === "cancelled" ? "warn" : "neutral"}>{selected.status}</Badge></div></div>
          {sessions.length > 1 ? <label className="block text-xs text-slate">Switch session<select aria-label="Session" value={selectedId} disabled={controlsDisabled} onChange={(event) => { select(event.target.value); const item = sessions.find((session) => session.id === event.target.value); if (item) setMonth(calendarDate(item.startsAt, calendarTimezone).slice(0, 7)); }} className={field}>{sessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}</select></label> : null}
          <div className="space-y-2 text-sm text-slate"><p>{formatLiveDate(selected.startsAt, selected.timezone)}</p><p className="text-xs">Ends {formatLiveDate(selected.endsAt, selected.timezone)}</p><p className="text-xs">{selected.timezone}</p></div>
          <div className="flex flex-wrap gap-2"><Badge tone={selected.automationEnabled ? "success" : "neutral"}>Session emails {selected.automationEnabled ? "enabled" : "disabled"}</Badge><Badge tone="neutral">Recording disabled</Badge></div>
          {canManageBroadcasts ? <CloudflareBroadcastStudio sessionId={selected.id} configured={streamConfigured} disabled={controlsDisabled} onPrepared={() => { setNotice("Cloudflare broadcast prepared."); setRefresh((value) => value + 1); }} /> : null}
          <div className="space-y-3 border-t border-mist pt-5">
            {canWrite ? <button type="button" disabled={controlsDisabled} onClick={() => setEditing(selected)} className={`${primaryButton} w-full`}>Edit session</button> : null}
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm"><Link href={`/live?session=${encodeURIComponent(selected.id)}`} target="_blank" className="text-trust hover:underline">Registration page ↗</Link></div>
          </div>
        </section> : <section className="rounded-xl border border-mist bg-card p-5 sm:p-6" aria-labelledby="plan-webinar-title">
          <span className="mb-5 grid h-14 w-14 place-items-center rounded-xl bg-gold/10 text-gold-deep"><CalendarPlus /></span>
          <h2 id="plan-webinar-title" className="text-2xl font-semibold leading-tight tracking-tight text-heading">Plan your first webinar</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate">Choose a date, add your stream, and save your session as a draft.</p>
          <ol className="my-6 space-y-4">{["Set the date and timezone", "Add your live stream", "Open registration when ready"].map((step, index) => <li key={step} className="flex items-center gap-3 text-sm leading-relaxed text-body"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-trust/25 text-xs font-semibold text-heading">{index + 1}</span>{step}</li>)}</ol>
          <div className="border-t border-mist pt-5">{canWrite ? <button type="button" disabled={controlsDisabled} onClick={() => create()} className={`${primaryButton} w-full`}>Create session</button> : <p className="text-sm text-slate">A team member with edit access can create your first session.</p>}<p className="mt-3 text-center text-xs leading-relaxed text-slate">Emails stay off until you enable them.</p></div>
        </section>}
        <section className="self-start rounded-xl border border-mist bg-card p-5 sm:p-6"><h2 className="font-semibold tracking-tight text-heading">Built for returning guests</h2><p className="mt-2 text-sm leading-relaxed text-slate">Each session keeps its own attendance, questions and follow-up.</p></section>
      </aside>
    </div>

    {selectedId ? <section className="space-y-4 border-t border-mist pt-6" aria-label="Session activity">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold tracking-tight text-heading">Session activity</h2><button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading || controlsDisabled} className={button}>Refresh activity</button></div>
      {loading ? <p role="status" className="py-4 text-sm text-slate">Loading session activity…</p> : error ? <p role="alert" className="text-sm text-red">{error}</p> : report && report.session.id === selectedId ? <SessionReport key={report.session.id + refresh} report={report} /> : null}
    </section> : null}

    {editing !== null && canWrite ? <LiveWebinarSessionEditor siteEnabled={siteEnabled} key={editing === "new" ? `new-${draftDate ?? "blank"}` : editing.id} session={editing === "new" ? null : editing} date={draftDate} timezone={calendarTimezone} onClose={() => setEditing(null)} onSaved={(session) => { setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)].sort((a, b) => b.startsAt.localeCompare(a.startsAt))); setMonth(calendarDate(session.startsAt, calendarTimezone).slice(0, 7)); setEditing(null); select(session.id); setNotice("Session saved."); setRefresh((value) => value + 1); router.refresh(); }} /> : null}
  </div>;
}
