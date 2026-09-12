"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LiveWebinarSession, LiveWebinarSessionReport } from "@/lib/live-webinar-types";
import { isTimezone } from "@/lib/live-webinar-types";
import { validateLiveSessionInput } from "@/lib/live-webinar-validation";
import { formatLiveDate, liveDateInput, liveDateToIso, liveParticipationLabel, liveBookingLabel } from "@/lib/live-webinar-display";
import { Badge, Card } from "./ui";
import { LiveWebinarMessages } from "./LiveWebinarMessages";

const field = "mt-1 w-full rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none focus:border-trust disabled:opacity-60";
const button = "rounded-lg border border-mist bg-card px-3 py-2 text-sm font-medium text-body hover:bg-cloud disabled:opacity-50";

type SessionDraft = {
  id?: string; slug: string; title: string; startsAt: string; endsAt: string; timezone: string;
  status: LiveWebinarSession["status"]; embedUrl: string; replayUrl: string;
  replayPublished: boolean; replayAvailableUntil: string; automationEnabled: boolean;
};

function draftOf(session: LiveWebinarSession | null): SessionDraft {
  if (!session) return { slug: "", title: "", startsAt: "", endsAt: "", timezone: "America/New_York", status: "draft", embedUrl: "", replayUrl: "", replayPublished: false, replayAvailableUntil: "", automationEnabled: false };
  return { id: session.id, slug: session.slug, title: session.title, startsAt: liveDateInput(session.startsAt, session.timezone), endsAt: liveDateInput(session.endsAt, session.timezone), timezone: session.timezone, status: session.status, embedUrl: session.embedUrl ?? "", replayUrl: session.replayUrl ?? "", replayPublished: session.replayPublished, replayAvailableUntil: liveDateInput(session.replayAvailableUntil, session.timezone), automationEnabled: session.automationEnabled };
}

function SessionEditor({ session, onClose, onSaved }: { session: LiveWebinarSession | null; onClose: () => void; onSaved: (session: LiveWebinarSession) => void }) {
  const [draft, setDraft] = useState(() => draftOf(session));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = <K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      if (!isTimezone(draft.timezone)) throw new Error("Enter a valid timezone, such as America/New_York or Europe/Lisbon.");
      const startsAt = liveDateToIso(draft.startsAt, draft.timezone);
      const endsAt = liveDateToIso(draft.endsAt, draft.timezone);
      const replayAvailableUntil = draft.replayAvailableUntil ? liveDateToIso(draft.replayAvailableUntil, draft.timezone) : null;
      const validation = validateLiveSessionInput({ ...draft, startsAt, endsAt, replayAvailableUntil });
      if (!validation.session) throw new Error(validation.error ?? "Check the session details.");
      setPending(true);
      const response = await fetch("/api/crm/live-webinars", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ session: validation.session }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.session) throw new Error(typeof result.error === "string" ? result.error : "The session could not be saved. Please try again.");
      onSaved(result.session);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The session could not be saved."); }
    finally { setPending(false); }
  }

  return <Card>
    <form onSubmit={submit} className="space-y-5" aria-label={session ? "Edit live webinar" : "Create live webinar"}>
      <div><h2 className="text-lg font-semibold text-heading">{session ? "Edit session" : "New live webinar"}</h2><p className="mt-1 text-sm text-slate">Use a new session for each webinar. Change the dates here to postpone this same session.</p></div>
      <fieldset disabled={pending} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate">Title<input required minLength={3} maxLength={160} value={draft.title} onChange={(event) => update("title", event.target.value)} className={field} /></label>
          <label className="text-sm text-slate">Session URL name<input required disabled={Boolean(session)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} value={draft.slug} onChange={(event) => update("slug", event.target.value)} placeholder="september-credit-workshop" className={field} /><span className="mt-1 block text-xs">{session ? "The URL name stays fixed so existing links keep working." : "Lowercase letters, numbers, and hyphens."}</span></label>
          <label className="text-sm text-slate">Timezone<input required list="live-webinar-timezones" value={draft.timezone} onChange={(event) => update("timezone", event.target.value)} className={field} /><datalist id="live-webinar-timezones">{["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/Lisbon", "Europe/London", "UTC"].map((timezone) => <option key={timezone} value={timezone} />)}</datalist></label>
          <label className="text-sm text-slate">Status<select value={draft.status} onChange={(event) => update("status", event.target.value as SessionDraft["status"])} className={field}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="cancelled">Cancelled</option></select></label>
          <label className="text-sm text-slate">Starts at<input type="datetime-local" required value={draft.startsAt} onChange={(event) => update("startsAt", event.target.value)} className={field} /></label>
          <label className="text-sm text-slate">Ends at<input type="datetime-local" required value={draft.endsAt} onChange={(event) => update("endsAt", event.target.value)} className={field} /></label>
        </div>
        <p className="text-xs text-slate">All times on this form use the selected timezone.</p>
        <label className="block text-sm text-slate">Live player URL<input type="url" value={draft.embedUrl} onChange={(event) => update("embedUrl", event.target.value)} placeholder="https://www.youtube.com/embed/…" className={field} /><span className="mt-1 block text-xs">Supports YouTube, YouTube privacy-enhanced, and Vimeo embed URLs.</span></label>
        <div className="rounded-xl border border-mist bg-cloud p-4">
          <label className="flex items-start gap-2 text-sm text-body"><input type="checkbox" checked={draft.automationEnabled} onChange={(event) => update("automationEnabled", event.target.checked)} className="mt-1" /><span>Enable session emails<span className="mt-1 block text-xs text-slate">Joining details, reminders, and eligible follow-up use this session&apos;s schedule. Delivery also requires live webinars to be enabled for the site.</span></span></label>
        </div>
        <div className="space-y-3 border-t border-mist pt-4">
          <h3 className="font-medium text-heading">Replay</h3>
          <label className="block text-sm text-slate">Replay player URL<input type="url" value={draft.replayUrl} onChange={(event) => update("replayUrl", event.target.value)} className={field} /></label>
          <label className="block text-sm text-slate">Available until (optional)<input type="datetime-local" value={draft.replayAvailableUntil} onChange={(event) => update("replayAvailableUntil", event.target.value)} className={field} /></label>
          <label className="flex items-center gap-2 text-sm text-body"><input type="checkbox" checked={draft.replayPublished} onChange={(event) => update("replayPublished", event.target.checked)} />Publish replay</label>
        </div>
      </fieldset>
      {session && session.status === "scheduled" ? <p className="rounded-lg border border-mist bg-cloud p-3 text-sm text-slate">Saving schedule changes updates this session for its registrants. Cancelling stops pending reminders and preserves participation history.</p> : null}
      {error ? <p role="alert" className="text-sm text-red">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={onClose} disabled={pending} className={button}>Discard changes</button><button type="submit" disabled={pending} className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold-deep disabled:opacity-50">{pending ? "Saving…" : session ? "Save session" : "Create session"}</button></div>
    </form>
  </Card>;
}

