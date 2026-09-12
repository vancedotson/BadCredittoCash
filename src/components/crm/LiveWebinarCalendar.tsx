"use client";

import { useMemo } from "react";
import { calendarDate, calendarMonthDays, formatCalendarMonth, shiftCalendarMonth } from "@/lib/live-webinar-calendar";
import type { LiveWebinarSession } from "@/lib/live-webinar-types";

type CalendarProps = {
  sessions: LiveWebinarSession[];
  selectedId: string;
  month: string;
  today: string;
  timezone: string;
  canWrite: boolean;
  disabled: boolean;
  view: "calendar" | "sessions";
  onViewChange: (view: "calendar" | "sessions") => void;
  onMonthChange: (month: string) => void;
  onSelect: (id: string) => void;
  onCreate: (date: string) => void;
};

const statusLabel = { draft: "Draft", scheduled: "Scheduled", cancelled: "Cancelled" };
const statusStyle = {
  draft: "border-gold/35 bg-gold/10 text-gold-deep",
  scheduled: "border-trust/20 bg-sky text-heading",
  cancelled: "border-mist bg-cloud text-slate",
};
const control = "inline-flex h-8 items-center justify-center rounded-md border border-mist bg-card text-sm font-medium text-body transition-colors hover:bg-cloud focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust disabled:cursor-not-allowed disabled:opacity-40";

