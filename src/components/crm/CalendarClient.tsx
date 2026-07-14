"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TaskWithContact, Booking, ContactOption } from "@/lib/store";
import { PRIORITY_DOT, PRIORITIES, PRIORITY_LABELS, TASK_TYPES, TYPE_LABELS, type TaskPriority, type TaskType } from "@/lib/tasks";

const DAY = 86400000;
const inputClass = "rounded-lg border border-mist bg-card px-3 py-2 text-sm text-body outline-none transition-colors focus:border-trust";

function pad(n: number) { return String(n).padStart(2, "0"); }
function keyOf(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function keyFromIso(iso: string) { return keyOf(new Date(iso)); }
function today() { return new Date(); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function addDays(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function startOfWeek(d: Date) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - x.getDay()); return x; }
function startOfDayMs(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
function timeOf(iso?: string) { if (!iso) return ""; const d = new Date(iso); if (d.getHours() === 0 && d.getMinutes() === 0) return ""; return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
function timeInput(iso?: string) { if (!iso) return ""; const d = new Date(iso); if (d.getHours() === 0 && d.getMinutes() === 0) return ""; return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function dayHeading(key: string) { const [y, m, dd] = key.split("-").map(Number); const d = new Date(y, m - 1, dd); const diff = Math.round((startOfDayMs(d) - startOfDayMs(new Date())) / DAY); if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow"; if (diff === -1) return "Yesterday"; return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }); }

async function api(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export function CalendarClient({ tasks, bookings, owners, contacts }: { tasks: TaskWithContact[]; bookings: Booking[]; owners: string[]; contacts: ContactOption[] }) {
  const router = useRouter();
  const [view, setView] = useState<"month" | "week" | "agenda">("month");
  const [cursor, setCursor] = useState<Date>(() => today());
  const [ownerF, setOwnerF] = useState("");
  const [prioF, setPrioF] = useState("");
  const [typeF, setTypeF] = useState("");
  const [hideDone, setHideDone] = useState(false);
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const ft = tasks.filter((t) => {
    if (ownerF) { if (ownerF === "__none__" ? t.owner : t.owner !== ownerF) return false; }
    if (prioF && (t.priority ?? "normal") !== prioF) return false;
    if (typeF && (t.type ?? "follow_up") !== typeF) return false;
    if (hideDone && t.done) return false;
    return true;
  });
  const tasksByDay = new Map<string, TaskWithContact[]>();
  for (const t of ft) if (t.dueDate) (tasksByDay.get(keyFromIso(t.dueDate)) ?? tasksByDay.set(keyFromIso(t.dueDate), []).get(keyFromIso(t.dueDate))!).push(t);
  for (const list of tasksByDay.values()) list.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  const bookingsByDay = new Map<string, Booking[]>();
  for (const bk of bookings) (bookingsByDay.get(keyFromIso(bk.createdAt)) ?? bookingsByDay.set(keyFromIso(bk.createdAt), []).get(keyFromIso(bk.createdAt))!).push(bk);

  // mutations
  async function complete(id: string) { await api("/api/crm/task", "PATCH", { id }); router.refresh(); }
  async function reschedule(id: string, dayKey: string) { const t = tasks.find((x) => x.id === id); const time = timeInput(t?.dueDate) || "09:00"; await api("/api/crm/task", "PATCH", { id, dueDate: new Date(`${dayKey}T${time}`).toISOString() }); router.refresh(); }
  async function addTask(dayKey: string, email: string, title: string) { await api("/api/crm/task", "POST", { email, title, dueDate: new Date(`${dayKey}T09:00`).toISOString() }); router.refresh(); }

  // summary for the cursor month
  const my = cursor.getFullYear(), mm = cursor.getMonth();
  const inMonth = (iso?: string) => { if (!iso) return false; const d = new Date(iso); return d.getFullYear() === my && d.getMonth() === mm; };
  const monthTasks = ft.filter((t) => inMonth(t.dueDate));
  const todayMs = startOfDayMs(new Date());
  const summary = { tasks: monthTasks.length, done: monthTasks.filter((t) => t.done).length, overdue: ft.filter((t) => !t.done && t.dueDate && new Date(t.dueDate).getTime() < todayMs).length, bookings: bookings.filter((b) => inMonth(b.createdAt)).length };

  const label = view === "month" ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : view === "week" ? (() => { const s = startOfWeek(cursor); const e = addDays(s, 6); return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`; })() : "Agenda";
  function prev() { setCursor((c) => (view === "week" ? addDays(c, -7) : addMonths(c, -1))); }
  function next() { setCursor((c) => (view === "week" ? addDays(c, 7) : addMonths(c, 1))); }

  const dropProps = (dayKey: string) => ({ onDragOver: (e: React.DragEvent) => e.preventDefault(), onDrop: (e: React.DragEvent) => { e.preventDefault(); const id = dragId ?? e.dataTransfer.getData("text/plain"); if (id) reschedule(id, dayKey); setDragId(null); } });
  const chip = (t: TaskWithContact) => (
    <button key={t.id} type="button" draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", t.id); setDragId(t.id); }} onClick={() => setDayOpen(keyFromIso(t.dueDate!))}
      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] ${t.done ? "text-slate line-through" : "text-body"} hover:bg-cloud`} style={{ borderLeft: `2px solid ${PRIORITY_DOT[t.priority ?? "normal"]}`, cursor: "grab" }} title={`${t.title} · ${t.contactName}`}>
      {timeOf(t.dueDate) ? <span className="text-slate">{timeOf(t.dueDate)} </span> : null}{t.title}
    </button>
  );

  function renderMonth() {
    const first = new Date(my, mm, 1);
    const cells: Array<{ key: string; day: number } | null> = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= new Date(my, mm + 1, 0).getDate(); d++) cells.push({ key: `${my}-${pad(mm + 1)}-${pad(d)}`, day: d });
    return (
      <div className="overflow-x-auto"><div className="min-w-[720px]">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-wide text-slate">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (!c) return <div key={i} className="min-h-[96px] rounded-lg bg-cloud/40" />;
            const dt = tasksByDay.get(c.key) ?? []; const bk = bookingsByDay.get(c.key) ?? []; const isToday = c.key === keyOf(new Date());
            return (
              <div key={i} className={`group min-h-[96px] rounded-lg border p-1.5 ${isToday ? "border-trust bg-sky/40" : "border-mist bg-card"}`} {...dropProps(c.key)}>
                <div className="mb-1 flex items-center justify-between">
                  <button type="button" onClick={() => setDayOpen(c.key)} className={`text-xs ${isToday ? "font-bold text-trust" : "text-slate hover:text-heading"}`}>{c.day}</button>
                  <div className="flex items-center gap-1">{bk.length ? <button type="button" onClick={() => setDayOpen(c.key)} className="rounded-full bg-green/15 px-1.5 text-[10px] font-medium text-green">{bk.length} call</button> : null}<button type="button" onClick={() => setDayOpen(c.key)} className="hidden text-slate group-hover:inline">＋</button></div>
                </div>
                <div className="space-y-1">{dt.slice(0, 3).map(chip)}{dt.length > 3 ? <button type="button" onClick={() => setDayOpen(c.key)} className="px-1.5 text-[10px] text-slate hover:text-heading">+{dt.length - 3} more</button> : null}</div>
              </div>
            );
          })}
        </div>
      </div></div>
    );
  }

  function renderWeek() {
    const s = startOfWeek(cursor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(s, i));
    return (
      <div className="overflow-x-auto"><div className="grid min-w-[840px] grid-cols-7 gap-1">
        {days.map((d) => { const key = keyOf(d); const dt = tasksByDay.get(key) ?? []; const bk = bookingsByDay.get(key) ?? []; const isToday = key === keyOf(new Date());
          return (
            <div key={key} className={`min-h-[220px] rounded-lg border p-2 ${isToday ? "border-trust bg-sky/30" : "border-mist bg-card"}`} {...dropProps(key)}>
              <button type="button" onClick={() => setDayOpen(key)} className="mb-2 block text-left text-xs font-medium text-heading">{d.toLocaleDateString("en-US", { weekday: "short" })} <span className="text-slate">{d.getDate()}</span></button>
              <div className="space-y-1">
                {bk.map((b) => <div key={b.id} className="truncate rounded bg-green/10 px-1.5 py-0.5 text-[11px] text-green">📞 {b.contactName}</div>)}
                {dt.map(chip)}
                {dt.length === 0 && bk.length === 0 ? <p className="text-[11px] text-slate/60">—</p> : null}
              </div>
            </div>
          );
        })}
      </div></div>
    );
  }

  function renderAgenda() {
    const from = startOfDayMs(new Date());
    const dayKeys = [...new Set([...tasksByDay.keys(), ...bookingsByDay.keys()])].filter((k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d).getTime() >= from - DAY; }).sort();
    if (dayKeys.length === 0) return <p className="py-8 text-center text-sm text-slate">Nothing scheduled.</p>;
    return (
      <div className="space-y-4">{dayKeys.map((key) => { const dt = tasksByDay.get(key) ?? []; const bk = bookingsByDay.get(key) ?? [];
        return (
          <div key={key}>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate">{dayHeading(key)}</div>
            <ul className="space-y-1.5">
              {bk.map((b) => <li key={b.id} className="flex items-center gap-2 rounded-lg border border-mist bg-card px-3 py-2 text-sm"><span className="rounded bg-green/15 px-1.5 py-0.5 text-xs text-green">Call</span><span className="text-body">{b.contactName}</span>{b.preferredTime ? <span className="text-xs text-slate">· prefers {b.preferredTime}</span> : null}</li>)}
              {dt.map((t) => <li key={t.id} className="flex items-center gap-2 rounded-lg border border-mist bg-card px-3 py-2 text-sm" style={{ borderLeft: `3px solid ${PRIORITY_DOT[t.priority ?? "normal"]}` }}><button type="button" onClick={() => complete(t.id)} className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${t.done ? "border-green bg-green text-white" : "border-mist"}`}>{t.done ? "✓" : ""}</button><span className={`min-w-0 flex-1 truncate ${t.done ? "text-slate line-through" : "text-body"}`}>{timeOf(t.dueDate) ? <span className="text-slate">{timeOf(t.dueDate)} · </span> : null}{t.title}</span><Link href={`/crm/contacts/${t.contactId}`} className="shrink-0 text-xs text-trust hover:underline">{t.contactName}</Link></li>)}
            </ul>
          </div>
        );
      })}</div>
    );
  }

  // upcoming next 7 days
  const upEnd = from7();
  function from7() { return startOfDayMs(new Date()) + 7 * DAY; }
  const upcoming = [
    ...ft.filter((t) => !t.done && t.dueDate && new Date(t.dueDate).getTime() >= todayMs && new Date(t.dueDate).getTime() < upEnd).map((t) => ({ kind: "task" as const, at: t.dueDate!, t })),
  ].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 8);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-mist bg-card p-0.5 text-sm">{(["month", "week", "agenda"] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} className={`rounded-md px-2.5 py-1.5 capitalize ${view === v ? "bg-navy text-white" : "text-slate"}`}>{v}</button>)}</div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={prev} className="rounded-lg border border-mist px-2.5 py-1.5 text-sm text-body hover:bg-cloud">‹</button>
          <span className="min-w-[130px] text-center text-sm font-medium text-heading">{label}</span>
          <button type="button" onClick={next} className="rounded-lg border border-mist px-2.5 py-1.5 text-sm text-body hover:bg-cloud">›</button>
          <button type="button" onClick={() => setCursor(today())} className="rounded-lg border border-mist px-2.5 py-1.5 text-sm text-body hover:bg-cloud">Today</button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select value={ownerF} onChange={(e) => setOwnerF(e.target.value)} className={inputClass} aria-label="Owner"><option value="">All owners</option><option value="__none__">Unassigned</option>{owners.map((o) => <option key={o} value={o}>{o}</option>)}</select>
          <select value={prioF} onChange={(e) => setPrioF(e.target.value)} className={inputClass} aria-label="Priority"><option value="">Any priority</option>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p as TaskPriority]}</option>)}</select>
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className={inputClass} aria-label="Type"><option value="">Any type</option>{TASK_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t as TaskType]}</option>)}</select>
          <label className="flex items-center gap-1.5 text-sm text-slate"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="h-4 w-4 accent-trust" />Hide done</label>
        </div>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-mist bg-cloud px-4 py-2.5 text-sm">
        <span className="text-body"><span className="font-semibold tabular-nums">{summary.tasks}</span> <span className="text-slate">tasks this month</span></span>
        <span className="text-body"><span className="font-semibold tabular-nums">{summary.done}</span> <span className="text-slate">done</span></span>
        <span className="text-body"><span className="font-semibold tabular-nums text-red">{summary.overdue}</span> <span className="text-slate">overdue</span></span>
        <span className="text-body"><span className="font-semibold tabular-nums text-green">{summary.bookings}</span> <span className="text-slate">bookings</span></span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        <div>{view === "month" ? renderMonth() : view === "week" ? renderWeek() : renderAgenda()}</div>
        {/* Upcoming panel */}
        <aside className="rounded-2xl border border-mist bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-heading">Upcoming (7 days)</h2>
          {upcoming.length === 0 ? <p className="text-sm text-slate">Nothing due.</p> : (
            <ul className="space-y-2">{upcoming.map((u) => <li key={u.t.id} className="text-sm"><Link href={`/crm/contacts/${u.t.contactId}`} className="block truncate text-body hover:text-trust" style={{ borderLeft: `2px solid ${PRIORITY_DOT[u.t.priority ?? "normal"]}`, paddingLeft: 8 }}>{u.t.title}</Link><span className="text-xs text-slate">{dayHeading(keyFromIso(u.at))}{timeOf(u.at) ? ` · ${timeOf(u.at)}` : ""} · {u.t.contactName}</span></li>)}</ul>
          )}
          <div className="mt-4 border-t border-mist pt-3">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate">Recent bookings</h3>
            {bookings.slice(0, 4).length === 0 ? <p className="text-sm text-slate">None yet.</p> : <ul className="space-y-1.5">{bookings.slice(0, 4).map((b) => <li key={b.id} className="text-xs"><Link href={`/crm/contacts/${b.contactId}`} className="text-body hover:text-trust">{b.contactName}</Link>{b.preferredTime ? <span className="text-slate"> · {b.preferredTime}</span> : null}</li>)}</ul>}
          </div>
        </aside>
      </div>

      {dayOpen ? <DayDetail dayKey={dayOpen} tasks={tasksByDay.get(dayOpen) ?? []} bookings={bookingsByDay.get(dayOpen) ?? []} contacts={contacts} onClose={() => setDayOpen(null)} onComplete={complete} onReschedule={reschedule} onAdd={addTask} /> : null}
    </div>
  );
}

function DayDetail({ dayKey, tasks, bookings, contacts, onClose, onComplete, onReschedule, onAdd }: { dayKey: string; tasks: TaskWithContact[]; bookings: Booking[]; contacts: ContactOption[]; onClose: () => void; onComplete: (id: string) => void; onReschedule: (id: string, day: string) => void; onAdd: (day: string, email: string, title: string) => void }) {
  const [email, setEmail] = useState(contacts[0]?.email ?? "");
  const [title, setTitle] = useState("");
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-navy/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-mist bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-semibold text-heading">{dayHeading(dayKey)}</h3>
        {bookings.length ? <div className="mb-3 space-y-1">{bookings.map((b) => <div key={b.id} className="flex items-center gap-2 rounded-lg bg-green/10 px-3 py-2 text-sm"><span className="text-green">Call</span><Link href={`/crm/contacts/${b.contactId}`} className="text-body hover:text-trust">{b.contactName}</Link>{b.preferredTime ? <span className="text-xs text-slate">· prefers {b.preferredTime}</span> : null}</div>)}</div> : null}
        <ul className="mb-4 space-y-2">
          {tasks.length === 0 ? <li className="text-sm text-slate">No tasks.</li> : tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-lg border border-mist px-3 py-2 text-sm" style={{ borderLeft: `3px solid ${PRIORITY_DOT[t.priority ?? "normal"]}` }}>
              <button type="button" onClick={() => onComplete(t.id)} className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${t.done ? "border-green bg-green text-white" : "border-mist"}`}>{t.done ? "✓" : ""}</button>
              <span className={`min-w-0 flex-1 truncate ${t.done ? "text-slate line-through" : "text-body"}`}>{t.title}</span>
              <Link href={`/crm/contacts/${t.contactId}`} className="shrink-0 text-xs text-trust hover:underline">{t.contactName}</Link>
              <input type="date" defaultValue={dayKey} onChange={(e) => e.target.value && onReschedule(t.id, e.target.value)} className="shrink-0 rounded border border-mist px-1 py-0.5 text-xs" aria-label="Reschedule" />
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); if (title.trim() && email) { onAdd(dayKey, email, title.trim()); setTitle(""); } }} className="flex flex-wrap gap-2 border-t border-mist pt-3">
          <select value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-mist bg-card px-2 py-1.5 text-sm outline-none focus:border-trust">{contacts.map((c) => <option key={c.id} value={c.email}>{c.name}</option>)}</select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task…" className="min-w-0 flex-[2] rounded-lg border border-mist bg-card px-2 py-1.5 text-sm outline-none focus:border-trust" />
          <button type="submit" className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-ink hover:bg-gold-deep">Add</button>
        </form>
        <div className="mt-4 flex justify-end"><button type="button" onClick={onClose} className="rounded-lg border border-mist px-3 py-2 text-sm text-body hover:bg-cloud">Close</button></div>
      </div>
    </div>
  );
}