function SessionReport({ report }: { report: LiveWebinarSessionReport }) {
  const { session, registrations, stats } = report;
  const [observedAt] = useState(() => Date.now());
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{[["Registrations", stats.registrations], ["Session presence", stats.attended], ["No attendance recorded", stats.noAttendance], ["Replay opened", stats.replayOpened], ["Attributed bookings", stats.booked]].map(([label, value]) => <Card key={label}><p className="text-2xl font-semibold tabular-nums text-heading">{value}</p><p className="mt-1 text-xs text-slate">{label}</p></Card>)}</div>
    <Card>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-heading">Registrations for this session</h3><Link href={`/crm/contacts?funnel=live&sessionId=${encodeURIComponent(session.id)}`} className="text-sm text-trust hover:underline">View in contacts →</Link></div>
      <p className="mb-4 text-xs text-slate">Presence records someone being in the live room during the session. Opening the room or replay alone does not establish how much they watched.</p>
      {!registrations.length ? <p className="py-4 text-sm text-slate">No registrations for this session yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
        <thead><tr className="border-b border-mist text-xs text-slate"><th scope="col" className="pb-3 pr-4 font-medium">Contact</th><th scope="col" className="pb-3 pr-4 font-medium">Registered</th><th scope="col" className="pb-3 pr-4 font-medium">Participation</th><th scope="col" className="pb-3 pr-4 font-medium">Replay</th><th scope="col" className="pb-3 font-medium">Session emails</th></tr></thead>
        <tbody>{registrations.map((registration) => <tr key={registration.id} className="border-b border-mist/70 align-top last:border-0">
          <td className="py-3 pr-4"><Link href={`/crm/contacts/${registration.contactId}`} className="font-medium text-trust hover:underline">{registration.contactName || registration.email}</Link><p className="mt-1 text-xs text-slate">{registration.email}</p>{liveBookingLabel(registration, observedAt) ? <p className="mt-1 text-xs text-slate">{liveBookingLabel(registration, observedAt)}</p> : null}</td>
          <td className="py-3 pr-4 text-xs text-slate">{formatLiveDate(registration.registeredAt, session.timezone)}</td>
          <td className="py-3 pr-4"><Badge tone={registration.attendedAt ? "active" : "neutral"}>{liveParticipationLabel(registration)}</Badge>{registration.firstRoomOpenedAt ? <p className="mt-1 text-xs text-slate">Room: {formatLiveDate(registration.firstRoomOpenedAt, session.timezone)}</p> : null}{registration.attendedAt ? <p className="mt-1 text-xs text-slate">Present: {formatLiveDate(registration.attendedAt, session.timezone)}</p> : null}</td>
          <td className="py-3 pr-4 text-xs text-slate">{registration.replayOpenedAt ? formatLiveDate(registration.replayOpenedAt, session.timezone) : "Not opened"}</td>
          <td className="min-w-44 py-3"><LiveWebinarMessages messages={registration.messages} timezone={session.timezone} /></td>
        </tr>)}</tbody>
      </table></div>}
    </Card>
  </div>;
}