function Chevron({ previous = false }: { previous?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-4 w-4"><path d={previous ? "m12 5-5 5 5 5" : "m8 5 5 5-5 5"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ViewIcon({ calendar }: { calendar: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5 shrink-0">{calendar ? <><rect x="3.5" y="4.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 3v3m7-3v3M4 8.5h12m-9.5 3h1m3 0h1m-5 2.5h1m3 0h1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></> : <path d="M4 5h1m3 0h8M4 10h1m3 0h8M4 15h1m3 0h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}</svg>;
}

function fullDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function LiveWebinarCalendar({ sessions, selectedId, month, today, timezone, canWrite, disabled, view, onViewChange, onMonthChange, onSelect, onCreate }: CalendarProps) {
  const days = useMemo(() => calendarMonthDays(month), [month]);
  const datedSessions = useMemo(() => sessions.map((session) => ({ session, date: calendarDate(session.startsAt, timezone) })).sort((a, b) => Date.parse(a.session.startsAt) - Date.parse(b.session.startsAt)), [sessions, timezone]);
  const byDate = useMemo(() => {
    const result = new Map<string, LiveWebinarSession[]>();
    for (const { session, date } of datedSessions) result.set(date, [...(result.get(date) ?? []), session]);
    return result;
  }, [datedSessions]);
  const monthSessions = datedSessions.filter(({ date }) => date.slice(0, 7) === month);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }), [timezone]);
  const time = (session: LiveWebinarSession) => timeFormatter.format(new Date(session.startsAt));
  const weeks = Array.from({ length: days.length / 7 }, (_, index) => days.slice(index * 7, index * 7 + 7));

  return <section aria-label="Webinar calendar" className="min-w-0 overflow-hidden rounded-xl border border-mist bg-card">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mist px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="min-w-40 text-lg font-semibold tracking-tight text-heading" aria-live="polite">{formatCalendarMonth(month)}</h2>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" title="Previous month" disabled={disabled} onClick={() => onMonthChange(shiftCalendarMonth(month, -1))} className={`${control} w-8`}><Chevron previous /></button>
          <button type="button" aria-label="Next month" title="Next month" disabled={disabled} onClick={() => onMonthChange(shiftCalendarMonth(month, 1))} className={`${control} w-8`}><Chevron /></button>
          <button type="button" disabled={disabled} onClick={() => onMonthChange(today.slice(0, 7))} className={`${control} ml-1 px-3`}>Today</button>
        </div>
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-mist bg-cloud p-1" aria-label="Calendar view">
        {(["calendar", "sessions"] as const).map((option) => <button key={option} type="button" aria-pressed={view === option} disabled={disabled} onClick={() => onViewChange(option)} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust disabled:opacity-40 ${view === option ? "bg-card text-heading shadow-sm" : "text-slate hover:text-heading"}`}><ViewIcon calendar={option === "calendar"} />{option === "calendar" ? "Calendar" : "Sessions"}</button>)}
      </div>
    </div>

    {view === "calendar" ? <div className="crm-scroll overflow-x-auto">
      <table className="w-full table-fixed border-collapse text-left sm:min-w-[560px]" aria-label={`${formatCalendarMonth(month)} sessions`}>
        <thead><tr>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <th scope="col" key={day} className="border-b border-mist bg-cloud/60 px-1 py-2.5 text-[10px] font-medium text-slate sm:px-3 sm:text-xs">{day}</th>)}</tr></thead>
        <tbody>{weeks.map((week) => <tr key={week[0].date}>{week.map((day) => <td key={day.date} className={`border-r border-b border-mist/70 p-1 align-top last:border-r-0 sm:p-2 ${day.inMonth ? "bg-card" : "bg-cloud/50"}`}>
          <div className="min-h-[72px] sm:min-h-[94px]">
            <button type="button" disabled={!canWrite || disabled} aria-label={`Create session on ${fullDate(day.date)}`} aria-current={day.date === today ? "date" : undefined} onClick={() => onCreate(day.date)} className="group mb-1.5 flex min-h-8 w-full items-center justify-between rounded-md text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust disabled:cursor-default sm:min-h-6">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full tabular-nums ${day.date === today ? "bg-gold font-semibold text-ink" : day.inMonth ? "text-body group-hover:bg-cloud" : "text-slate/60"}`}>{day.day}</span>
              {canWrite && !disabled ? <span aria-hidden="true" className="hidden pr-1 text-base text-slate opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline">+</span> : null}
            </button>
            <div className="space-y-1">{(byDate.get(day.date) ?? []).map((session) => <button key={session.id} type="button" disabled={disabled} aria-pressed={selectedId === session.id} aria-label={`View session: ${session.title}, ${fullDate(day.date)}, ${time(session)}, ${statusLabel[session.status]}`} title={`${session.title} · ${time(session)} · ${statusLabel[session.status]}`} onClick={() => onSelect(session.id)} className={`block w-full min-w-0 overflow-hidden rounded-md border px-1 py-1.5 text-left break-words transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust disabled:opacity-50 sm:px-1.5 ${statusStyle[session.status]} ${selectedId === session.id ? "ring-2 ring-trust ring-offset-1 ring-offset-card" : "hover:brightness-95"}`}>
              <span className="block text-[9px] font-medium tabular-nums leading-tight sm:text-[10px]">{time(session)}</span>
              <span className={`mt-1 line-clamp-2 block text-[11px] font-medium leading-snug ${session.status === "cancelled" ? "line-through" : ""}`}>{session.title}</span>
              <span className="mt-1 block text-[9px] leading-tight opacity-80">{statusLabel[session.status]}</span>
            </button>)}</div>
          </div>
        </td>)}</tr>)}</tbody>
      </table>
    </div> : <div className="min-h-80">
      {monthSessions.length ? <ul className="divide-y divide-mist">{monthSessions.map(({ session, date }) => <li key={session.id}><button type="button" disabled={disabled} aria-pressed={selectedId === session.id} aria-label={`View session: ${session.title}, ${fullDate(date)}, ${time(session)}, ${statusLabel[session.status]}`} onClick={() => onSelect(session.id)} className={`flex w-full items-center gap-4 px-4 py-4 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-trust disabled:opacity-50 sm:px-5 ${selectedId === session.id ? "bg-sky" : "hover:bg-cloud"}`}>
        <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-mist bg-card"><span className="text-[10px] font-medium uppercase text-slate">{new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</span><span className="text-lg font-semibold tabular-nums leading-tight text-heading">{Number(date.slice(-2))}</span></span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-heading">{session.title}</span><span className="mt-1 block text-xs text-slate">{fullDate(date)} · {time(session)}</span></span>
        <span className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium ${statusStyle[session.status]}`}>{statusLabel[session.status]}</span>
        <span className="hidden text-slate sm:block"><Chevron /></span>
      </button></li>)}</ul> : <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center"><span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-mist bg-cloud text-trust"><ViewIcon calendar /></span><p className="text-sm font-medium text-heading">No sessions in {formatCalendarMonth(month)}</p><p className="mt-1 max-w-xs text-xs leading-relaxed text-slate">{canWrite ? "Choose a date on the calendar to plan a webinar." : "Scheduled sessions will appear here."}</p></div>}
    </div>}

    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-[11px] text-slate sm:px-5">
      <span>{monthSessions.length} {monthSessions.length === 1 ? "session" : "sessions"} this month{view === "calendar" && canWrite ? <span className="hidden sm:inline"> · Select a date to add a session</span> : null}</span>
      <span>Times shown in {timezone.replaceAll("_", " ")}</span>
    </div>
  </section>;
}