export function LiveWebinarManager({ initialSessions, initialSessionId, canWrite, siteEnabled }: { initialSessions: LiveWebinarSession[]; initialSessionId?: string; canWrite: boolean; siteEnabled: boolean }) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedId, setSelectedId] = useState(initialSessionId ?? initialSessions[0]?.id ?? "");
  const [editing, setEditing] = useState<LiveWebinarSession | "new" | null>(null);
  const [report, setReport] = useState<LiveWebinarSessionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const selected = sessions.find((session) => session.id === selectedId);

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

  return <div className="space-y-5">
    {!siteEnabled ? <p className="rounded-xl border border-mist bg-cloud p-4 text-sm text-slate">Live registration and delivery are paused for the site. You can prepare sessions here before launch.</p> : null}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-2xl text-sm text-slate">Each session has its own registrations, participation, replay, and emails. Returning registrants keep their existing contact record and sales stage.</p>{canWrite ? <button type="button" onClick={() => setEditing("new")} disabled={editing !== null} className="shrink-0 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink hover:bg-gold-deep disabled:opacity-50">+ New session</button> : <Badge tone="neutral">Read-only access</Badge>}</div>
    {notice ? <p role="status" className="rounded-lg border border-mist bg-cloud p-3 text-sm text-green">{notice}</p> : null}
    {editing !== null && canWrite ? <SessionEditor key={editing === "new" ? "new" : editing.id} session={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(session) => { setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)].sort((a, b) => b.startsAt.localeCompare(a.startsAt))); setEditing(null); select(session.id); setNotice("Session saved."); setRefresh((value) => value + 1); router.refresh(); }} /> : null}
    {!sessions.length ? <Card><h2 className="font-semibold text-heading">Your first session starts here</h2><p className="mt-2 text-sm text-slate">Create a draft with the event date and timezone. Session emails start disabled.</p></Card> : <>
      <Card>
        <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm text-slate">Session<select value={selectedId} disabled={editing !== null} onChange={(event) => select(event.target.value)} className={field}>{!selected ? <option value={selectedId}>Select a session</option> : null}{sessions.map((session) => <option key={session.id} value={session.id}>{session.title} · {formatLiveDate(session.startsAt, session.timezone)} · {session.status}</option>)}</select></label>{selected && canWrite ? <button type="button" disabled={editing !== null} onClick={() => setEditing(selected)} className={button}>Edit session</button> : null}<button type="button" onClick={() => setRefresh((value) => value + 1)} disabled={loading} className={button}>Refresh activity</button></div>
        {selected ? <div className="mt-4 space-y-3"><div className="flex flex-wrap gap-2"><Badge tone={selected.status === "scheduled" ? "info" : selected.status === "cancelled" ? "warn" : "neutral"}>{selected.status}</Badge><Badge tone={selected.automationEnabled ? "success" : "neutral"}>Session emails {selected.automationEnabled ? "enabled" : "disabled"}</Badge><Badge tone={selected.replayPublished ? "info" : "neutral"}>Replay {selected.replayPublished ? "published" : "unpublished"}</Badge></div><p className="text-sm text-slate">{formatLiveDate(selected.startsAt, selected.timezone)} – {formatLiveDate(selected.endsAt, selected.timezone)}</p><div className="flex flex-wrap gap-x-4 gap-y-2 text-sm"><Link href={`/live?session=${encodeURIComponent(selected.id)}`} target="_blank" className="text-trust hover:underline">Registration page ↗</Link>{selected.replayPublished ? <Link href={`/live/replay?session=${encodeURIComponent(selected.id)}`} target="_blank" className="text-trust hover:underline">Replay page ↗</Link> : null}</div></div> : null}
      </Card>
      {loading ? <p role="status" className="py-4 text-sm text-slate">Loading session activity…</p> : error ? <p role="alert" className="text-sm text-red">{error}</p> : report && report.session.id === selectedId ? <SessionReport report={report} /> : null}
    </>}
  </div>;
}
